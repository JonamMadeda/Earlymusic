import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hooks: null as any,
  context: null as any,
  cachedUrl: vi.fn(),
}));

// Exercise Player's real handlers/effects without a DOM dependency. JSX stays
// as React elements; the harness commits the audio ref and passive effects.
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useState: (initial: unknown) => mocks.hooks.state(initial),
  useRef: (initial: unknown) => mocks.hooks.ref(initial),
  useMemo: (factory: () => unknown, deps: unknown[]) => mocks.hooks.memo(factory, deps),
  useCallback: (callback: unknown, deps: unknown[]) => mocks.hooks.memo(() => callback, deps),
  useEffect: (effect: () => unknown, deps: unknown[]) => mocks.hooks.effect(effect, deps),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({}), usePathname: () => "/" }));
vi.mock("../app/context/PlayerContext", () => ({
  usePlayer: () => mocks.context,
  PLAYBACK_POSITION_KEY: "lumbo_playback_position",
}));
vi.mock("../app/context/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/lib/apiFetch", () => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/audioUrl", () => ({ getAudioPublicUrl: (path: string) => path || "" }));
vi.mock("@/lib/artwork", () => ({ getSongArtwork: () => null }));
vi.mock("@/lib/playbackQueue", async () => await import("../lib/playbackQueue"));
vi.mock("@/lib/downloadManager", () => ({ isSongDownloaded: () => false }));
vi.mock("@/lib/cacheUtils", () => ({
  getCachedAudioUrl: (...args: unknown[]) => mocks.cachedUrl(...args),
  evictCachedAudio: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../app/components/SongAvatar", () => ({ default: () => null, VinylArtwork: () => null }));
vi.mock("../app/components/SleepTimer", () => ({ SleepTimerControl: () => null }));
vi.mock("../app/components/PlayerProgress", () => ({
  ThinProgress: () => null, SeekBar: () => null, TimeReadout: () => null,
}));
vi.mock("../app/components/PlayerQueue", () => ({ default: () => null }));
vi.mock("../app/components/SongOverflowMenu", () => ({ default: () => null }));

import Player from "../app/components/Player";

const songs = ["a", "b", "c"].map((id) => ({
  id, title: `Song ${id}`, author: "Artist", song_path: `https://audio.example/${id}.mp3`,
}));
type Song = typeof songs[number];
const sameDeps = (a?: unknown[], b?: unknown[]) =>
  !!a && !!b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));

class PlayerHarness {
  slots: any[] = [];
  cursor = 0;
  dirty = true;
  tree: any;
  pending: (() => void)[] = [];
  actions = new Map<string, (...args: any[]) => void>();
  audio = {
    currentTime: 0,
    duration: NaN,
    playbackRate: 1,
    volume: 1,
    muted: false,
    paused: true,
    error: null as null | { code: number },
    play: vi.fn(async () => { this.audio.paused = false; }),
    pause: vi.fn(() => { this.audio.paused = true; }),
    load: vi.fn(() => { this.audio.paused = true; }),
  };

  state(initial: any) {
    const index = this.cursor++;
    if (!this.slots[index]) {
      const slot = { value: typeof initial === "function" ? initial() : initial, set: null as any };
      slot.set = (update: any) => {
        const value = typeof update === "function" ? update(slot.value) : update;
        if (!Object.is(slot.value, value)) {
          slot.value = value;
          this.dirty = true;
        }
      };
      this.slots[index] = slot;
    }
    return [this.slots[index].value, this.slots[index].set];
  }

  ref(initial: unknown) {
    const index = this.cursor++;
    return this.slots[index] ??= { current: initial };
  }

  memo(factory: () => unknown, deps: unknown[]) {
    const index = this.cursor++;
    if (!sameDeps(this.slots[index]?.deps, deps)) this.slots[index] = { value: factory(), deps };
    return this.slots[index].value;
  }

  effect(effect: () => any, deps: unknown[]) {
    const index = this.cursor++;
    const previous = this.slots[index];
    if (previous && sameDeps(previous.deps, deps)) return;
    const slot = { deps, cleanup: undefined as any };
    this.slots[index] = slot;
    this.pending.push(() => { previous?.cleanup?.(); slot.cleanup = effect(); });
  }

  nodes(node = this.tree): any[] {
    if (Array.isArray(node)) return node.flatMap((child) => this.nodes(child));
    if (!node || typeof node !== "object") return [];
    return [node, ...this.nodes(node.props?.children ?? null)];
  }

  get audioProps() { return this.nodes().find((node) => node.type === "audio").props; }
  get duration() { return this.nodes().find((node) => "duration" in node.props).props.duration; }
  get status() { return this.nodes().find((node) => node.props.role === "status").props.children; }
  hasButton(label: string) {
    return this.nodes().some((node) => node.type === "button" && node.props["aria-label"] === label);
  }

  async settle() {
    // Drain the async cache lookup, play promises, and their state updates.
    for (let turn = 0; turn < 20; turn += 1) {
      let renders = 0;
      while (this.dirty) {
        if (++renders > 30) throw new Error("Player did not settle");
        this.dirty = false;
        this.cursor = 0;
        this.tree = Player();
        this.audioProps.ref.current = this.audio;
        this.pending.splice(0).forEach((effect) => effect());
      }
      await Promise.resolve();
    }
    expect(this.dirty).toBe(false);
  }

  async click(label: string) {
    const button = this.nodes().find((node) => node.type === "button" && node.props["aria-label"] === label);
    expect(button, `Missing button: ${label}`).toBeDefined();
    button.props.onClick({ stopPropagation() {} });
    await this.settle();
  }

  async select(song: Song, queue = mocks.context.queue) {
    mocks.context.setActiveSong(song, queue);
    await this.settle();
  }

  async event(name: string) {
    this.audioProps[name]();
    await this.settle();
  }

  async ready() {
    this.audio.duration = 180;
    await this.event("onLoadedMetadata");
    await this.event("onCanPlay");
  }

  async error() {
    this.audio.error = { code: 2 };
    await this.event("onError");
  }

  async wait(ms: number) {
    await vi.advanceTimersByTimeAsync(ms);
    await this.settle();
  }

  async action(name: string) {
    this.actions.get(name)!();
    await this.settle();
  }

  async sleep() {
    mocks.context.sleepTimerStopSignal += 1;
    this.dirty = true;
    await this.settle();
  }

  unmount() {
    this.slots.forEach((slot) => slot.cleanup?.());
  }
}

let player: PlayerHarness;
let storage: Map<string, string>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-13T12:00:00Z"));
  vi.spyOn(Math, "random").mockReturnValue(0);
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.cachedUrl.mockReset().mockResolvedValue(null);
  player = new PlayerHarness();
  mocks.hooks = player;
  storage = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  vi.stubGlobal("window", { addEventListener() {}, removeEventListener() {} });
  vi.stubGlobal("navigator", {
    mediaSession: {
      setActionHandler: (name: string, handler: (...args: any[]) => void) => {
        if (handler) player.actions.set(name, handler);
        else player.actions.delete(name);
      },
      setPositionState() {},
    },
  });
  vi.stubGlobal("MediaMetadata", class { constructor(public metadata: unknown) {} });
  mocks.context = {
    activeSong: songs[0], queue: songs, allSongs: songs,
    sleepTimerStopSignal: 0, volume: 1, isMuted: false, isShuffle: false, repeatMode: "off",
    setActiveSong: vi.fn((song: Song, queue: Song[]) => {
      mocks.context.activeSong = song;
      mocks.context.queue = queue;
      player.dirty = true;
    }),
    restorePlayback: vi.fn((song: Song) => {
      mocks.context.activeSong = song;
      mocks.context.queue = [];
      player.dirty = true;
    }),
  };
});

