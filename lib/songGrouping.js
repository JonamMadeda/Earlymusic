// Grouping follows the active sort. A list sorted by artist must not be filed
// under title initials, and a date-sorted list has no alphabet at all.

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const groupKeyFor = (song, sortBy) => {
  if (sortBy === "created_at") {
    // A missing date is "unknown", not the Unix epoch — otherwise every song
    // without metadata would be filed under Jan 1970.
    if (!song?.created_at) return { key: "unknown", label: "Unknown date" };
    const date = new Date(song.created_at);
    if (Number.isNaN(date.getTime())) return { key: "unknown", label: "Unknown date" };
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return {
      key: `${date.getFullYear()}-${month}`,
      label: `${MONTHS[date.getMonth()]} ${date.getFullYear()}`,
    };
  }

  const field = sortBy === "author" ? song?.author : song?.title;
  const first = String(field || "").trim().charAt(0).toUpperCase();
  const letter = /\p{L}/u.test(first) ? first : "#";
  return { key: letter, label: letter };
};

// Insertion order is the caller's sort order, so descending sorts group
// descending too instead of being re-sorted back to A-Z.
export const groupSongs = (songs, sortBy) => {
  const groups = new Map();
  for (const song of Array.isArray(songs) ? songs : []) {
    const { key, label } = groupKeyFor(song, sortBy);
    if (!groups.has(key)) groups.set(key, { key, label, songs: [] });
    groups.get(key).songs.push(song);
  }
  return [...groups.values()];
};