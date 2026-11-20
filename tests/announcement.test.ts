import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("@/lib/neon", () => ({ db: { query: mocks.query } }));

import { logAnnouncementError } from "../lib/announcement";

describe("announcement failure logging", () => {
  beforeEach(() => {
    mocks.query.mockReset().mockResolvedValue({ rows: [] });
  });

  it("records the failure in columns that exist on public.app_errors", async () => {
    await logAnnouncementError("new song", { id: 7, title: "Kyrie" }, new Error("boom"));

    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toContain("INSERT INTO public.app_errors (message, stack, path)");
    expect(sql).not.toContain("detail");
    expect(params[0]).toContain("Announcement failed (new song)");
    expect(params[1]).toContain('"songId":7');
    expect(params[2]).toBe("/api/admin/songs");
  });
});
