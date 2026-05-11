#!/usr/bin/env python3
import argparse
import csv
import difflib
import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path


COMMUNES_CSV = Path("communes_27_emails.csv")

MANUAL_ALIASES = {
    "aubevoye": "Le Val-d'Hazey",
    "baux de breteuil": "Les Baux-de-Breteuil",
    "bourgtheroulde": "Grand-Bourgtheroulde",
    "bourgtheroulde infreville": "Grand-Bourgtheroulde",
    "bourtheroulde": "Grand-Bourgtheroulde",
    "bourneville": "Bourneville-Sainte-Croix",
    "breteuil sur iton": "Mesnils-sur-Iton",
    "bus saint remy": "Vexin-sur-Epte",
    "champigny la flutelaye": "Champigny-la-Futelaye",
    "comblon": "Combon",
    "conches en ouches": "Conches-en-Ouche",
    "est sur eure": "Ézy-sur-Eure",
    "etrepargny": "Étrépagny",
    "frenelles en vexin boisemont": "Frenelles-en-Vexin",
    "la chapelle du bois du faulx": "La Chapelle-du-Bois-des-Faulx",
    "la chapelle reanville": "La Chapelle-Longueville",
    "la croix saint leufroy": "Clef-Vallée-d'Eure",
    "la madeleine nonancourt": "La Madeleine-de-Nonancourt",
    "le manoir": "Le Manoir-sur-Seine",
    "le thil en vexin": "Les Thilliers-en-Vexin",
    "le val d hazay": "Le Val-d'Hazey",
    "le val dore": "Val-Doré",
    "le vieille evreux": "Le Vieil-Évreux",
    "le vieux evreux": "Le Vieil-Évreux",
    "les andelys cedex": "Les Andelys",
    "lesme": "Le Lesme",
    "lilliers leveque": "Illiers-l'Évêque",
    "louviers cedex": "Louviers",
    "mairie deleguee saint quentin des isles": "Mairie déléguée - Saint-Quentin-des-Isles",
    "mesnil sur iton": "Mesnils-sur-Iton",
    "nassandres": "Nassandres sur Risle",
    "pont audemer cedex": "Pont-Audemer",
    "porte joie": "Mairie déléguée - Portejoie",
    "portejoie": "Mairie déléguée - Portejoie",
    "rougemontiers": "Rougemontier",
    "saint quentin des isles": "Mairie déléguée - Saint-Quentin-des-Isles",
    "sainte croix sur aizier": "Bourneville-Sainte-Croix",
    "serquiny": "Serquigny",
    "st aquilin": "Pacy-sur-Eure",
    "st etienne du vauvray": "Saint-Étienne-du-Vauvray",
    "st maclou": "Saint-Maclou",
    "st pierre du vauvray": "Saint-Pierre-du-Vauvray",
    "tosny": "Les Trois Lacs",
    "val de reil": "Val-de-Reuil",
    "val de reuil": "Val-de-Reuil",
    "val de reuil cedex": "Val-de-Reuil",
    "val de reui": "Val-de-Reuil",
    "verneuil sur avre": "Verneuil-d'Avre-et-d'Iton",
    "verneuil sur avre et d iton": "Verneuil-d'Avre-et-d'Iton",
    "vernom": "Vernon",
    "vernon cedex": "Vernon",
    "villiers en desoeuvre": "Villiers-en-Désœuvre",
    "evreux cedex": "Évreux",
    "bernay cedex": "Bernay",
}


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKD", value or "")
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def clean(value) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        return ", ".join(clean(item) for item in value if clean(item))
    if isinstance(value, bool):
        return "True" if value else "False"
    return str(value).strip()


def pick(row: dict, *names: str) -> str:
    for name in names:
        if name in row and clean(row[name]):
            return clean(row[name])
    return ""


def parse_bool(value: str) -> bool | None:
    value = normalize_text(value)
    if not value:
        return None
    yes = {"1", "oui", "o", "yes", "true", "vrai", "accessible", "public"}
    no = {"0", "non", "n", "no", "false", "faux"}
    if value in yes:
        return True
    if value in no:
        return False
    return None


