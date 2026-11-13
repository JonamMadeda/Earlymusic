import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  stageClearDownloads,
  undoClearDownloads,
  commitClearDownloads,
  pruneOrphanedDownloads,
  getDownloadedSongs,
  clearPendingDownloadClears,
  DOWNLOAD_UNDO_MS,
} from "../lib/downloadManager";

const BASE = "http://localhost:3000/";
const STORAGE_KEY = "lumbo_downloaded_songs";
const CACHE_NAME = "lumbo-audio-cache-v1";

const song = (id: string) => ({
  id,
  title: `Song ${id}`,
  author: "Artist",
  song_path: `/audio/${id}.mp3`,
  downloadedAt: "2026-11-13T00:00:00.000Z",
});

const resolve = (input: Request | string) =>
  typeof input === "string" ? new URL(input, BASE).href : input.url;

class FakeCache {
  store = new Map<string, Response>();

  async match(input: Request | string) {
    const found = this.store.get(resolve(input));
    return found ? found.clone() : undefined;
  }

  async put(input: Request | string, response: Response) {
    this.store.set(resolve(input), response.clone());
  }

  async delete(input: Request | string) {
    return this.store.delete(resolve(input));
  }

  async keys() {
    return [...this.store.keys()].map((url) => new Request(url));
  }
}

const markedResponse = () =>
  new Response("audio", {
    headers: { "Content-Type": "audio/mpeg", "x-luumbo-download": "1" },
  });

const streamedResponse = () =>
  new Response("audio", { headers: { "Content-Type": "audio/mpeg" } });

let store: Map<string, string>;
let audio: FakeCache;

const seed = async (songs: ReturnType<typeof song>[]) => {
  store.set(STORAGE_KEY, JSON.stringify(songs));
  for (const s of songs) {
    await audio.put(s.song_path, markedResponse());
  }
};

