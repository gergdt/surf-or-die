/**
 * Copy lib/seed/exercises.json → public/seed/exercises.v{SEED_VERSION}.json
 * so Next can serve it as a static asset instead of inlining it in client JS.
 *
 * Usage: node scripts/copy-exercise-seed.mjs
 */
import { copyFile, mkdir, readdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const SEED_TS = path.join(root, "lib/db/seed.ts");
const SEED_JSON = path.join(root, "lib/seed/exercises.json");
const PUBLIC_SEED_DIR = path.join(root, "public/seed");

export function parseSeedVersion(source) {
  const match = source.match(/export const SEED_VERSION = (\d+);/);
  if (!match) {
    throw new Error(`SEED_VERSION not found in ${SEED_TS}`);
  }
  return Number(match[1]);
}

export async function readSeedVersion() {
  const source = await readFile(SEED_TS, "utf8");
  return parseSeedVersion(source);
}

export async function bumpSeedVersion() {
  const source = await readFile(SEED_TS, "utf8");
  const current = parseSeedVersion(source);
  const next = current + 1;
  await writeSeedVersion(source, next);
  return next;
}

async function writeSeedVersion(source, version) {
  const updated = source.replace(
    /export const SEED_VERSION = \d+;/,
    `export const SEED_VERSION = ${version};`,
  );
  await writeFile(SEED_TS, updated, "utf8");
}

export async function copyExerciseSeed(version) {
  const destName = `exercises.v${version}.json`;
  const dest = path.join(PUBLIC_SEED_DIR, destName);
  await mkdir(PUBLIC_SEED_DIR, { recursive: true });
  await copyFile(SEED_JSON, dest);

  const files = await readdir(PUBLIC_SEED_DIR);
  await Promise.all(
    files
      .filter(
        (name) =>
          /^exercises\.v\d+\.json$/.test(name) && name !== destName,
      )
      .map((name) => unlink(path.join(PUBLIC_SEED_DIR, name))),
  );
  return dest;
}

async function main() {
  const version = await readSeedVersion();
  const dest = await copyExerciseSeed(version);
  console.log(`Copied exercise seed to ${dest}`);
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