afterEach(() => {
  player.unmount();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Player same-source selections", () => {
  it("plays a fetched copy of restored uncached A without resetting its load state", async () => {
    storage.set("lumbo_playback_position", JSON.stringify({ song: songs[0], position: 42 }));
    await player.settle();
    await player.ready();
    expect(player.audio.paused).toBe(true);
    expect(player.audio.currentTime).toBe(42);
    expect(player.duration).toBe(180);
    const lookups = mocks.cachedUrl.mock.calls.length;
    const source = player.audioProps.src;

    await player.select({ ...songs[0] }, songs);

    expect(player.audio.play).toHaveBeenCalled();
    expect(player.audio.paused).toBe(false);
    expect(player.audioProps.src).toBe(source);
    expect(player.duration).toBe(180);
    expect(player.audio.currentTime).toBe(42);
    expect(player.status).toBe("");
    expect(mocks.cachedUrl).toHaveBeenCalledTimes(lookups);
    expect(player.audio.load).not.toHaveBeenCalled();
  });

  it("keeps an ordinary same-song click playing, and resumes a paused copy", async () => {
    await player.settle();
    await player.ready();
    player.audio.currentTime = 25;
    player.audio.play.mockClear();
    await player.select({ ...songs[0] });
    expect(player.audio.paused).toBe(false);
    expect(player.audio.play).not.toHaveBeenCalled();
    expect(player.duration).toBe(180);
    expect(player.audio.currentTime).toBe(25);

    await player.click("Pause");
    await player.select({ ...songs[0] });
    expect(player.audio.paused).toBe(false);
    expect(player.duration).toBe(180);
    expect(player.status).toBe("");
  });

  it("does not reset metadata or duplicate a load when a same-source selection is buffering", async () => {
    await player.settle();
    await player.ready();
    await player.event("onWaiting");
    const lookups = mocks.cachedUrl.mock.calls.length;
    await player.select({ ...songs[0] });
    expect(player.duration).toBe(180);
    expect(player.status).toBe("Buffering…");
    expect(mocks.cachedUrl).toHaveBeenCalledTimes(lookups);
    await player.event("onCanPlay");
    expect(player.status).toBe("");
  });

  it("keeps Next paused, including the existing single-song repeat-all restart", async () => {
    await player.settle();
    await player.ready();
    await player.click("Pause");
    player.audio.play.mockClear();
    await player.click("Next track");
    await player.ready();
    expect(mocks.context.activeSong.id).toBe("b");
    expect(player.audio.paused).toBe(true);
    expect(player.audio.play).not.toHaveBeenCalled();

    mocks.context.queue = [songs[1]];
    mocks.context.repeatMode = "all";
    player.dirty = true;
    await player.settle();
    player.audio.currentTime = 25;
    await player.click("Next track");
    expect(player.audio.currentTime).toBe(0);
    expect(player.audio.paused).toBe(true);
    expect(player.audio.play).not.toHaveBeenCalled();
  });

  it("still loads a changed source even when the song id is unchanged", async () => {
    await player.settle();
    await player.ready();
    await player.select({ ...songs[0], song_path: "https://audio.example/replacement.mp3" });
    expect(player.audioProps.src).toBe("https://audio.example/replacement.mp3");
    expect(player.duration).toBe(0);
    await player.ready();
    expect(player.audio.paused).toBe(false);
    expect(player.duration).toBe(180);
  });
});

