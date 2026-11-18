import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  acknowledgeRecord,
  decideInstallerBanner,
  isAndroidInstallerHost,
  isValidRelease,
  readRecord,
} from "../lib/androidUpdate";

const root = path.resolve(fileURLToPath(import.meta.url), "..", "..");
const manifest = JSON.parse(
  readFileSync(path.join(root, "android", "twa-manifest.json"), "utf8"),
);
const latest = JSON.parse(
  readFileSync(path.join(root, "public", "android-latest.json"), "utf8"),
);

const release = {
  versionName: "1.1.0",
  versionCode: 2,
  packageName: "com.luumbo.twa",
  apkUrl: "https://github.com/JonamMadeda/Earlymusic/releases/latest/download/app-release-signed.apk",
  releaseUrl: "https://github.com/JonamMadeda/Earlymusic/releases/tag/android-v1.1.0",
};

const eligible = { eligible: true };

describe("android installer banner eligibility", () => {
  it("only fires inside an installed Android shell", () => {
    expect(
      isAndroidInstallerHost({ userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/120", standalone: true }),
    ).toBe(true);
    expect(
      isAndroidInstallerHost({ userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/120", standalone: false }),
    ).toBe(false);
    expect(
      isAndroidInstallerHost({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)", standalone: true }),
    ).toBe(false);
    expect(isAndroidInstallerHost({ userAgent: "Mozilla/5.0 (Macintosh)" })).toBe(false);
  });

  it("rejects a release pointer without a downloadable https installer", () => {
    expect(isValidRelease(release)).toBe(true);
    expect(isValidRelease(null)).toBe(false);
    expect(isValidRelease({ versionName: "", apkUrl: release.apkUrl })).toBe(false);
    expect(isValidRelease({ versionName: "1.1.0", apkUrl: "http://example.com/a.apk" })).toBe(false);
  });
});

describe("android installer banner decisions", () => {
  it("skips entirely when ineligible or unresolvable", () => {
    expect(decideInstallerBanner({ release, record: null, eligible: false })).toEqual({
      action: "skip",
      record: null,
    });
    expect(decideInstallerBanner({ release: null, record: null, ...eligible })).toEqual({
      action: "skip",
      record: null,
    });
  });

  it("adopts the first version it ever sees without a banner", () => {
    const decision = decideInstallerBanner({ release, record: null, ...eligible });
    expect(decision.action).toBe("adopt");
    expect(decision.versionName).toBe("1.1.0");
    expect(readRecord(decision.record)).toEqual({ versionName: "1.1.0", acknowledged: true });
  });

  it("offers a newer installer and keeps it offered until dismissed", () => {
    const first = decideInstallerBanner({
      release,
      record: { versionName: "1.0.0", acknowledged: true },
      ...eligible,
    });
    expect(first.action).toBe("offer");
    expect(first.apkUrl).toBe(release.apkUrl);
    expect(first.releaseUrl).toBe(release.releaseUrl);
    expect(readRecord(first.record)).toEqual({ versionName: "1.1.0", acknowledged: false });

    const reshown = decideInstallerBanner({
      release,
      record: { versionName: "1.1.0", acknowledged: false },
      ...eligible,
    });
    expect(reshown.action).toBe("offer");
    expect(reshown.record).toBeNull();
  });

  it("holds once dismissed, and re-offers when the next version ships", () => {
    const dismissed = readRecord(acknowledgeRecord("1.1.0"));
    expect(
      decideInstallerBanner({ release, record: dismissed, ...eligible }),
    ).toEqual({ action: "hold", record: null });

    const newer = { ...release, versionName: "1.2.0" };
    expect(
      decideInstallerBanner({ release: newer, record: dismissed, ...eligible }).action,
    ).toBe("offer");
  });

  it("treats a corrupt record as no record", () => {
    expect(readRecord("not json")).toBeNull();
    expect(readRecord('{"at":1}')).toBeNull();
    expect(readRecord(null)).toBeNull();
  });
});

describe("android-latest.json matches what ships", () => {
  it("mirrors the Bubblewrap manifest", () => {
    expect(latest.versionName).toBe(manifest.appVersion);
    expect(latest.versionCode).toBe(manifest.appVersionCode);
    expect(latest.packageName).toBe(manifest.packageId);
  });

  it("points at the tagged release asset, never repo-global latest", () => {
    expect(latest.apkUrl).toMatch(
      /^https:\/\/github\.com\/[^/]+\/[^/]+\/releases\/download\/android-v[^/]+\/app-release-signed\.apk$/,
    );
    expect(latest.apkUrl).toContain(`android-v${latest.versionName}`);
    expect(latest.releaseUrl).toMatch(
      new RegExp(`^https://github\\.com/[^/]+/[^/]+/releases/tag/android-v${latest.versionName.replace(/\./g, "\\.")}$`),
    );
  });

  it("keeps the manifest checksum in sync so bubblewrap build never prompts", () => {
    const sum = createHash("sha1").update(
      readFileSync(path.join(root, "android", "twa-manifest.json")),
    ).digest("hex");
    expect(readFileSync(path.join(root, "android", "manifest-checksum.txt"), "utf8")).toBe(sum);
  });

  it("declares the version Android needs to allow install-over", () => {
    expect(Number.isInteger(manifest.appVersionCode)).toBe(true);
    expect(manifest.minSdkVersion).toBeGreaterThanOrEqual(24);
  });
});
