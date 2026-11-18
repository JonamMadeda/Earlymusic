/**
 * Writes public/android-latest.json from android/twa-manifest.json so the
 * in-app installer banner and the APK can never disagree — the manifest is the
 * only place a version is set.
 *
 *     npm run android:latest              # bump the pointer after editing the manifest
 *     npm run android:check [tag]         # verify pointer, checksum and tag agree
 *
 * Bubblewrap's own key is `appVersion` (it becomes the APK's versionName);
 * `appVersionCode` is the integer Android compares when installing over.
 * Override the release host with ANDROID_RELEASE_BASE (e.g. a custom domain).
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The canonical filename Bubblewrap emits. The URL carries the tag rather than
// using `releases/latest`, because `latest` is repo-global: the next web-app
// release would outrank this one and hand the banner a 404.
const ASSET_NAME = "app-release-signed.apk";

const repoFromRemote = () => {
  if (process.env.ANDROID_RELEASE_BASE) return process.env.ANDROID_RELEASE_BASE.replace(/\/+$/, "");
  const url = execFileSync("git", ["config", "--get", "remote.origin.url"], { cwd: root })
    .toString()
    .trim();
  const match = url.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
  if (!match) throw new Error(`Could not read owner/repo from git remote: ${url}`);
  return `https://github.com/${match[1]}`;
};

const manifestPath = path.join(root, "android", "twa-manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

if (!manifest.appVersion || !Number.isInteger(manifest.appVersionCode)) {
  throw new Error("android/twa-manifest.json needs appVersion and integer appVersionCode");
}

const base = repoFromRemote();
const tag = `android-v${manifest.appVersion}`;

const latest = {
  versionName: manifest.appVersion,
  versionCode: manifest.appVersionCode,
  packageName: manifest.packageId,
  apkUrl: `${base}/releases/download/${tag}/${ASSET_NAME}`,
  releaseUrl: `${base}/releases/tag/${tag}`,
};

const target = path.join(root, "public", "android-latest.json");

if (process.argv.includes("--check")) {
  const problems = [];

  const expectedChecksum = createHash("sha1").update(await readFile(manifestPath)).digest("hex");
  const storedChecksum = await readFile(
    path.join(root, "android", "manifest-checksum.txt"),
    "utf8",
  ).catch(() => "");
  // A stale checksum makes `bubblewrap build` ask whether to regenerate the
  // project, which no headless runner can answer.
  if (storedChecksum.trim() !== expectedChecksum) {
    problems.push("android/manifest-checksum.txt is stale — run `cd android && bubblewrap update --skipVersionUpgrade`");
  }

  const onDisk = await readFile(target, "utf8").catch(() => null);
  if (onDisk === null) {
    problems.push(`${path.relative(root, target)} is missing — run \`npm run android:latest\``);
  } else if (JSON.stringify(JSON.parse(onDisk)) !== JSON.stringify(latest)) {
    problems.push(`${path.relative(root, target)} does not match android/twa-manifest.json — run \`npm run android:latest\``);
  }

  const requestedTag = process.argv.find((arg, i) => i > 2 && !arg.startsWith("--"));
  if (requestedTag && requestedTag !== tag) {
    problems.push(`release tag ${requestedTag} does not match ${tag} (appVersion in the manifest)`);
  }

  if (problems.length) {
    console.error(`Android release pointers are out of sync:\n${problems.map((p) => ` - ${p}`).join("\n")}`);
    process.exitCode = 1;
  } else {
    console.log(`Android release pointers are in sync (${tag}, versionCode ${latest.versionCode}).`);
  }
} else {
  await writeFile(target, `${JSON.stringify(latest, null, 2)}\n`);
  console.log(`android-latest.json -> ${latest.versionName} (${latest.releaseUrl})`);
}
