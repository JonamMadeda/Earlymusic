/**
 * Period helpers for Library → Highlights.
 *
 * Highlights rank by the number of plays inside a calendar period (local
 * time), never by listening duration. The caller fetches `play_events` since
 * the start of the year and hands them to `summarizePlays`; this module keeps
 * the boundary math and the leaderboard rule in one testable place.
 */

export const HIGHLIGHT_PERIODS = [
  {
    key: "day",
    label: "Day",
    heading: "Song of the day",
    range: "Today",
    empty: "No plays yet today",
  },
  {
    key: "week",
    label: "Week",
    heading: "Song of the week",
    range: "This week",
    empty: "No plays yet this week",
  },
  {
    key: "month",
    label: "Month",
    heading: "Song of the month",
    range: "This month",
    empty: "No plays yet this month",
  },
  {
    key: "year",
    label: "Year",
    heading: "Song of the year",
    range: "This year",
    empty: "No plays yet this year",
  },
];

export const PICK_PERIODS = [
  { key: "day", label: "Day", heading: "Pick of the day", range: "Today" },
  { key: "week", label: "Week", heading: "Pick of the week", range: "This week" },
  { key: "month", label: "Month", heading: "Pick of the month", range: "This month" },
  { key: "year", label: "Year", heading: "Pick of the year", range: "This year" },
];

export const PICK_PERIOD_KEYS = PICK_PERIODS.map((period) => period.key);

/** Start of the local calendar period containing `now`. Week starts Monday. */
export function periodStart(period, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "week") {
    // getDay(): Sunday = 0 … Saturday = 6. Shift so Monday = 0.
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  } else if (period === "month") {
    start.setDate(1);
  } else if (period === "year") {
    start.setMonth(0, 1);
  }
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * Build one leaderboard per period from raw play events.
 *
 * Event shape: `{ song_id, played_at }`. Every row is one real play. Lifetime
 * counters such as `recently_played.play_count` must never be passed in here:
 * they have no period, so they would make the newest song win every card.
 *
 * Returns `[{ ...period, song, plays, lastPlayedAt }]`, with `song` null when
 * nothing was played in that period. Ties go to the most recently played
 * song, then alphabetically by title so the result is stable.
 */
export function summarizePlays(events, songs, now = new Date()) {
  const byId = new Map((songs || []).map((song) => [String(song.id), song]));
  const starts = new Map(
    HIGHLIGHT_PERIODS.map((period) => [period.key, periodStart(period.key, now).getTime()])
  );
  const buckets = new Map(HIGHLIGHT_PERIODS.map((period) => [period.key, new Map()]));

  for (const event of events || []) {
    const song = byId.get(String(event?.song_id));
    if (!song) continue;
    const playedAt = Date.parse(event?.played_at);
    if (Number.isNaN(playedAt)) continue;

    for (const period of HIGHLIGHT_PERIODS) {
      if (playedAt < starts.get(period.key)) continue;
      const bucket = buckets.get(period.key);
      const key = String(song.id);
      const current = bucket.get(key) || { song, plays: 0, lastPlayedAt: 0 };
      current.plays += 1;
      if (playedAt > current.lastPlayedAt) current.lastPlayedAt = playedAt;
      bucket.set(key, current);
    }
  }

  return HIGHLIGHT_PERIODS.map((period) => {
    const leader = [...buckets.get(period.key).values()].sort(
      (a, b) =>
        b.plays - a.plays ||
        b.lastPlayedAt - a.lastPlayedAt ||
        String(a.song.title || "").localeCompare(String(b.song.title || ""))
    )[0];

    return {
      ...period,
      song: leader?.song || null,
      plays: leader?.plays || 0,
      lastPlayedAt: leader?.lastPlayedAt || 0,
    };
  });
}
