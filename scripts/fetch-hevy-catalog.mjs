/**
 * Extract Hevy's built-in exercise catalog (ids, media URLs, instructions)
 * from the hevy.com web app bundle. The public REST API omits video URLs.
 *
 * Usage: node scripts/fetch-hevy-catalog.mjs
 */
import { writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../lib/seed/hevy-catalog.json");

const MEDIA_HOSTS = [
  "d2l9nsnmtah87f.cloudfront.net",
  "pump-app.s3.eu-west-2.amazonaws.com",
];

function normalizeMediaUrl(url) {
  if (!url) return undefined;
  return url.replace(
    "d2l9nsnmtah87f.cloudfront.net",
    "pump-app.s3.eu-west-2.amazonaws.com",
  );
}

async function fetchAppBundle() {
  const html = await fetch("https://hevy.com").then((r) => r.text());
  const match = html.match(
    /src="(\/_next\/static\/chunks\/pages\/_app-[^"]+\.js)"/,
  );
  if (!match) throw new Error("Could not find Hevy _app bundle");
  const url = new URL(match[1], "https://hevy.com").href;
  return fetch(url).then((r) => r.text());
}

function extractCatalog(js) {
  const marker = "var R=JSON.parse('";
  const start = js.indexOf(marker);
  if (start < 0) {
    throw new Error("Exercise catalog JSON.parse block not found in bundle");
  }
  let i = start + marker.length;
  while (i < js.length) {
    const ch = js[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === "'") break;
    i += 1;
  }
  const expr = js.slice(start + "var R=".length, i + 2);
  return eval(expr);
}

async function main() {
  const js = await fetchAppBundle();
  const raw = extractCatalog(js);

  const catalog = raw.map((e) => ({
    id: e.id,
    title: e.title,
    muscle_group: e.muscle_group,
    other_muscles: e.other_muscles ?? [],
    exercise_type: e.exercise_type,
    equipment_category: e.equipment_category,
    videoUrl: normalizeMediaUrl(e.url),
    thumbnailUrl: normalizeMediaUrl(e.thumbnail_url),
    media_type: e.media_type,
    category: e.category,
    instructions: e.localised_instructions?.en
      ? e.localised_instructions.en
          .split("\\n")
          .map((s) => s.replace(/^\d+\\\\?\.\s*/, "").trim())
          .filter(Boolean)
      : [],
  }));

  const machine = catalog.filter((e) => e.equipment_category === "machine");
  const withVideo = catalog.filter((e) => e.videoUrl);

  await writeFile(
    OUT,
    JSON.stringify(
      {
        fetchedAt: new Date().toISOString(),
        mediaHosts: MEDIA_HOSTS,
        exercises: catalog,
      },
      null,
      2,
    ) + "\n",
  );

  console.log(
    `Wrote ${catalog.length} exercises (${machine.length} machine, ${withVideo.length} with video) -> ${OUT}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
