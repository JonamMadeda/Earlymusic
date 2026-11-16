import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  verifyStoredAudio: vi.fn(),
  getAdminFromRequest: vi.fn(),
  announceNewSong: vi.fn(),
  announceSongUpdate: vi.fn(),
  hasSongAnnouncement: vi.fn(),
  r2Send: vi.fn(),
}));

vi.mock("@/lib/neon", () => ({ db: { query: mocks.query } }));
vi.mock("@/lib/auth", () => ({ getAdminFromRequest: mocks.getAdminFromRequest }));
vi.mock("@/lib/adminAudit", () => ({ logAdminAction: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/r2", () => ({ getR2Client: () => ({ send: mocks.r2Send }) }));
vi.mock("@/lib/audioVerify", () => ({
  verifyStoredAudio: mocks.verifyStoredAudio,
  getR2ObjectKey: (path: string) => path.replace(/^\//, ""),
}));
vi.mock("@/lib/announcement", () => ({
  announceNewSong: mocks.announceNewSong,
  announceSongUpdate: mocks.announceSongUpdate,
  hasSongAnnouncement: mocks.hasSongAnnouncement,
  retractSongAnnouncements: vi.fn(),
}));

import { DELETE, PATCH } from "../app/api/admin/songs/[id]/route";
import { POST } from "../app/api/admin/songs/route";

const existing = {
  id: "7",
  title: "Test recording",
  status: "rejected",
  song_path: "/audio/original.mp3",
  region_restricted: false,
  allowed_countries: null,
};

const patch = (body: Record<string, unknown>) => PATCH(
  new NextRequest("http://localhost:3000/api/admin/songs/7", {
    method: "PATCH",
    body: JSON.stringify(body),
  }),
  { params: Promise.resolve({ id: "7" }) }
);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAdminFromRequest.mockResolvedValue({ user: { id: "admin" } });
  mocks.query.mockReset();
  mocks.query.mockResolvedValueOnce({ rows: [{ ...existing }] });
  mocks.query.mockResolvedValue({ rows: [{ ...existing, status: "approved" }] });
  mocks.verifyStoredAudio.mockResolvedValue({ ok: true });
});

const create = (body: Record<string, unknown> = {}) => POST(
  new NextRequest("http://localhost:3000/api/admin/songs", {
    method: "POST",
    body: JSON.stringify({ title: existing.title, song_path: existing.song_path, ...body }),
  })
);

describe("admin upload publication", () => {
  beforeEach(() => {
    mocks.hasSongAnnouncement.mockResolvedValue(false);
    mocks.query.mockReset().mockImplementation(async (_sql: string, params: unknown[]) => ({
      rows: [{ ...existing, status: params[10] }],
    }));
  });

  it("publishes verified admin uploads by default and announces them", async () => {
    const response = await create();

    expect(response.status).toBe(201);
    expect((await response.json()).song.status).toBe("approved");
    expect(mocks.query.mock.calls[0][1][10]).toBe("approved");
    expect(mocks.verifyStoredAudio).toHaveBeenCalledExactlyOnceWith(existing.song_path);
    expect(mocks.announceNewSong).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ status: "approved" }));
  });

  it.each(["pending", "rejected"])("keeps an explicit %s upload private without announcing it", async (status) => {
    const response = await create({ status });

    expect(response.status).toBe(201);
    expect((await response.json()).song.status).toBe(status);
    expect(mocks.query.mock.calls[0][1][10]).toBe(status);
    expect(mocks.hasSongAnnouncement).not.toHaveBeenCalled();
    expect(mocks.announceNewSong).not.toHaveBeenCalled();
  });

  it("accepts explicit approval without duplicating an existing announcement", async () => {
    mocks.hasSongAnnouncement.mockResolvedValue(true);
    expect((await create({ status: "approved" })).status).toBe(201);
    expect(mocks.hasSongAnnouncement).toHaveBeenCalledWith(existing.id);
    expect(mocks.announceNewSong).not.toHaveBeenCalled();
  });

  it.each(["invalid", "", null])("does not silently publish an invalid status %s", async (status) => {
    expect((await create({ status })).status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.announceNewSong).not.toHaveBeenCalled();
  });

  it("rejects non-admin creation before verifying audio or writing data", async () => {
    mocks.getAdminFromRequest.mockResolvedValue(null);
    expect((await create()).status).toBe(403);
    expect(mocks.verifyStoredAudio).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("does not publish or announce uploads with unverified audio", async () => {
    mocks.verifyStoredAudio.mockResolvedValue({ ok: false, error: "Missing audio" });
    expect((await create()).status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.announceNewSong).not.toHaveBeenCalled();
  });
});

describe("song approval audio verification", () => {
  it("rejects reapproval when the retained path no longer has audio", async () => {
    mocks.verifyStoredAudio.mockResolvedValue({ ok: false, error: "Audio file not found in storage." });

    const response = await patch({ status: "approved" });

    expect(response.status).toBe(400);
    expect(mocks.verifyStoredAudio).toHaveBeenCalledWith(existing.song_path);
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.announceNewSong).not.toHaveBeenCalled();
  });

  it("approves and announces a track whose stored audio is verified", async () => {
    const response = await patch({ status: "approved" });

    expect(response.status).toBe(200);
    expect(mocks.verifyStoredAudio).toHaveBeenCalledWith(existing.song_path);
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(mocks.announceNewSong).toHaveBeenCalledOnce();
  });

  it("verifies replacement audio instead of a deleted old path when approving", async () => {
    const response = await patch({ status: "approved", song_path: "/audio/new.mp3" });

    expect(response.status).toBe(200);
    expect(mocks.verifyStoredAudio).toHaveBeenCalledExactlyOnceWith("/audio/new.mp3");
    expect(mocks.query.mock.calls[1][1]).toContain("/audio/new.mp3");
  });

  it("rejects approval when no audio path is available", async () => {
    mocks.query.mockReset().mockResolvedValueOnce({ rows: [{ ...existing, song_path: null }] });

    expect((await patch({ status: "approved" })).status).toBe(400);
    expect(mocks.verifyStoredAudio).not.toHaveBeenCalled();
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it("cannot approve a track while clearing its audio path", async () => {
    expect((await patch({ status: "approved", song_path: null })).status).toBe(400);
    expect(mocks.verifyStoredAudio).not.toHaveBeenCalled();
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it("does not require audio merely to edit a rejected track", async () => {
    expect((await patch({ title: "Corrected title" })).status).toBe(200);
    expect(mocks.verifyStoredAudio).not.toHaveBeenCalled();
  });

  it("still verifies replacement audio on an already approved track", async () => {
    mocks.query.mockReset().mockResolvedValueOnce({ rows: [{ ...existing, status: "approved" }] });
    mocks.verifyStoredAudio.mockResolvedValue({ ok: false, error: "Missing audio" });

    expect((await patch({ song_path: "/audio/missing.mp3" })).status).toBe(400);
    expect(mocks.verifyStoredAudio).toHaveBeenCalledWith("/audio/missing.mp3");
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
});

const del = () => DELETE(
  new NextRequest("http://localhost:3000/api/admin/songs/7", {
    method: "DELETE",
    body: JSON.stringify({ songPath: existing.song_path }),
  }),
  { params: Promise.resolve({ id: "7" }) }
);

describe("song deletion ordering", () => {
  it("removes the database row before deleting the audio object", async () => {
    const order: string[] = [];
    mocks.query.mockReset().mockImplementation(async (sql: string) => {
      order.push(sql.includes("DELETE FROM public.songs") ? "row" : "query");
      return { rows: [{ ...existing }] };
    });
    mocks.r2Send.mockReset().mockImplementation(async () => {
      order.push("object");
      return {};
    });

    expect((await del()).status).toBe(200);
    expect(order.indexOf("row")).toBeLessThan(order.indexOf("object"));
  });

  it("still reports success when the row is gone but the file is stranded", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.query.mockReset().mockImplementation(async () => ({ rows: [{ ...existing }] }));
    mocks.r2Send.mockReset().mockRejectedValue(new Error("R2 unavailable"));

    const response = await del();

    expect(response.status).toBe(200);
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM public.songs"),
      ["7"]
    );
    consoleError.mockRestore();
  });

  it("leaves storage untouched when the row no longer exists", async () => {
    mocks.query.mockReset()
      .mockResolvedValueOnce({ rows: [{ ...existing }] })
      .mockResolvedValueOnce({ rows: [] });
    mocks.r2Send.mockReset();

    expect((await del()).status).toBe(404);
    expect(mocks.r2Send).not.toHaveBeenCalled();
  });
});
