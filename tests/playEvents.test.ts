import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  getUserFromRequest: vi.fn(),
}));

vi.mock("@/lib/neon", () => ({ db: { query: mocks.query } }));
vi.mock("@/lib/auth", () => ({ getUserFromRequest: mocks.getUserFromRequest }));
vi.mock("@/lib/geo", () => ({ getCountryFromHeaders: () => null }));

import { NextRequest } from "next/server";
import { normalizePlayedAt, normalizePlayEventSongId } from "../lib/playEvents";
import { POST } from "../app/api/data/[table]/route";

const QUEUE_KEY = "lumbo_pending_play_events_v1";

describe("play event normalization", () => {
  it("only accepts numeric song ids", () => {
    expect(normalizePlayEventSongId(42)).toBe("42");
    expect(normalizePlayEventSongId(" 42 ")).toBe("42");
    expect(normalizePlayEventSongId("abc")).toBeNull();
    expect(normalizePlayEventSongId(null)).toBeNull();
  });

  it("keeps believable client times and rejects broken clocks", () => {
    const now = Date.parse("2026-11-21T12:00:00Z");
    const valid = "2026-11-21T11:59:00Z";
    expect(normalizePlayedAt(valid, now)).toBe("2026-11-21T11:59:00.000Z");
    expect(normalizePlayedAt("2099-01-01T00:00:00Z", now)).toBe("2026-11-21T12:00:00.000Z");
    expect(normalizePlayedAt("2020-01-01T00:00:00Z", now)).toBe("2026-11-21T12:00:00.000Z");
    expect(normalizePlayedAt("not-a-date", now)).toBe("2026-11-21T12:00:00.000Z");
  });
});

describe("play event API", () => {
  const request = (body: Record<string, unknown>) =>
    new NextRequest("http://localhost:3000/api/data/play_events", {
      method: "POST",
      body: JSON.stringify(body),
    });
  const context = { params: Promise.resolve({ table: "play_events" }) };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserFromRequest.mockResolvedValue({ id: "user-1" });
    mocks.query.mockResolvedValue({ rows: [{ id: "1" }] });
  });

  it("rejects an event without a resolvable song", async () => {
    const response = await POST(request({ song_id: "nope" }), context);
    expect(response.status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("stamps a sane time and ignores injected columns", async () => {
    const response = await POST(
      request({
        song_id: "42",
        played_at: "2099-01-01T00:00:00Z",
        user_id: "user-1",
        id: 999,
      }),
      context
    );

    expect(response.status).toBe(200);
    const [sql, values] = mocks.query.mock.calls[0];
    expect(sql).toContain("INSERT INTO public.play_events");
    expect(sql).not.toContain("999");
    expect(values).toContain("42");
    expect(values).toContain("user-1");
    expect(values).not.toContain(999);
    const playedAt = String(values.find((value: unknown) => String(value).startsWith("20")));
    expect(playedAt).not.toBe("2099-01-01T00:00:00Z");
  });

  it("preserves a recent offline play timestamp", async () => {
    const playedAt = new Date(Date.now() - 60_000).toISOString();
    await POST(request({ song_id: 42, played_at: playedAt }), context);
    expect(mocks.query.mock.calls[0][1]).toContain(playedAt);
  });
});

function makeWindow() {
  const storage = new Map<string, string>();
  const listeners = new Map<string, () => void>();
  const win: any = {
    localStorage: {
      getItem: (key: string) => storage.get(key) || "",
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
    navigator: { onLine: true },
    addEventListener: (type: string, listener: () => void) => listeners.set(type, listener),
    removeEventListener: (type: string) => listeners.delete(type),
    setInterval: () => 1,
    clearInterval: () => {},
    fetch: vi.fn(),
  };
  return { win, storage, listeners };
}

describe("play event writer wiring", () => {
  it("sends started plays through the retrying queue", () => {
    const source = readFileSync(
      new URL("../app/context/PlayerContext.js", import.meta.url),
      "utf8"
    );
    expect(source).toContain("queuePlayEvent(songId)");
    expect(source).not.toContain('fetch("/api/data/play_events"');
  });
});

describe("play event retry queue", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("keeps a failed write until a later retry succeeds", async () => {
    const { win, storage } = makeWindow();
    vi.stubGlobal("window", win);
    const queue = await import("../lib/playEventQueue");
    win.fetch
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValue({ ok: true });

    queue.queuePlayEvent(7, Date.parse("2026-11-21T10:00:00Z"));
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(storage.get(QUEUE_KEY)).toContain('"song_id":"7"');
    expect(queue.getPendingPlayEvents()).toHaveLength(1);

    await queue.flushPlayEvents();
    expect(win.fetch).toHaveBeenCalledTimes(2);
    expect(queue.getPendingPlayEvents()).toHaveLength(0);
    expect(storage.get(QUEUE_KEY)).toBe("[]");
  });

  it("retries queued events when the connection comes back", async () => {
    const { win, listeners } = makeWindow();
    vi.stubGlobal("window", win);
    const queue = await import("../lib/playEventQueue");
    win.fetch.mockResolvedValue({ ok: false });

    queue.queuePlayEvent(8);
    await new Promise<void>((resolve) => setImmediate(resolve));
    await queue.flushPlayEvents();
    expect(queue.getPendingPlayEvents()).toHaveLength(1);

    queue.startPlayEventSync();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(queue.getPendingPlayEvents()).toHaveLength(1);

    win.fetch.mockResolvedValue({ ok: true });
    await listeners.get("online")?.();
    expect(queue.getPendingPlayEvents()).toHaveLength(0);
  });
});
