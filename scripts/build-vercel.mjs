import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(rootDir, "dist");
const versionBaseCommitCount = 33;
const versionBaseHundredths = 110;

const entries = [
  "index.html",
  "assets",
  "src",
  "store",
  "styles",
  "styles.css"
];

async function copyEntry(entry) {
  const source = join(rootDir, entry);
  const target = join(distDir, entry);
  const sourceStat = await stat(source);

  await mkdir(dirname(target), { recursive: true });
  await cp(source, target, {
    recursive: sourceStat.isDirectory(),
    force: true
  });
}

function gitValue(args, fallback = "") {
  try {
    return execFileSync("git", args, {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return fallback;
  }
}

function formatCommitDate(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "local";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris"
  }).format(date);
}

function getBuildInfo() {
  const commitCount = Number(gitValue(["rev-list", "--count", "HEAD"], String(versionBaseCommitCount)));
  const commitIsoDate = gitValue(["log", "-1", "--format=%cI"]);
  const shortHash = gitValue(["rev-parse", "--short", "HEAD"]);
  const versionHundredths = versionBaseHundredths + Math.max(0, (Number.isFinite(commitCount) ? commitCount : versionBaseCommitCount) - versionBaseCommitCount);
  const versionDecimal = (versionHundredths / 100).toFixed(2).replace(/0$/, "");
  const version = `v${versionDecimal}`;
  const dateLabel = formatCommitDate(commitIsoDate);

  return {
    dateLabel: shortHash ? `${dateLabel} (${shortHash})` : dateLabel,
    version
  };
}

async function injectBuildInfo() {
  const indexPath = join(distDir, "index.html");
  const buildInfo = getBuildInfo();
  let html = await readFile(indexPath, "utf8");

  html = html.replace(
    /<span class="logo-version"[^>]*>.*?<\/span>/,
    `<span class="logo-version" aria-label="Version ${buildInfo.version}">${buildInfo.version}</span>`
  );
  html = html.replace(
    /<small id="logoUpdateDate"[^>]*>.*?<\/small>/,
    `<small id="logoUpdateDate">${buildInfo.dateLabel}</small>`
  );

  await writeFile(indexPath, html);
}

function envValue(names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

async function injectSupabaseConfig() {
  const configPath = join(distDir, "src", "supabase-config.js");
  const config = {
    url: envValue([
      "SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
      "VITE_SUPABASE_URL",
      "PUBLIC_SUPABASE_URL"
    ]),
    anonKey: envValue([
      "SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "VITE_SUPABASE_ANON_KEY",
      "PUBLIC_SUPABASE_ANON_KEY"
    ])
  };

  await writeFile(
    configPath,
    `window.__COEURGO_SUPABASE_CONFIG__ = Object.freeze(${JSON.stringify(config)});\n`
  );
}

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

for (const entry of entries) {
  await copyEntry(entry);
}

await injectBuildInfo();
await injectSupabaseConfig();

console.log(`Vercel static build ready in ${distDir}`);
