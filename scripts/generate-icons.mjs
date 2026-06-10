/**
 * Derives every app/PWA icon from one master, so all icons stay consistent.
 *   node scripts/generate-icons.mjs
 *
 * Master (committed, source of truth): public/icons/icon-512.png
 *   — the Pentix pushup mark, deep green on a transparent background, 512x512.
 *
 * Outputs:
 *   public/icons/icon-192.png            transparent, PWA "any"
 *   public/icons/icon-maskable-512.png   white bg + safe-zone, PWA "maskable"
 *   public/icons/mark.png                tight-cropped figure, for the in-app logo mask
 *   src/app/icon.png                     Next.js tab-icon convention
 *   src/app/apple-icon.png               Next.js apple-touch-icon convention (opaque — iOS ignores alpha)
 *
 * Kept as-is: src/app/favicon.ico (multi-resolution .ico).
 */
import sharp from "sharp";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const master = join(root, "public", "icons", "icon-512.png");
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

// transparent derivatives
await sharp(master).resize(192, 192).png().toFile(join(root, "public", "icons", "icon-192.png"));
await sharp(master).resize(512, 512).png().toFile(join(root, "src", "app", "icon.png"));

// tight-cropped mark for the header logo (the figure floats in whitespace otherwise)
await sharp(master)
  .trim()
  .png()
  .toFile(join(root, "public", "icons", "mark.png"));

// maskable: figure at ~78% on a white safe-zone tile
const safe = Math.round(512 * 0.78);
const fig = await sharp(master).resize(safe, safe, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: WHITE } })
  .composite([{ input: fig, gravity: "center" }])
  .png()
  .toFile(join(root, "public", "icons", "icon-maskable-512.png"));

// apple-touch-icon: opaque white bg (iOS composites alpha onto black otherwise)
await sharp(master)
  .resize(180, 180)
  .flatten({ background: WHITE })
  .png()
  .toFile(join(root, "src", "app", "apple-icon.png"));

const mark = await sharp(join(root, "public", "icons", "mark.png")).metadata();
console.log("✓ icons regenerated from public/icons/icon-512.png");
console.log(`  in-app mark aspect: ${mark.width}x${mark.height} (${(mark.width / mark.height).toFixed(3)})`);