beforeEach(() => {
  store = new Map();
  audio = new FakeCache();
  const buckets = new Map([[CACHE_NAME, audio]]);
  vi.stubGlobal("localStorage", {
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  });
  vi.stubGlobal("caches", {
    open: async (name: string) => buckets.get(name) ?? new FakeCache(),
    keys: async () => [...buckets.keys()],
    delete: async (name: string) => buckets.delete(name),
  });
  vi.stubGlobal("window", {
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
    location: { href: BASE },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("staged download clearing", () => {
  it("stages a clear: the list empties but audio stays cached for undo", async () => {
    await seed([song("a"), song("b")]);
    const snapshot = stageClearDownloads();
    expect(snapshot.songs.map((s) => s.id)).toEqual(["a", "b"]);
    expect(getDownloadedSongs()).toEqual([]);
    expect(await audio.match("/audio/a.mp3")).toBeDefined();
    expect(await audio.match("/audio/b.mp3")).toBeDefined();
  });

  it("undo restores the snapshot without duplicating a re-downloaded track", async () => {
    await seed([song("a"), song("b")]);
    const snapshot = stageClearDownloads();
    store.set(STORAGE_KEY, JSON.stringify([song("a")]));
    await audio.put("/audio/a.mp3", markedResponse());

    undoClearDownloads(snapshot);

    const restored = getDownloadedSongs();
    expect(restored.map((s) => s.id).sort()).toEqual(["a", "b"]);
    expect(await audio.match("/audio/b.mp3")).toBeDefined();
  });

  it("commit deletes staged audio but spares tracks re-downloaded in the window", async () => {
    await seed([song("a"), song("b")]);
    const snapshot = stageClearDownloads();
    store.set(STORAGE_KEY, JSON.stringify([song("b")]));

    await commitClearDownloads(snapshot);

    expect(await audio.match("/audio/a.mp3")).toBeUndefined();
    expect(await audio.match("/audio/b.mp3")).toBeDefined();
  });

  it("commit after the window closes removes all staged audio", async () => {
    await seed([song("a")]);
    const snapshot = stageClearDownloads();

    await commitClearDownloads(snapshot);

    expect(await audio.match("/audio/a.mp3")).toBeUndefined();
    expect(getDownloadedSongs()).toEqual([]);
  });

  it("prune drops orphaned marked audio but keeps streams and listed downloads", async () => {
    await seed([song("a")]);
    await audio.put("/audio/orphan.mp3", markedResponse());
    await audio.put("/audio/stream.mp3", streamedResponse());

    await pruneOrphanedDownloads();

    expect(await audio.match("/audio/a.mp3")).toBeDefined();
    expect(await audio.match("/audio/orphan.mp3")).toBeUndefined();
    expect(await audio.match("/audio/stream.mp3")).toBeDefined();
  });

  it("protects a pending clear when another tab prunes, then undoes with audio intact", async () => {
    await seed([song("a"), song("b")]);
    const snapshot = stageClearDownloads();
    vi.resetModules();
    const otherTab = await import("../lib/downloadManager");

    await otherTab.pruneOrphanedDownloads();
    expect(undoClearDownloads(snapshot)).toBe(true);

    expect(getDownloadedSongs().map((s) => s.id)).toEqual(["a", "b"]);
    expect(await audio.match("/audio/a.mp3")).toBeDefined();
    expect(await audio.match("/audio/b.mp3")).toBeDefined();
    expect(store.has(snapshot.id)).toBe(false);
  });

  it("prunes an abandoned clear after its deadline and refuses stale undo", async () => {
    vi.useFakeTimers();
    await seed([song("a")]);
    const snapshot = stageClearDownloads();
    vi.advanceTimersByTime(DOWNLOAD_UNDO_MS + 1);

    await pruneOrphanedDownloads();

    expect(undoClearDownloads(snapshot)).toBe(false);
    expect(getDownloadedSongs()).toEqual([]);
    expect(await audio.match("/audio/a.mp3")).toBeUndefined();
    expect(store.has(snapshot.id)).toBe(false);
  });

  it("keeps another tab's pending clear protected when the first clear commits", async () => {
    await seed([song("a")]);
    const first = stageClearDownloads();
    store.set(STORAGE_KEY, JSON.stringify([song("a")]));
    const second = stageClearDownloads();

    await commitClearDownloads(first);
    await pruneOrphanedDownloads();

    expect(await audio.match("/audio/a.mp3")).toBeDefined();
    expect(undoClearDownloads(second)).toBe(true);
    expect(getDownloadedSongs().map((s) => s.id)).toEqual(["a"]);
  });

  it("cannot undo a clear after private download state is removed", async () => {
    await seed([song("a")]);
    const snapshot = stageClearDownloads();

    clearPendingDownloadClears();

    expect(undoClearDownloads(snapshot)).toBe(false);
    expect(getDownloadedSongs()).toEqual([]);
    expect(store.has(snapshot.id)).toBe(false);
  });

  it("a stale commit after sign-out spares the next account's re-downloaded audio", async () => {
    await seed([song("a")]);
    const snapshot = stageClearDownloads();

    clearPendingDownloadClears();
    store.set(STORAGE_KEY, JSON.stringify([song("a")]));
    await audio.put("/audio/a.mp3", markedResponse());

    await commitClearDownloads(snapshot);

    expect(await audio.match("/audio/a.mp3")).toBeDefined();
    expect(getDownloadedSongs().map((s) => s.id)).toEqual(["a"]);
  });

  it("does not hide downloads when cross-tab protection cannot be persisted", async () => {
    await seed([song("a")]);
    vi.spyOn(localStorage, "setItem").mockImplementationOnce(() => {
      throw new DOMException("Storage is full", "QuotaExceededError");
    });

    expect(() => stageClearDownloads()).toThrow("Storage is full");
    expect(getDownloadedSongs().map((s) => s.id)).toEqual(["a"]);
    expect(await audio.match("/audio/a.mp3")).toBeDefined();
  });

  it("staging an empty library is a no-op snapshot", () => {
    const snapshot = stageClearDownloads();
    expect(snapshot.songs).toEqual([]);
    expect(getDownloadedSongs()).toEqual([]);
  });
});