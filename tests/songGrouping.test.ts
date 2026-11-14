import { describe, expect, it } from "vitest";
import { groupKeyFor, groupSongs } from "../lib/songGrouping";

describe("song grouping", () => {
  it("files titles under their own initial", () => {
    expect(groupKeyFor({ title: "Alive", author: "Zoe" }, "title")).toEqual({
      key: "A",
      label: "A",
    });
  });

  it("files an artist-sorted list under the artist, not the title", () => {
    expect(groupKeyFor({ title: "Alive", author: "Zoe" }, "author")).toEqual({
      key: "Z",
      label: "Z",
    });
  });

  it("buckets non-letters and blanks together", () => {
    expect(groupKeyFor({ title: "59 Hallelujah" }, "title").key).toBe("#");
    expect(groupKeyFor({ title: "" }, "title").key).toBe("#");
    expect(groupKeyFor({}, "title").key).toBe("#");
    expect(groupKeyFor({ title: "ömür" }, "title").key).toBe("Ö");
  });

  it("groups dates by month with a readable label", () => {
    expect(groupKeyFor({ created_at: "2026-11-09T10:00:00Z" }, "created_at")).toEqual({
      key: "2026-11",
      label: "Nov 2026",
    });
    expect(groupKeyFor({ created_at: "nonsense" }, "created_at").key).toBe("unknown");
    expect(groupKeyFor({}, "created_at").key).toBe("unknown");
  });

  it("keeps the caller's order so a descending sort stays descending", () => {
    const songs = [{ title: "Zulu" }, { title: "Alpha" }, { title: "Bravo" }];
    expect(groupSongs(songs, "title").map((g) => g.key)).toEqual(["Z", "A", "B"]);
  });

  it("collects every song into exactly one group", () => {
    const songs = [
      { title: "Alpha", author: "Zoe" },
      { title: "Anthem", author: "Zoe" },
      { title: "Beta", author: "Adam" },
    ];
    const groups = groupSongs(songs, "author");
    expect(groups.map((g) => [g.key, g.songs.length])).toEqual([
      ["Z", 2],
      ["A", 1],
    ]);
    expect(groups.flatMap((g) => g.songs)).toHaveLength(3);
  });

  it("preserves descending title groups and each group's sorted rows", () => {
    const songs = [
      { id: "z", title: "Zulu" },
      { id: "b", title: "Beta" },
      { id: "an", title: "Anthem" },
      { id: "al", title: "Alpha" },
    ];
    const groups = groupSongs(songs, "title");
    expect(groups.map(({ key, label }) => [key, label])).toEqual([
      ["Z", "Z"], ["B", "B"], ["A", "A"],
    ]);
    expect(groups.flatMap((group) => group.songs.map((song) => song.id))).toEqual(["z", "b", "an", "al"]);
    expect(songs.map((song) => song.id)).toEqual(["z", "b", "an", "al"]);
  });

  it("keeps newest month/year groups ordered with unknown dates last", () => {
    const songs = [
      { id: "new", created_at: "2026-11-20T12:00:00Z" },
      { id: "same-month", created_at: "2026-11-10T12:00:00Z" },
      { id: "october", created_at: "2026-10-10T12:00:00Z" },
      { id: "last-year", created_at: "2025-11-10T12:00:00Z" },
      { id: "missing" },
      { id: "invalid", created_at: "not-a-date" },
    ];
    const groups = groupSongs(songs, "created_at");
    expect(groups.map(({ key, label }) => [key, label])).toEqual([
      ["2026-11", "Nov 2026"],
      ["2026-10", "Oct 2026"],
      ["2025-11", "Nov 2025"],
      ["unknown", "Unknown date"],
    ]);
    expect(groups.flatMap((group) => group.songs.map((song) => song.id)))
      .toEqual(songs.map((song) => song.id));
  });

  it("survives an empty or missing list", () => {
    expect(groupSongs([], "title")).toEqual([]);
    expect(groupSongs(null, "title")).toEqual([]);
  });
});