describe("Player automatic error recovery", () => {
  it("reloads once, resumes prior playback, and clears the recovered error", async () => {
    await player.settle();
    await player.ready();
    await player.error();
    expect(player.status).toContain("Playback failed");
    player.audio.play.mockClear();
    await player.wait(800);
    expect(player.audio.load).toHaveBeenCalledTimes(1);
    await player.event("onCanPlay");
    expect(player.audio.play).toHaveBeenCalled();
    expect(player.audio.paused).toBe(false);
    expect(player.hasButton("Pause")).toBe(true);
    expect(player.status).toBe("");

    // Recovery starts a new error budget, rather than immediately skipping.
    await player.error();
    await player.wait(800);
    expect(player.audio.load).toHaveBeenCalledTimes(2);
    expect(mocks.context.setActiveSong).not.toHaveBeenCalled();
  });

  it("retains intent if the initial play promise rejects after the media error", async () => {
    let rejectPlay: (error: Error) => void;
    player.audio.play.mockImplementationOnce(() => new Promise<void>((_, reject) => { rejectPlay = reject; }));
    await player.settle();
    await player.error();
    rejectPlay!(new Error("Stream failed"));
    await player.settle();
    player.audio.play.mockClear();
    await player.wait(800);
    await player.event("onCanPlay");
    expect(player.audio.play).toHaveBeenCalled();
    expect(player.audio.paused).toBe(false);
    expect(player.status).toBe("");
  });

  it("recovers a paused source without starting playback or advancing", async () => {
    await player.settle();
    await player.ready();
    await player.click("Pause");
    player.audio.play.mockClear();
    await player.error();
    await player.wait(800);
    await player.event("onCanPlay");
    expect(player.status).toBe("");
    expect(player.audio.play).not.toHaveBeenCalled();
    expect(player.audio.paused).toBe(true);
  });

  it.each(["pause", "stop", "sleep"])("respects %s before a scheduled retry", async (action) => {
    await player.settle();
    await player.ready();
    await player.error();
    player.audio.play.mockClear();
    if (action === "sleep") await player.sleep();
    else await player.action(action);
    await player.wait(2000);
    await player.event("onCanPlay");
    expect(player.audio.load).not.toHaveBeenCalled();
    expect(player.audio.play).not.toHaveBeenCalled();
    expect(player.audio.paused).toBe(true);
    expect(player.status).toBe("");
    expect(mocks.context.setActiveSong).not.toHaveBeenCalled();
  });

  it.each(["pause", "stop", "sleep"])("respects %s after reload but before canplay", async (action) => {
    await player.settle();
    await player.ready();
    await player.error();
    await player.wait(800);
    player.audio.play.mockClear();
    if (action === "sleep") await player.sleep();
    else await player.action(action);
    await player.event("onCanPlay");
    expect(player.audio.play).not.toHaveBeenCalled();
    expect(player.audio.paused).toBe(true);
    expect(player.status).toBe("");
  });

  it("advances after retry failure, unless explicitly stopped", async () => {
    await player.settle();
    await player.ready();
    await player.error();
    await player.wait(800);
    await player.error();
    await player.wait(1200);
    expect(mocks.context.activeSong.id).toBe("b");
    await player.ready();
    await player.error();
    await player.wait(800);
    await player.error();
    await player.action("stop");
    await player.wait(1200);
    expect(mocks.context.activeSong.id).toBe("b");
  });

  it.each([false, true])("discards stale %s retry/advance timers when switching songs", async (secondError) => {
    await player.settle();
    await player.ready();
    await player.error();
    if (secondError) {
      await player.wait(800);
      await player.error();
    }
    await player.select(songs[2]);
    await player.ready();
    player.audio.load.mockClear();
    await player.wait(2500);
    expect(player.audio.load).not.toHaveBeenCalled();
    expect(mocks.context.activeSong.id).toBe("c");
    expect(player.audioProps.src).toBe(songs[2].song_path);
    expect(player.status).toBe("");
  });

  it("ignores an old-source error arriving during the replacement's cache lookup", async () => {
    await player.settle();
    await player.ready();
    let releaseLookup: (value: string | null) => void;
    mocks.cachedUrl.mockImplementationOnce(() => new Promise((resolve) => { releaseLookup = resolve; }));
    mocks.context.setActiveSong(songs[1], songs);
    player.dirty = true;
    await player.settle();

    await player.error();
    await player.wait(800);
    expect(player.audio.load).not.toHaveBeenCalled();
    releaseLookup!(null);
    await player.settle();
    await player.ready();

    expect(player.audioProps.src).toBe(songs[1].song_path);
    expect(player.audio.paused).toBe(false);
    expect(player.status).toBe("");
    player.audio.load.mockClear();
    await player.wait(2500);
    expect(player.audio.load).not.toHaveBeenCalled();
    expect(mocks.context.activeSong.id).toBe("b");
  });
});

