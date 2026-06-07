import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, "..", "public", "icons");

const svg = await readFile(join(iconsDir, "icon.svg"));

// Standard "any" icons (full-bleed rounded square).
for (const size of [192, 512]) {
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(join(iconsDir, `icon-${size}.png`));
  console.log(`wrote icon-${size}.png`);
}

// Maskable icon: render the art at ~72% on a solid safe-zone background.
const maskableBg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#0b3d91"/></svg>`,
);
const inner = await sharp(svg, { density: 384 }).resize(368, 368).png().toBuffer();
await sharp(maskableBg)
  .composite([{ input: inner, top: 72, left: 72 }])
  .png()
  .toFile(join(iconsDir, "icon-maskable-512.png"));
console.log("wrote icon-maskable-512.png");

// Apple touch icon is just the 192 "any" icon, already written.
console.log("done");
