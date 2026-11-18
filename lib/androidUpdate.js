// Decides whether to surface the Android installer update banner.
//
// The web layer cannot read the versionCode of the installed APK, so "you are
// out of date" is not answerable here. What is answerable is "the installer we
// publish changed since we last told you". The first published version we ever
// see is the one an install shipped with, so it is acknowledged silently —
// otherwise every listener is told to install the build they already run.

export const UPDATE_RECORD_KEY = "luumbo-android-installer-seen";

const ANDROID_AGENT = /android/i;

export const isAndroidInstallerHost = ({ userAgent = "", standalone = false }) =>
  standalone === true && ANDROID_AGENT.test(userAgent);

export const isValidRelease = (release) =>
  Boolean(
    release &&
      typeof release.versionName === "string" &&
      release.versionName.length > 0 &&
      typeof release.apkUrl === "string" &&
      release.apkUrl.startsWith("https://"),
  );

const serialize = (versionName, acknowledged) =>
  JSON.stringify({ versionName, acknowledged });

export const readRecord = (raw) => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.versionName !== "string") return null;
    return { versionName: parsed.versionName, acknowledged: parsed.acknowledged === true };
  } catch {
    return null;
  }
};

// Marks the current published version as handled, so it stops being offered.
export const acknowledgeRecord = (versionName) => serialize(versionName, true);

/**
 * @param {{release: object|null, record: {versionName: string, acknowledged: boolean}|null, eligible: boolean}} input
 * @returns {{action: "skip"|"adopt"|"hold"|"offer", versionName?: string, apkUrl?: string, releaseUrl?: string, record: string|null}}
 */
export const decideInstallerBanner = ({ release, record, eligible }) => {
  if (!eligible || !isValidRelease(release)) return { action: "skip", record: null };
  if (!record) {
    return {
      action: "adopt",
      versionName: release.versionName,
      record: serialize(release.versionName, true),
    };
  }

  const offer = {
    action: "offer",
    versionName: release.versionName,
    apkUrl: release.apkUrl,
    releaseUrl: release.releaseUrl,
  };

  // A newer installer resets the dismissal, so it is offered again.
  if (record.versionName !== release.versionName) {
    return { ...offer, record: serialize(release.versionName, false) };
  }

  if (record.acknowledged) return { action: "hold", record: null };

  // Seen but never dismissed: keep it visible rather than let an update slip by.
  return { ...offer, record: null };
};
