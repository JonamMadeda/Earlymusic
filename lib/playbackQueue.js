// Queue advance rules, kept out of the player component so the repeat modes
// can be tested without mounting an audio element.
//
// `playedIds` is the shuffle pass: the chosen id is added to it, and it is
// cleared when a repeating shuffle starts a new pass. `skipIds` holds tracks
// that failed to play and must not be retried during this cycle.
export const pickNextSong = ({
  songs,
  currentId,
  isShuffle = false,
  repeatMode = "off",
  skipIds = null,
  playedIds = null,
  random = Math.random,
}) => {
  if (!Array.isArray(songs) || songs.length === 0) return null;

  // Repeat off means the queue has an end; "all" wraps, "one" loops natively
  // and never asks for a next track.
  const wrap = repeatMode === "all";
  const blocked = (item) =>
    !item || item.id === currentId || skipIds?.has(item.id);

  const takeRandom = (pool) => {
    if (pool.length === 0) return null;
    const picked = pool[Math.floor(random() * pool.length)];
    playedIds?.add(picked.id);
    return picked;
  };

  if (isShuffle) {
    const fresh = songs.filter((item) => !blocked(item) && !playedIds?.has(item.id));
    if (fresh.length > 0) return takeRandom(fresh);
    if (!wrap) return null;
    playedIds?.clear();
    const pool = songs.filter((item) => !blocked(item));
    if (pool.length > 0) return takeRandom(pool);
    // Repeat-all on a single-track queue wraps onto the current song.
    const current = songs.find((item) => item?.id === currentId && !skipIds?.has(item.id));
    return current ? takeRandom([current]) : null;
  }

  // start === -1 (song not in this queue) maps to the first track.
  const start = songs.findIndex((item) => item?.id === currentId);
  const last = songs.length - 1;
  for (let step = 1; step <= songs.length; step += 1) {
    const raw = start + step;
    if (raw > last && !wrap) return null;
    const candidate = songs[((raw % songs.length) + songs.length) % songs.length];
    if (blocked(candidate)) continue;
    return candidate;
  }
  // Repeat-all wraps to the current song when it is the only candidate left.
  if (wrap) {
    return songs.find((item) => item?.id === currentId && !skipIds?.has(item.id)) || null;
  }
  return null;
};