import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { loadAuthModule } from "./authRegressionHarness";

const query = vi.fn();
const logAuthEvent = vi.fn();
const auth = loadAuthModule(new URL("../lib/auth.js", import.meta.url), { "./neon": { db: { query } } });
const { POST } = loadAuthModule(new URL("../app/api/auth/signout-all/route.ts", import.meta.url), {
  "next/server": { NextRequest, NextResponse },
  "@/lib/auth": auth,
  "@/lib/authAudit": { logAuthEvent },
  "@/lib/neon": { db: { query } },
});
const request = (cookie = true) => new NextRequest("http://localhost/api/auth/signout-all", {
  method: "POST",
  headers: cookie ? { cookie: "lumbo_session=test-session.signature" } : {},
});
const session = { rows: [{ id: "account-a", email: "a@example.test", session_id: "session-a" }] };

beforeEach(() => {
  query.mockReset();
  logAuthEvent.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("sign out everywhere", () => {
  it("returns an error without clearing the cookie when session lookup fails", async () => {
    query.mockRejectedValueOnce(new Error("database unavailable"));
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Unable to sign out. Please try again." });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
    expect(logAuthEvent).not.toHaveBeenCalled();
  });

  it("returns an error without clearing the cookie when session deletion fails", async () => {
    query.mockResolvedValueOnce(session).mockRejectedValueOnce(new Error("delete failed"));
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(query).toHaveBeenLastCalledWith('DELETE FROM neon_auth.session WHERE "userId" = $1', ["account-a"]);
    expect(logAuthEvent).not.toHaveBeenCalled();
  });

  it("clears the cookie and audits only after successful revocation", async () => {
    query.mockResolvedValueOnce(session).mockResolvedValueOnce({ rows: [], rowCount: 2 });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(response.cookies.get("lumbo_session")?.value).toBe("");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(logAuthEvent).toHaveBeenCalledWith(expect.anything(), "signout_all", {
      userId: "account-a", email: "a@example.test",
    });
  });

  it.each([false, true])("clears the cookie after confirmed absence (cookie present: %s)", async (cookie) => {
    query.mockResolvedValueOnce({ rows: [] });
    const response = await POST(request(cookie));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(query).toHaveBeenCalledTimes(cookie ? 1 : 0);
    expect(logAuthEvent).not.toHaveBeenCalled();
  });
});