describe("Player shuffle pass lifecycle", () => {
  beforeEach(() => { mocks.context.isShuffle = true; });

  it("does not revisit heard tracks on Next with Repeat Off", async () => {
    await player.settle();
    await player.ready();
    await player.click("Next track");
    expect(mocks.context.activeSong.id).toBe("b");
    await player.click("Next track");
    expect(mocks.context.activeSong.id).toBe("c");
    await player.click("Next track");
    expect(mocks.context.activeSong.id).toBe("c");
    await player.event("onEnded");
    expect(player.audio.paused).toBe(true);
    expect(mocks.context.setActiveSong).toHaveBeenCalledTimes(2);
  });

  it("preserves heard tracks across Previous as well as Next", async () => {
    await player.settle();
    await player.ready();
    await player.click("Next track");
    await player.click("Next track");
    await player.click("Previous track");
    await player.click("Previous track");
    expect(mocks.context.activeSong.id).toBe("b");
    await player.click("Next track");
    expect(mocks.context.activeSong.id).toBe("b");
  });

  it("combines manual Next and automatic advancement in one finite pass", async () => {
    await player.settle();
    await player.ready();
    await player.click("Next track");
    await player.event("onEnded");
    expect(mocks.context.activeSong.id).toBe("c");
    await player.event("onEnded");
    expect(mocks.context.setActiveSong).toHaveBeenCalledTimes(2);
    expect(player.audio.paused).toBe(true);
  });

  it("starts a new shuffle pass for a fresh manual pick, even with the same id", async () => {
    await player.settle();
    await player.ready();
    await player.click("Next track");
    await player.click("Next track");
    await player.select({ ...songs[2] });
    await player.click("Next track");
    expect(mocks.context.activeSong.id).toBe("a");
  });

  it("starts a new shuffle pass for a new queue with the same active song", async () => {
    await player.settle();
    await player.ready();
    await player.click("Next track");
    await player.click("Next track");
    await player.select(songs[2], [songs[2], songs[1]]);
    await player.click("Next track");
    expect(mocks.context.activeSong.id).toBe("b");
  });

  it("keeps paused skips in the same finite shuffle pass", async () => {
    await player.settle();
    await player.ready();
    await player.click("Pause");
    player.audio.play.mockClear();
    await player.click("Next track");
    await player.ready();
    await player.click("Next track");
    await player.ready();
    await player.click("Next track");
    expect(mocks.context.activeSong.id).toBe("c");
    expect(mocks.context.setActiveSong).toHaveBeenCalledTimes(2);
    expect(player.audio.play).not.toHaveBeenCalled();
  });

  it("resets failed-track exclusions on manual Next without resetting shuffle history", async () => {
    mocks.context.repeatMode = "all";
    await player.settle();
    await player.ready();
    await player.error();
    await player.wait(800);
    await player.error();
    await player.wait(1200);
    expect(mocks.context.activeSong.id).toBe("b");
    await player.ready();
    await player.click("Next track");
    expect(mocks.context.activeSong.id).toBe("c");
    await player.event("onEnded");
    // A can be tried again in the next pass after an explicit user skip.
    expect(mocks.context.activeSong.id).toBe("a");
  });

  it("still starts another pass when Repeat All is enabled", async () => {
    mocks.context.repeatMode = "all";
    await player.settle();
    await player.ready();
    await player.click("Next track");
    await player.click("Next track");
    expect(mocks.context.activeSong.id).toBe("c");
    await player.click("Next track");
    expect(mocks.context.activeSong.id).toBe("a");
    await player.click("Next track");
    expect(mocks.context.activeSong.id).toBe("b");
  });
});
