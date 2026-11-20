/**
 * Render the TWA splash screens under android/app/src/main/res.
 *
 * Bubblewrap derives these from the launcher icon, so the startup screen shows
 * the icon's squircle card and hairline border floating on the splash
 * background. scripts/assets/splash.svg is just the "luumbo" wordmark on a
 * transparent canvas, so the card stays where it belongs — on the launcher.
 *
 * Run after every `bubblewrap update`, which overwrites the PNGs:
 *
 *     node scripts/generate-android-splash.mjs         # write
 *     node scripts/generate-android-splash.mjs --check  # fail if art or the
 *                                                       # Chrome 152 fix drifted
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const splashSource = path.join(root, "scripts", "assets", "splash.svg");
const resDir = path.join(root, "android", "app", "src", "main", "res");
const launcherSource = path.join(
  root,
  "android",
  "app",
  "src",
  "main",
  "java",
  "com",
  "luumbo",
  "twa",
  "LauncherActivity.java",
);

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
  const svg = await readFile(splashSource, "utf8");
  if (
    svg.includes("#squircle") ||
    svg.includes("<rect") ||
    !svg.includes(`fill="${MARK_COLOR}"`)
  ) {
    throw new Error(
      "scripts/assets/splash.svg must be the transparent luumbo wordmark only " +
        "(no squircle, no filled background, one #0f172a fill)."
    );
  }
  // Rendered at 8x so the vector is resampled down rather than up.
  return sharp(Buffer.from(svg), { density: 576 })
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

// Chrome 152+ rejects the splash hand-off unless the app holds a recorded read
// grant on its own FileProvider URI. bubblewrap update rewrites this Java file,
// so treat the grant as part of the splash art and fail CI if it disappears.
const checkLauncherGrant = async () => {
  const java = await readFile(launcherSource, "utf8");
  const call = java.indexOf("grantSplashUriPermission();");
  const onCreate = java.indexOf("super.onCreate(savedInstanceState);");
  const problems = [];
  if (call === -1 || onCreate === -1 || call > onCreate) {
    problems.push("grantSplashUriPermission() must run before super.onCreate()");
  }
  if (!java.includes("FLAG_GRANT_PERSISTABLE_URI_PERMISSION")) {
    problems.push("the splash URI grant needs FLAG_GRANT_PERSISTABLE_URI_PERMISSION");
  }
  if (!java.includes("twa_splash/splash_image.png")) {
    problems.push("the splash URI grant must point at twa_splash/splash_image.png");
  }
  if (problems.length) {
    console.error(
      `Chrome 152 splash fix missing from ${path.relative(root, launcherSource)}:\n` +
        problems.map((p) => ` - ${p}`).join("\n")
    );
    process.exitCode = 1;
  }
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

if (check) {
  await checkLauncherGrant();
  if (!process.exitCode) {
    console.log("Splash art and Chrome 152 transfer fix are in place.");
  }
}
