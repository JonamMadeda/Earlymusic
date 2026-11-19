/**
 * Render the TWA splash screens under android/app/src/main/res.
 *
 * Bubblewrap derives these from the launcher icon, so the startup screen shows
 * the icon's squircle card and hairline border floating on the splash
 * background. This takes just the wordmark out of scripts/assets/icon.svg and
 * centres it, so the card stays where it belongs — on the launcher.
 *
 * Run after every `bubblewrap update`, which overwrites the PNGs:
 *
 *     node scripts/generate-android-splash.mjs         # write
 *     node scripts/generate-android-splash.mjs --check  # fail if they drifted
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconSource = path.join(root, "scripts", "assets", "icon.svg");
const resDir = path.join(root, "android", "app", "src", "main", "res");

// Bubblewrap's own sizes: a 300dp square, one per density bucket. The shell
// draws the splash unscaled and centred, so the file size is the on-screen size.
const buckets = [
  ["mdpi", 300],
  ["hdpi", 450],
  ["xhdpi", 600],
  ["xxhdpi", 900],
  ["xxxhdpi", 1200],
];

// Share of that square the wordmark spans.
const MARK_WIDTH = 0.66;
const MARK_COLOR = "#0f172a";

const wordmark = async () => {
  const svg = await readFile(iconSource, "utf8");
  const stripped = svg
    .replace(/\s*<clipPath id="clip">[\s\S]*?<\/clipPath>/, "")
    .replace(/\s*<use href="#squircle"[^>]*\/>/g, "")
    .replace(/fill="#000000"/, `fill="${MARK_COLOR}"`);
  if (stripped.includes("#squircle") || !stripped.includes(MARK_COLOR)) {
    throw new Error(
      "scripts/assets/icon.svg no longer has the shape this script expects " +
        "(squircle uses and a single black fill). Update generate-android-splash.mjs."
    );
  }
  // Rendered at 8x so the vector is resampled down rather than up.
  return sharp(Buffer.from(stripped), { density: 576 })
    .png()
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 2 })
    .toBuffer({ resolveWithObject: true });
};

const render = async (size, mark) => {
  const scaled = await sharp(mark.data)
    .resize(Math.round(size * MARK_WIDTH))
    .png()
    .toBuffer({ resolveWithObject: true });
  const width = scaled.info.width;
  const height = scaled.info.height;
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: scaled.data,
        left: Math.round((size - width) / 2),
        top: Math.round((size - height) / 2),
      },
    ])
    .png()
    .toBuffer();
};

const check = process.argv.includes("--check");
const mark = await wordmark();

for (const [dpi, size] of buckets) {
  const file = path.join(resDir, `drawable-${dpi}`, "splash.png");
  const png = await render(size, mark);
  if (!check) {
    await writeFile(file, png);
    console.log(`Wrote android/app/src/main/res/drawable-${dpi}/splash.png`);
    continue;
  }
  const current = await readFile(file).catch(() => null);
  if (!current?.equals(png)) {
    console.error(
      `${path.relative(root, file)} is not the generated splash art. ` +
        "Run `npm run android:splash` and commit the result."
    );
    process.exitCode = 1;
  }
}

if (check && !process.exitCode) console.log("Splash art matches scripts/assets/icon.svg.");
