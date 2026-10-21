/**
 * List `.next/static/chunks` JS sizes after `next build`.
 * Turbopack-friendly alternative to webpack `@next/bundle-analyzer`.
 *
 * Usage:
 *   npm run build && npm run analyze
 *   ANALYZE=true npm run build && npm run analyze
 */
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { Writable } from "node:stream";

const CHUNKS_DIR = path.join(process.cwd(), ".next/static/chunks");
const LIMIT_BYTES = 500 * 1024;

async function gzipSize(filePath) {
  let size = 0;
  const counter = new Writable({
    write(chunk, _enc, cb) {
      size += chunk.length;
      cb();
    },
  });
  await pipeline(createReadStream(filePath), createGzip(), counter);
  return size;
}

function fmt(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

async function main() {
  if (process.env.ANALYZE === "true") {
    console.log(
      "ANALYZE=true: listing Turbopack chunk sizes (webpack bundle-analyzer is not wired; Next 16 production builds use Turbopack).",
    );
  }

  let entries;
  try {
    entries = await readdir(CHUNKS_DIR, { recursive: true });
  } catch {
    console.error(
      `No chunks at ${CHUNKS_DIR}. Run \`npm run build\` first.`,
    );
    process.exit(1);
  }

  const rows = [];
  for (const rel of entries) {
    if (!rel.endsWith(".js")) continue;
    const full = path.join(CHUNKS_DIR, rel);
    const info = await stat(full);
    if (!info.isFile()) continue;
    rows.push({
      file: rel,
      raw: info.size,
      gzip: await gzipSize(full),
    });
  }

  rows.sort((a, b) => b.raw - a.raw);

  console.log(
    `${"raw".padStart(10)}  ${"gzip".padStart(10)}  file`,
  );
  for (const row of rows) {
    console.log(
      `${fmt(row.raw).padStart(10)}  ${fmt(row.gzip).padStart(10)}  ${row.file}`,
    );
  }

  const totalRaw = rows.reduce((sum, row) => sum + row.raw, 0);
  const totalGzip = rows.reduce((sum, row) => sum + row.gzip, 0);
  console.log(
    `\n${rows.length} JS chunks  total ${fmt(totalRaw)} raw / ${fmt(totalGzip)} gzip`,
  );

  const oversized = rows.filter((row) => row.raw > LIMIT_BYTES);
  if (oversized.length) {
    console.error(
      `\nJS chunks over ${fmt(LIMIT_BYTES)} uncompressed:`,
    );
    for (const row of oversized) {
      console.error(`  ${row.file}  ${fmt(row.raw)} raw / ${fmt(row.gzip)} gzip`);
    }
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
