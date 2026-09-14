// Single source of truth for the "New" badge + Fresh Releases.
// "New" = the 15 most recently added songs by created_at, not a time window.

export const NEW_SONGS_COUNT = 15;

export function getNewestSongs(songs, count = NEW_SONGS_COUNT) {
  if (!Array.isArray(songs) || songs.length === 0) return [];
  return [...songs]
    .sort(
      (a, b) =>
        new Date(b?.created_at || 0).getTime() -
        new Date(a?.created_at || 0).getTime()
    )
    .slice(0, count);
}

export function getNewSongIds(songs, count = NEW_SONGS_COUNT) {
  return new Set(getNewestSongs(songs, count).map((s) => s?.id).filter(Boolean));
}

export function isNewSong(song, allSongs, count = NEW_SONGS_COUNT) {
  if (!song?.id || !Array.isArray(allSongs) || allSongs.length === 0) return false;
  // Rank-based check: song is within the N most recent by created_at.
  const newest = getNewestSongs(allSongs, count);
  return newest.some((s) => s.id === song.id);
}
