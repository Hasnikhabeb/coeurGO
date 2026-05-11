import { cp, mkdir, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(rootDir, "dist");

const entries = [
  "index.html",
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

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

for (const entry of entries) {
  await copyEntry(entry);
}

console.log(`Vercel static build ready in ${distDir}`);
