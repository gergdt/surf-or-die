import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const svg = path.join(root, "public/icons/icon.svg");
const out = path.join(root, "public/icons");

const sizes = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "icon-maskable-512.png", size: 512, maskable: true },
];

for (const { name, size, maskable } of sizes) {
  const pad = maskable ? Math.round(size * 0.1) : 0;
  const inner = size - pad * 2;
  let img = sharp(svg).resize(inner, inner);
  if (pad > 0) {
    img = await img
      .extend({
        top: pad,
        bottom: pad,
        left: pad,
        right: pad,
        background: { r: 14, g: 23, b: 38, alpha: 1 },
      })
      .toBuffer()
      .then((buf) => sharp(buf));
  }
  await img.png().toFile(path.join(out, name));
  console.log(`wrote ${name}`);
}
