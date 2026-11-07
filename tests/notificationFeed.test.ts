import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SEEN_KEY = "lumbo_notifications_seen";

const announcement = (id: number, minutesAgo: number) => ({
  id,
  kind: "news",
  title: `Announcement ${id}`,
  body: null,
  url: null,
  created_at: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
});

let storage: Record<string, string>;
let fetchCount: number;

const loadStore = async () => {
  vi.resetModules();
  return await import("../lib/notificationFeed");
};

beforeEach(() => {
  storage = {};
  fetchCount = 0;
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      fetchCount += 1;
      return Promise.resolve(
        new Response(JSON.stringify({ notifications: [announcement(3, 1), announcement(2, 30)] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("announcement feed store", () => {
  it("counts the whole feed as unread before the page is opened", async () => {
    const store = await loadStore();
    await store.refreshNotifications();

    const snapshot = store.getNotificationSnapshot();
    expect(snapshot.items).toHaveLength(2);
    expect(snapshot.unread).toBe(2);
    expect(snapshot.loading).toBe(false);
  });

  it("clears the unread count once the listener has opened the feed", async () => {
    const store = await loadStore();
    await store.refreshNotifications();

    store.markNotificationsSeen();
    expect(storage[SEEN_KEY]).toBeTruthy();
    expect(store.getNotificationSnapshot().unread).toBe(0);
  });

  it("counts only newer announcements as unread", async () => {
    const store = await loadStore();
    await store.refreshNotifications();
    store.markNotificationsSeen();

    // A post that lands after the visit must raise the badge again.
    const seenAt = store.getNotificationSnapshot().seenAt;
    const newer = {
      ...announcement(9, 0),
      created_at: new Date(Date.parse(seenAt) + 1000).toISOString(),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ notifications: [newer, announcement(3, 1), announcement(2, 30)] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      )
    );

    await store.refreshNotifications({ force: true });
    const snapshot = store.getNotificationSnapshot();
    expect(snapshot.unread).toBe(1);
    expect(snapshot.seenAt).toBe(seenAt);
  });

  it("de-duplicates the overlapping refreshes from the bell and the sidebar", async () => {
    const store = await loadStore();
    await store.refreshNotifications();
    await store.refreshNotifications();

    expect(fetchCount).toBe(1);

    await store.refreshNotifications({ force: true });
    expect(fetchCount).toBe(2);
  });

  it("surfaces a failed read instead of leaving the badge stale", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    const store = await loadStore();
    await store.refreshNotifications();

    const snapshot = store.getNotificationSnapshot();
    expect(snapshot.error).toBe("Announcements are unavailable right now.");
    expect(snapshot.loading).toBe(false);
  });

  it("returns a stable snapshot reference between reads", async () => {
    const store = await loadStore();
    const first = store.getNotificationSnapshot();
    const second = store.getNotificationSnapshot();
    expect(first).toBe(second);
  });

  it("picks up the stored seen time on the client only", async () => {
    storage[SEEN_KEY] = "2026-01-01T00:00:00.000Z";
    const store = await loadStore();

    expect(store.getNotificationSnapshot().seenAt).toBe(storage[SEEN_KEY]);
  });

  it("keeps existing items on screen during a background refresh", async () => {
    const store = await loadStore();
    await store.refreshNotifications();

    const pending = store.refreshNotifications({ force: true });
    const during = store.getNotificationSnapshot();
    expect(during.loading).toBe(false);
    expect(during.items).toHaveLength(2);

    await pending;
  });
});
