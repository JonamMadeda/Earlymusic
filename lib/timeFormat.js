// `songs.duration` is a text column and is null on rows uploaded before the
// field existed, so every consumer parses defensively instead of trusting a
// number. Anything unparseable is "unknown", never zero — a queue total that
// silently counted missing tracks as 0:00 would understate a worship set.
export const toSeconds = (value) => {
  if (value == null || value === "") return null;
  const seconds = typeof value === "number" ? value : Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
};

export const formatTime = (value) => {
  const total = toSeconds(value);
  if (total == null) return "0:00";

  const whole = Math.floor(total);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const seconds = whole % 60;
  const pad = (n) => String(n).padStart(2, "0");

  // Long sets read as 1:30:00, not 90:00.
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
};

// Worship sets run long, so the formatted length is the cue that tells a quick
// song from an extended session. Rows uploaded before lengths were stored only
// carry the legacy "Short"/"Long" label, which is still better than nothing.
// Unknown stays null so callers render no cue rather than a misleading 0:00.
export const sessionLengthLabel = (song) => {
  const seconds = toSeconds(song?.duration);
  if (seconds != null && seconds > 0) return formatTime(seconds);
  const label = typeof song?.duration === "string" ? song.duration.trim() : "";
  if (/^short$/i.test(label)) return "Short";
  if (/^long$/i.test(label)) return "Long";
  return null;
};

// Homepage cards keep real times but hide the legacy Short/Long words: in a
// rail they read like extra tags and repeat the category/filter pills.
export const homepageLengthLabel = (song) => {
  const label = sessionLengthLabel(song);
  return label === "Short" || label === "Long" ? null : label;
};

export const sumDurations = (songs) => {
  const list = Array.isArray(songs) ? songs : [];
  let seconds = 0;
  let known = 0;
  for (const song of list) {
    const value = toSeconds(song?.duration);
    if (value == null) continue;
    seconds += value;
    known += 1;
  }
  return { seconds, known, total: list.length };
};