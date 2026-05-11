#!/usr/bin/env python3
import argparse
import csv
import json
import re
import sys
import time
from html import unescape
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

DETAIL_HOST = "https://lannuaire.service-public.gouv.fr"
USER_AGENT = "Mozilla/5.0"


def fetch(url: str) -> str:
    req = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=30) as response:
        return response.read().decode("utf-8", "ignore")


def extract_links(html: str, region_slug: str, department_slug: str) -> list[str]:
    pattern = re.compile(
        rf'href="(https://lannuaire\.service-public\.gouv\.fr/{re.escape(region_slug)}/{re.escape(department_slug)}/[^"]+)"',
        re.IGNORECASE,
    )
    return sorted(set(pattern.findall(html)))


def extract_json_ld(html: str) -> dict:
    match = re.search(
        r'<script type="application/ld\+json"[^>]*>(.*?)</script>',
        html,
        re.IGNORECASE | re.DOTALL,
    )
    if not match:
        return {}
    raw = unescape(match.group(1)).strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def normalize_email(data: dict, html: str) -> str:
    for contact in data.get("contactPoint", []):
        email = contact.get("email")
        if email:
            return email.strip()

    match = re.search(
        r'<li[^>]+id="contentContactEmail"[^>]*>.*?href="mailto:([^"?]+)',
        html,
        re.IGNORECASE | re.DOTALL,
    )
    if not match:
        return ""

    email = unescape(match.group(1)).strip()
    return email if "@" in email else ""


def normalize_name(data: dict, html: str) -> str:
    name = data.get("name")
    if name:
        return name.strip()

    match = re.search(r"<title>(.*?)\|", html, re.IGNORECASE | re.DOTALL)
    if match:
        return " ".join(unescape(match.group(1)).split())
    return ""


def normalize_location(data: dict) -> dict:
    location = data.get("location") or {}
    address = location.get("address") or {}
    postal_code = (address.get("postalCode") or "").strip()
    if postal_code.isdigit() and len(postal_code) == 4:
        postal_code = f"{postal_code}0"
    elif postal_code.isdigit() and len(postal_code) < 5:
        postal_code = postal_code.zfill(5)
    return {
        "adresse_mairie": " ".join(
            part for part in [address.get("streetAddress", "")] if part
        ).strip(),
        "code_postal": postal_code,
        "ville": (address.get("addressLocality") or "").strip(),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scrape l'annuaire Service Public des mairies d'un departement.")
    parser.add_argument("--region-slug", default="normandie")
    parser.add_argument("--department-slug", default="eure")
    parser.add_argument("--output", default="communes_27_emails.csv")
    parser.add_argument("--max-pages", type=int, default=80)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    list_url = (
        "https://www.service-public.gouv.fr/annuaire/navigation/"
        f"{args.region_slug}/{args.department_slug}/mairie?page={{page}}"
    )
    rows = []
    all_links = []
    empty_pages = 0

    for page in range(1, args.max_pages + 1):
        url = list_url.format(page=page)
        try:
            html = fetch(url)
        except (HTTPError, URLError) as exc:
            print(f"[list] page {page} failed: {exc}", file=sys.stderr)
            continue

        links = extract_links(html, args.region_slug, args.department_slug)
        print(f"[list] page {page}: {len(links)} links", file=sys.stderr)
        all_links.extend(links)
        if links:
            empty_pages = 0
        else:
            empty_pages += 1
            if page > 1 and empty_pages >= 2:
                break
        time.sleep(0.1)

    unique_links = sorted(set(all_links))
    print(f"[detail] total unique links: {len(unique_links)}", file=sys.stderr)

    for index, url in enumerate(unique_links, start=1):
        try:
            html = fetch(url)
        except (HTTPError, URLError) as exc:
            print(f"[detail] {index}/{len(unique_links)} failed: {url} {exc}", file=sys.stderr)
            continue

        data = extract_json_ld(html)
        location = normalize_location(data)
        row = {
            "commune": normalize_name(data, html).replace("Mairie - ", "", 1),
            "organisme": normalize_name(data, html),
            "email": normalize_email(data, html),
            "adresse_mairie": location["adresse_mairie"],
            "code_postal": location["code_postal"],
            "ville": location["ville"],
            "url": url,
        }
        rows.append(row)
        if index % 25 == 0 or index == len(unique_links):
            print(f"[detail] {index}/{len(unique_links)}", file=sys.stderr)
        time.sleep(0.1)

    rows.sort(key=lambda item: item["commune"])

    with open(args.output, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "commune",
                "organisme",
                "email",
                "adresse_mairie",
                "code_postal",
                "ville",
                "url",
            ],
        )
        writer.writeheader()
        writer.writerows(rows)

    with_email = sum(1 for row in rows if row["email"])
    print(f"saved {args.output} with {len(rows)} rows, {with_email} emails", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
