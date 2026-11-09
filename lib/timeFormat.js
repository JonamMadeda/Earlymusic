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