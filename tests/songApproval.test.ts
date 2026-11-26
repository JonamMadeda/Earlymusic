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
  rights_status: "unknown",
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
      rows: [{
        ...existing,
        rights_status: params[10],
        rights_note: params[11],
        status: params[12],
      }],
    }));
  });

  it("holds verified admin uploads as pending with an unknown classification by default", async () => {
    const response = await create();

    expect(response.status).toBe(201);
    expect((await response.json()).song).toEqual(expect.objectContaining({
      status: "pending",
      rights_status: "unknown",
    }));
    expect(mocks.query.mock.calls[0][1].slice(10, 13)).toEqual(["unknown", null, "pending"]);
    expect(mocks.verifyStoredAudio).toHaveBeenCalledExactlyOnceWith(existing.song_path);
    expect(mocks.hasSongAnnouncement).not.toHaveBeenCalled();
    expect(mocks.announceNewSong).not.toHaveBeenCalled();
  });

  it.each(["pending", "rejected"])("keeps an explicit %s upload private without announcing it", async (status) => {
    const response = await create({ status });

    expect(response.status).toBe(201);
    expect((await response.json()).song.status).toBe(status);
    expect(mocks.query.mock.calls[0][1][12]).toBe(status);
    expect(mocks.hasSongAnnouncement).not.toHaveBeenCalled();
    expect(mocks.announceNewSong).not.toHaveBeenCalled();
  });

  it.each(["church_original", "third_party", "public_domain"])("accepts the %s classification for publication", async (rightsStatus) => {
    const response = await create({ status: "approved", rights_status: rightsStatus });

    expect(response.status).toBe(201);
    expect((await response.json()).song).toEqual(expect.objectContaining({
      status: "approved",
      rights_status: rightsStatus,
    }));
    expect(mocks.query.mock.calls[0][1][10]).toBe(rightsStatus);
    expect(mocks.announceNewSong).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      status: "approved",
      rights_status: rightsStatus,
    }));
  });

  it("normalizes a valid rights classification and persists a trimmed rights note", async () => {
    const response = await create({
      rights_status: "  Third_Party ",
      rights_note: "  Used with permission.  ",
    });
    const params = mocks.query.mock.calls[0][1];

    expect(response.status).toBe(201);
    expect(params[10]).toBe("third_party");
    expect(params[11]).toBe("Used with permission.");
    expect((await response.json()).song.rights_note).toBe("Used with permission.");
  });

  it.each(["   ", null])("stores a blank rights note %s as null", async (rightsNote) => {
    expect((await create({ rights_note: rightsNote })).status).toBe(201);
    expect(mocks.query.mock.calls[0][1][11]).toBeNull();
  });

  it("rejects approved uploads with an omitted or unknown classification before writing", async () => {
    for (const rightsStatus of [undefined, "unknown", null]) {
      const response = await create({ status: "approved", rights_status: rightsStatus });
      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain("Classify");
    }
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.announceNewSong).not.toHaveBeenCalled();
  });

  it.each(["owned", "", 7])("rejects an invalid rights classification %s", async (rightsStatus) => {
    expect((await create({ rights_status: rightsStatus })).status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.announceNewSong).not.toHaveBeenCalled();
  });

  it("rejects an oversized rights note before writing", async () => {
    const response = await create({ rights_note: "x".repeat(501) });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("500");
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("accepts explicit approval without duplicating an existing announcement", async () => {
    mocks.hasSongAnnouncement.mockResolvedValue(true);
    expect((await create({ status: "approved", rights_status: "public_domain" })).status).toBe(201);
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
  const approval = { status: "approved", rights_status: "church_original" };

  it("rejects reapproval when the retained path no longer has audio", async () => {
    mocks.verifyStoredAudio.mockResolvedValue({ ok: false, error: "Audio file not found in storage." });

    const response = await patch(approval);

    expect(response.status).toBe(400);
    expect(mocks.verifyStoredAudio).toHaveBeenCalledWith(existing.song_path);
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.announceNewSong).not.toHaveBeenCalled();
  });

  it("approves and announces a track whose stored audio is verified", async () => {
    const response = await patch(approval);

    expect(response.status).toBe(200);
    expect(mocks.verifyStoredAudio).toHaveBeenCalledWith(existing.song_path);
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(mocks.announceNewSong).toHaveBeenCalledOnce();
  });

  it("verifies replacement audio instead of a deleted old path when approving", async () => {
    const response = await patch({ ...approval, song_path: "/audio/new.mp3" });

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
    expect((await patch({ ...approval, song_path: null })).status).toBe(400);
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

    expect((await patch({ ...approval, song_path: "/audio/missing.mp3" })).status).toBe(400);
    expect(mocks.verifyStoredAudio).toHaveBeenCalledWith("/audio/missing.mp3");
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
});

describe("song approval rights classification", () => {
  it.each([undefined, null, "unknown"])("blocks edits to legacy approved rows with rights_status %s", async (rightsStatus) => {
    mocks.query.mockReset().mockResolvedValueOnce({
      rows: [{ ...existing, status: "approved", rights_status: rightsStatus }],
    });

    const response = await patch({ title: "Corrected title" });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("Classify");
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.verifyStoredAudio).not.toHaveBeenCalled();
  });

  it("requires a classification when approving an unclassified pending row", async () => {
    const response = await patch({ status: "approved" });

    expect(response.status).toBe(400);
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.verifyStoredAudio).not.toHaveBeenCalled();
    expect(mocks.announceNewSong).not.toHaveBeenCalled();
  });

  it("rejects downgrading a classified approved row to unknown", async () => {
    mocks.query.mockReset().mockResolvedValueOnce({
      rows: [{ ...existing, status: "approved", rights_status: "public_domain" }],
    });

    const response = await patch({ rights_status: "unknown" });

    expect(response.status).toBe(400);
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.verifyStoredAudio).not.toHaveBeenCalled();
  });

  it.each(["church_original", "third_party", "public_domain"])("accepts %s when approving and stores the normalized value", async (rightsStatus) => {
    const response = await patch({
      status: "approved",
      rights_status: `  ${rightsStatus.toUpperCase()}  `,
    });

    expect(response.status).toBe(200);
    expect(mocks.query.mock.calls[1][1][0]).toBe(rightsStatus);
    expect(mocks.query.mock.calls[1][0]).not.toContain("rights_status <> 'unknown'");
    expect(mocks.announceNewSong).toHaveBeenCalledOnce();
  });

  it.each(["owned", "", null])("rejects an invalid PATCH classification %s before writing", async (rightsStatus) => {
    expect((await patch({ rights_status: rightsStatus })).status).toBe(400);
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.announceNewSong).not.toHaveBeenCalled();
  });

  it("rejects an oversized rights note before writing", async () => {
    const response = await patch({ rights_note: "x".repeat(501) });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("500");
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.verifyStoredAudio).not.toHaveBeenCalled();
  });

  it("guards an approval against a concurrent rights downgrade", async () => {
    mocks.query.mockReset()
      .mockResolvedValueOnce({ rows: [{ ...existing, status: "approved", rights_status: "public_domain" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: existing.id }] });

    const response = await patch({ title: "Corrected title" });

    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("changed while");
    expect(mocks.query.mock.calls[1][0]).toContain("rights_status <> 'unknown'");
    expect(mocks.announceNewSong).not.toHaveBeenCalled();
    expect(mocks.announceSongUpdate).not.toHaveBeenCalled();
  });

  it("guards an unclassified downgrade against a concurrent approval", async () => {
    mocks.query.mockReset()
      .mockResolvedValueOnce({ rows: [{ ...existing, status: "pending" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: existing.id }] });

    const response = await patch({ status: "rejected", rights_status: "unknown" });

    expect(response.status).toBe(409);
    expect(mocks.query.mock.calls[1][0]).toContain("status <> 'approved'");
    expect(mocks.announceNewSong).not.toHaveBeenCalled();
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
