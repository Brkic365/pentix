/**
 * One-time PWA icon generation (outputs are committed):
 *   node scripts/generate-icons.mjs
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Pentagon (penta = 5) around the base unit of the whole economy: 5.
// Art sits inside the maskable safe zone (~80% of canvas).
const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#ffffff"/>
  <polygon points="256,70 432,198 365,406 147,406 80,198" fill="#15803d"/>
  <text x="256" y="350" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-weight="900"
        font-size="230" fill="#ffffff">5</text>
</svg>`;

const src = Buffer.from(svg);
mkdirSync(join(root, "public", "icons"), { recursive: true });

const jobs = [
  { out: join(root, "public", "icons", "icon-192.png"), size: 192 },
  { out: join(root, "public", "icons", "icon-512.png"), size: 512 },
  { out: join(root, "src", "app", "apple-icon.png"), size: 180 },
  { out: join(root, "src", "app", "icon.png"), size: 512 },
];

for (const { out, size } of jobs) {
  await sharp(src).resize(size, size).png().toFile(out);
  console.log("✓", out);
}
