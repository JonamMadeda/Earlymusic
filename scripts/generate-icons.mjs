/**
 * Rasterize the SVG icon sources in scripts/assets into the PNG/ICO assets
 * used by the app, PWA manifest, and favicon.
 *
 * Run from the repo root:
 *
 *     node scripts/generate-icons.mjs
 */

import { execFileSync } from "node:child_process";
import { copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assets = path.join(root, "scripts", "assets");
const icons = path.join(root, "public", "icons");

const jobs = [
  // App icon (wordmark) — "any" purpose.
  ["icon.svg", 512, "icon-512x512.png"],
  ["icon.svg", 192, "icon-192x192.png"],

  // Maskable icons — full-bleed art with the wordmark inside the safe zone.
  ["maskable.svg", 512, "maskable-icon-512x512.png"],
  ["maskable.svg", 192, "maskable-icon-192x192.png"],

  // Small mark (L monogram) — favicon and in-app brand mark.
  ["mark.svg", 16, "favicon-16x16.png"],
  ["mark.svg", 32, "favicon-32x32.png"],
  ["mark.svg", 48, "favicon-48x48.png"],
  ["mark.svg", 64, "favicon-64x64.png"],
];

for (const [source, size, output] of jobs) {
  await sharp(path.join(assets, source))
    .resize(size, size)
    .png()
    .toFile(path.join(icons, output));
  console.log(`Wrote public/icons/${output}`);
}

// iOS does not support transparency in touch icons; flatten onto white.
await sharp(path.join(assets, "icon.svg"))
  .resize(180, 180)
  .flatten({ background: "#ffffff" })
  .png()
  .toFile(path.join(icons, "apple-touch-icon.png"));
console.log("Wrote public/icons/apple-touch-icon.png");

// Copy the vector mark into public/ for the in-app brand component.
await copyFile(path.join(assets, "mark.svg"), path.join(icons, "mark.svg"));
console.log("Wrote public/icons/mark.svg");

// ICO packaging needs a small Pillow step; the PNG sources above are already
// rendered, so this only bundles them for /favicon.ico.
execFileSync("python", [path.join(root, "scripts", "pack-favicon.py")], {
  stdio: "inherit",
});