def parse_status(value: str) -> str:
    token = normalize_text(value)
    if not token:
        return "inconnu"
    if any(part in token for part in ("fonction", "service", "operationnel", "ok")):
        if "hors" not in token and "non" not in token:
            return "en_service"
    if any(part in token for part in ("hors", "panne", "defaut", "indisponible")):
        return "hors_service"
    return "inconnu"


def normalize_type(value: str) -> str:
    token = normalize_text(value)
    if not token:
        return "inconnu"
    if "dsa" in token:
        return "DSA"
    if "dea" in token:
        return "DEA"
    if "semi" in token:
        return "semi-automatique"
    if "automatique" in token:
        return "automatique"
    return value.strip()


def is_24_7(days: str, hours: str) -> bool:
    day_token = normalize_text(days)
    hour_token = normalize_text(hours)
    day_hits = {"7j 7", "7j 7j", "7j7", "tous les jours", "24 24", "24h 24", "365 jours", "permanent"}
    hour_hits = {"24h 24", "24 24", "24h24", "24 7", "24h sur 24", "permanent", "continu"}
    return any(hit in day_token for hit in day_hits) and any(hit in hour_token for hit in hour_hits)


def load_communes(path: Path) -> tuple[dict[str, dict], list[str], dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        rows = list(csv.DictReader(handle))
    by_key = {normalize_text(row["commune"]): row for row in rows}
    ordered = [row["commune"] for row in rows]
    aliases = {}
    for name in ordered:
        token = normalize_text(name)
        aliases[token] = name
        aliases[token.replace("mairie deleguee ", "").strip()] = name
        aliases[token.replace(" d ", " ").replace(" l ", " ").strip()] = name
    return by_key, ordered, aliases


def load_geodae(path: Path) -> list[dict]:
    if path.suffix.lower() in {".geojson", ".json"}:
        with path.open(encoding="utf-8") as handle:
            payload = json.load(handle)
        if isinstance(payload, dict) and "features" in payload:
            return [feature.get("properties", {}) for feature in payload["features"]]
        if isinstance(payload, list):
            return payload
        raise ValueError("Format JSON non reconnu pour l'export Géo'DAE.")

    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def infer_commune(row: dict) -> str:
    return pick(
        row,
        "c_com_nom",
        "commune",
        "nom_commune",
        "libelle_commune",
        "city",
    )


def infer_department(row: dict) -> str:
    dept = pick(row, "c_dept_num", "departement", "dept", "code_departement")
    if dept:
        return dept.zfill(2)
    postcode = pick(row, "c_com_cp", "code_postal", "cp", "postcode")
    if len(postcode) >= 2 and postcode[:2].isdigit():
        return postcode[:2]
    insee = pick(row, "c_com_insee", "code_insee", "insee")
    if len(insee) >= 2 and insee[:2].isdigit():
        return insee[:2]
    return ""


def resolve_commune_name(raw_name: str, aliases: dict[str, str], dept_hint: str) -> str | None:
    token = normalize_text(raw_name)
    if not token:
        return None

    variants = {
        token,
        token.replace(" cedex", "").strip(),
        token.replace("/", " ").strip(),
        re.sub(r"\bst\b", "saint", token).strip(),
    }
    variants = {re.sub(r"\s+", " ", item).strip() for item in variants if item}

    for variant in list(variants):
        compact = variant.replace("-", " ")
        variants.add(compact)
        variants.add(compact.replace(" d ", " ").replace(" l ", " ").strip())

    for variant in variants:
        if variant in aliases:
            return aliases[variant]
        if variant in MANUAL_ALIASES:
            return MANUAL_ALIASES[variant]

    if dept_hint == "27":
        match = difflib.get_close_matches(token, aliases.keys(), n=1, cutoff=0.9)
        if match:
            return aliases[match[0]]
    return None


def format_address(row: dict) -> str:
    address = pick(
        row,
        "c_acc_voie",
        "adresse",
        "address",
        "c_adr_voie",
    )
    number = pick(row, "c_acc_num", "numero", "c_adr_num")
    lieu = pick(row, "c_nom", "site", "nom_site")
    parts = [part for part in [lieu, f"{number} {address}".strip()] if part]
    return " - ".join(parts)


def commune_summary(commune: str, email_row: dict | None, records: list[dict]) -> dict:
    type_counter = Counter()
    hours_counter = Counter()
    access_notes = Counter()
    status_counter = Counter()
    sample_addresses = []
    public_count = 0
    outdoor_count = 0
    indoor_count = 0
    open_24_7_count = 0

    for row in records:
        type_counter[normalize_type(pick(row, "c_type", "type", "dae_type"))] += 1

        status = parse_status(pick(row, "c_etat_fonct", "etat", "statut"))
        status_counter[status] += 1

        days = pick(row, "c_disp_j", "jours_disponibilite", "jours")
        hours = pick(row, "c_disp_h", "heures_disponibilite", "horaires")
        if days or hours:
            hours_counter[" / ".join(part for part in [days, hours] if part)] += 1
        if is_24_7(days, hours):
            open_24_7_count += 1

        public = parse_bool(pick(row, "c_acc_acc", "accessible_public", "public"))
        if public is True:
            public_count += 1

        access_mode = normalize_text(pick(row, "c_acc", "c_acc_int", "interieur", "indoor"))
        if "interieur" in access_mode:
            indoor_count += 1
        elif "exterieur" in access_mode:
            outdoor_count += 1

        note = pick(row, "c_acc_complt", "accessibilite", "observation")
        if note and note not in {"True", "False"}:
            access_notes[note] += 1

        if len(sample_addresses) < 5:
            address = format_address(row)
            if address:
                sample_addresses.append(address)

    total = len(records)
    en_service = status_counter["en_service"]
    hors_service = status_counter["hors_service"]
    need_score = 0
    need_reasons = []

    if total == 0:
        need_score += 100
        need_reasons.append("aucun DAE déclaré")
    elif total == 1:
        need_score += 45
        need_reasons.append("un seul DAE déclaré")
    elif total == 2:
        need_score += 20
        need_reasons.append("couverture déclarée limitée")

    if open_24_7_count == 0 and total > 0:
        need_score += 25
        need_reasons.append("aucun DAE accessible 24h/24")

    if public_count == 0 and total > 0:
        need_score += 15
        need_reasons.append("accessibilité publique non visible")

    if hors_service > 0:
        need_score += min(30, hors_service * 10)
        need_reasons.append("au moins un DAE hors service")

    if en_service == 0 and total > 0:
        need_score += 20
        need_reasons.append("état fonctionnel non confirmé")

    priority = "faible"
    if need_score >= 70:
        priority = "très élevée"
    elif need_score >= 40:
        priority = "élevée"
    elif need_score >= 20:
        priority = "modérée"

    return {
        "commune": commune,
        "organisme_mairie": (email_row or {}).get("organisme", ""),
        "email_mairie": (email_row or {}).get("email", ""),
        "adresse_mairie": (email_row or {}).get("adresse_mairie", ""),
        "code_postal_mairie": (email_row or {}).get("code_postal", ""),
        "ville_mairie": (email_row or {}).get("ville", ""),
        "site_mairie": (email_row or {}).get("url", ""),
        "nb_dae": total,
        "nb_dae_en_service": en_service,
        "nb_dae_hors_service": hors_service,
        "nb_dae_24_7": open_24_7_count,
        "nb_dae_accessibles_public": public_count,
        "nb_dae_exterieur": outdoor_count,
        "nb_dae_interieur": indoor_count,
        "types_dae": " | ".join(f"{key}:{value}" for key, value in type_counter.most_common()),
        "horaires_declares": " | ".join(f"{key}:{value}" for key, value in hours_counter.most_common(3)),
        "notes_accessibilite": " | ".join(f"{key}:{value}" for key, value in access_notes.most_common(3)),
        "adresses_exemples": " | ".join(sample_addresses),
        "score_besoin": need_score,
        "priorite_besoin": priority,
        "points_attention": " | ".join(need_reasons),
    }


def build_rows(
    geodae_rows: list[dict],
    communes_by_key: dict[str, dict],
    ordered_communes: list[str],
    aliases: dict[str, str],
) -> tuple[list[dict], int]:
    grouped = defaultdict(list)
    discarded = 0
    for row in geodae_rows:
        dept_hint = infer_department(row)
        if dept_hint and dept_hint != "27":
            continue
        commune = resolve_commune_name(infer_commune(row), aliases, dept_hint)
        if not commune:
            discarded += 1
            continue
        grouped[normalize_text(commune)].append(row)

    rows = []
    for commune in ordered_communes:
        key = normalize_text(commune)
        rows.append(commune_summary(commune, communes_by_key.get(key), grouped.get(key, [])))

    rows.sort(key=lambda row: (-row["score_besoin"], row["commune"]))
    return rows, discarded


def write_csv(path: Path, rows: list[dict]) -> None:
    fieldnames = [
        "commune",
        "organisme_mairie",
        "email_mairie",
        "adresse_mairie",
        "code_postal_mairie",
        "ville_mairie",
        "site_mairie",
        "nb_dae",
        "nb_dae_en_service",
        "nb_dae_hors_service",
        "nb_dae_24_7",
        "nb_dae_accessibles_public",
        "nb_dae_exterieur",
        "nb_dae_interieur",
        "types_dae",
        "horaires_declares",
        "notes_accessibilite",
        "adresses_exemples",
        "score_besoin",
        "priorite_besoin",
        "points_attention",
    ]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def write_markdown(path: Path, rows: list[dict], discarded: int) -> None:
    total_communes = len(rows)
    equipped = sum(1 for row in rows if row["nb_dae"] > 0)
    no_dae = sum(1 for row in rows if row["nb_dae"] == 0)
    high_need = sum(1 for row in rows if row["priorite_besoin"] in {"très élevée", "élevée"})
    total_dae = sum(row["nb_dae"] for row in rows)

    top_rows = rows[:20]
    lines = [
        "# Synthese DAE - Eure",
        "",
        f"- Communes analysees : {total_communes}",
        f"- Communes avec au moins un DAE declare : {equipped}",
        f"- Communes sans DAE declare : {no_dae}",
        f"- DAE declares dans l'Eure : {total_dae}",
        f"- Communes a besoin eleve ou tres eleve : {high_need}",
        f"- Enregistrements Géo'DAE non rapproches a une commune de reference : {discarded}",
        "",
        "## Top 20 des communes a prioriser",
        "",
        "| Commune | DAE | 24/7 | Public | Priorite | Points d'attention |",
        "| --- | ---: | ---: | ---: | --- | --- |",
    ]
    for row in top_rows:
        attention = (row["points_attention"] or "-").replace(" | ", "; ").replace("|", "; ")
        lines.append(
            f"| {row['commune']} | {row['nb_dae']} | {row['nb_dae_24_7']} | "
            f"{row['nb_dae_accessibles_public']} | {row['priorite_besoin']} | {attention} |"
        )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Construit une vue d'ensemble des defibrillateurs par commune pour l'Eure."
    )
    parser.add_argument("geodae_export", type=Path, help="Export CSV ou GeoJSON de Géo'DAE.")
    parser.add_argument(
        "--communes",
        type=Path,
        default=COMMUNES_CSV,
        help="CSV des communes de l'Eure avec e-mails de mairie.",
    )
    parser.add_argument(
        "--output-csv",
        type=Path,
        default=Path("eure_defibrillateurs_communes.csv"),
        help="Fichier CSV de sortie.",
    )
    parser.add_argument(
        "--output-md",
        type=Path,
        default=Path("eure_defibrillateurs_synthese.md"),
        help="Fichier Markdown de synthese.",
    )
    args = parser.parse_args()

    communes_by_key, ordered_communes, aliases = load_communes(args.communes)
    geodae_rows = load_geodae(args.geodae_export)
    rows, discarded = build_rows(geodae_rows, communes_by_key, ordered_communes, aliases)
    write_csv(args.output_csv, rows)
    write_markdown(args.output_md, rows, discarded)

    print(f"CSV genere : {args.output_csv}")
    print(f"Synthese generee : {args.output_md}")
    print(f"Communes traitees : {len(rows)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
