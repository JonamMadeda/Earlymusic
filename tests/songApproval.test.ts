import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  verifyStoredAudio: vi.fn(),
  getAdminFromRequest: vi.fn(),
  announceNewSong: vi.fn(),
  announceSongUpdate: vi.fn(),
}));

vi.mock("@/lib/neon", () => ({ db: { query: mocks.query } }));
vi.mock("@/lib/auth", () => ({ getAdminFromRequest: mocks.getAdminFromRequest }));
vi.mock("@/lib/adminAudit", () => ({ logAdminAction: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/r2", () => ({ getR2Client: vi.fn() }));
vi.mock("@/lib/audioVerify", () => ({
  verifyStoredAudio: mocks.verifyStoredAudio,
  getR2ObjectKey: (path: string) => path.replace(/^\//, ""),
}));
vi.mock("@/lib/announcement", () => ({
  announceNewSong: mocks.announceNewSong,
  announceSongUpdate: mocks.announceSongUpdate,
  retractSongAnnouncements: vi.fn(),
}));

import { PATCH } from "../app/api/admin/songs/[id]/route";

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
