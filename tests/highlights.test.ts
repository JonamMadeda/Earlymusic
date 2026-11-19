import { describe, expect, it } from "vitest";
import { HIGHLIGHT_PERIODS, periodStart, summarizePlays } from "../lib/highlights";

const song = (id: string, title = id) => ({ id, title, author: "Artist" });
const songs = [song("a", "Alpha"), song("b", "Bravo"), song("c", "Charlie")];

const localIso = (year: number, month: number, day: number, hour = 12) =>
  new Date(year, month, day, hour, 0, 0).toISOString();

describe("periodStart", () => {
  const now = new Date(2026, 10, 18, 15, 30, 0); // Wednesday 18 Nov 2026

  it("starts the day at local midnight", () => {
    expect(periodStart("day", now)).toEqual(new Date(2026, 10, 18, 0, 0, 0));
  });

  it("starts the week on Monday", () => {
    expect(periodStart("week", now)).toEqual(new Date(2026, 10, 16, 0, 0, 0));
    expect(periodStart("week", new Date(2026, 10, 22, 9))).toEqual(
      new Date(2026, 10, 16, 0, 0, 0)
    );
  });

  it("starts the month and the year", () => {
    expect(periodStart("month", now)).toEqual(new Date(2026, 10, 1, 0, 0, 0));
    expect(periodStart("year", now)).toEqual(new Date(2026, 0, 1, 0, 0, 0));
  });
});

describe("summarizePlays", () => {
  const now = new Date(2026, 10, 18, 15, 0, 0);

  it("names a different leader for each period", () => {
    const events = [
      { song_id: "b", played_at: localIso(2026, 10, 18) },
      { song_id: "b", played_at: localIso(2026, 10, 18) },
      { song_id: "a", played_at: localIso(2026, 10, 18) },
      { song_id: "b", played_at: localIso(2026, 10, 16) },
      { song_id: "c", played_at: localIso(2026, 10, 16) },
      { song_id: "c", played_at: localIso(2026, 10, 16) },
      { song_id: "a", played_at: localIso(2026, 10, 10) },
      { song_id: "c", played_at: localIso(2026, 9, 1) },
      { song_id: "c", played_at: localIso(2026, 9, 1) },
      { song_id: "c", played_at: localIso(2026, 9, 1) },
      { song_id: "c", played_at: localIso(2026, 9, 1) },
      { song_id: "c", played_at: localIso(2026, 9, 1) },
    ];

    const result = summarizePlays(events, songs, now);
    const byKey = Object.fromEntries(result.map((item) => [item.key, item]));

    expect(byKey.day.song?.id).toBe("b");
    expect(byKey.day.plays).toBe(2);
    expect(byKey.week.song?.id).toBe("b");
    expect(byKey.week.plays).toBe(3);
    expect(byKey.month.song?.id).toBe("b");
    expect(byKey.month.plays).toBe(3);
    expect(byKey.year.song?.id).toBe("c");
    expect(byKey.year.plays).toBe(7);
  });

  it("ignores unknown songs, invalid dates, and plays before the period", () => {
    const events = [
      { song_id: "ghost", played_at: localIso(2026, 10, 18) },
      { song_id: "a", played_at: "not-a-date" },
      { song_id: "a", played_at: localIso(2025, 11, 31) },
    ];
    const result = summarizePlays(events, songs, now);
    expect(result.every((item) => item.song === null && item.plays === 0)).toBe(true);
  });

  it("uses the most recent play as the tie-breaker", () => {
    const events = [
      { song_id: "a", played_at: localIso(2026, 10, 18, 9) },
      { song_id: "b", played_at: localIso(2026, 10, 18, 13) },
    ];
    const result = summarizePlays(events, songs, now);
    expect(result[0].song?.id).toBe("b");
    expect(result[0].plays).toBe(1);
  });

  it("accepts a count for the recently_played fallback", () => {
    const events = [
      { song_id: "a", played_at: localIso(2026, 10, 18), count: 5 },
      { song_id: "b", played_at: localIso(2026, 10, 18), count: 2 },
    ];
    const result = summarizePlays(events, songs, now);
    expect(result[0].song?.id).toBe("a");
    expect(result[0].plays).toBe(5);
  });

  it("returns every period shape when there are no plays", () => {
    const result = summarizePlays([], songs, now);
    expect(result.map((item) => item.key)).toEqual(HIGHLIGHT_PERIODS.map((item) => item.key));
    expect(result.every((item) => item.song === null)).toBe(true);
  });
});
