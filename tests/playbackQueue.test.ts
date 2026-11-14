import { describe, expect, it } from "vitest";
import { pickNextSong } from "../lib/playbackQueue";

const songs = [{ id: 1 }, { id: 2 }, { id: 3 }];
const first = () => 0;

describe("pickNextSong", () => {
  it("stops at the end of the queue when repeat is off", () => {
    expect(pickNextSong({ songs, currentId: 2, repeatMode: "off" })).toEqual({ id: 3 });
    expect(pickNextSong({ songs, currentId: 3, repeatMode: "off" })).toBeNull();
  });

  it("wraps to the first track when repeating the queue", () => {
    expect(pickNextSong({ songs, currentId: 3, repeatMode: "all" })).toEqual({ id: 1 });
  });

  it("walks past tracks that failed to play", () => {
    const skipIds = new Set([2]);
    expect(pickNextSong({ songs, currentId: 1, skipIds })).toEqual({ id: 3 });
    expect(pickNextSong({ songs, currentId: 3, skipIds })).toBeNull();
    expect(
      pickNextSong({ songs, currentId: 3, skipIds, repeatMode: "all" })
    ).toEqual({ id: 1 });
  });

  it("starts at the top when the current song is not in this queue", () => {
    expect(pickNextSong({ songs, currentId: 99 })).toEqual({ id: 1 });
    expect(pickNextSong({ songs: [], currentId: 1 })).toBeNull();
  });

  it("does not repeat a track within a shuffle pass", () => {
    const playedIds = new Set<number>();
    const seen: number[] = [];
    for (let i = 0; i < 2; i += 1) {
      const next = pickNextSong({
        songs,
        currentId: 1,
        isShuffle: true,
        playedIds,
        random: first,
      });
      expect(next).not.toBeNull();
      seen.push(next!.id);
    }
    expect(seen).toEqual([2, 3]);
    expect(playedIds.size).toBe(2);
  });

  it("ends a shuffle pass when repeat is off", () => {
    const playedIds = new Set([2, 3]);
    expect(
      pickNextSong({ songs, currentId: 1, isShuffle: true, playedIds, random: first })
    ).toBeNull();
  });

  it("starts a fresh shuffle pass when repeating the queue", () => {
    const playedIds = new Set([2, 3]);
    const next = pickNextSong({
      songs,
      currentId: 1,
      isShuffle: true,
      repeatMode: "all",
      playedIds,
      random: first,
    });
    expect(next).toEqual({ id: 2 });
    expect([...playedIds]).toEqual([2]);
  });

  it("wraps onto the current track when repeat-all has nothing else to play", () => {
    expect(
      pickNextSong({
        songs: [{ id: 1 }],
        currentId: 1,
        repeatMode: "all",
        isShuffle: true,
        playedIds: new Set(),
      })
    ).toEqual({ id: 1 });
    expect(
      pickNextSong({ songs: [{ id: 1 }], currentId: 1, repeatMode: "all" })
    ).toEqual({ id: 1 });
    expect(pickNextSong({ songs: [{ id: 1 }], currentId: 1 })).toBeNull();
  });
});