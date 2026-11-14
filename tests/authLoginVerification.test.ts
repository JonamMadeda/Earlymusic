import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { loadAuthModule } from "./authRegressionHarness";

const query = vi.fn();
const signInWithNeonAuth = vi.fn();
const authValidation = loadAuthModule(new URL("../lib/authValidation.ts", import.meta.url));

const { POST } = loadAuthModule(new URL("../app/api/auth/login/route.ts", import.meta.url), {
  "next/server": { NextRequest, NextResponse },
  "@/lib/rateLimit": { checkRateLimit: vi.fn().mockResolvedValue(null) },
  "@/lib/authAudit": { logAuthEvent: vi.fn().mockResolvedValue(undefined) },
  "@/lib/authValidation": authValidation,
  "@/lib/auth": { setSessionCookie: vi.fn() },
  "@/lib/neon": { db: { query } },
  "@/lib/neonAuth": {
    NEON_AUTH_ERRORS: { invalidCredentials: "INVALID_CREDENTIALS" },
    resolveAuthOrigin: () => "http://localhost",
    signInWithNeonAuth,
  },
  "@/lib/credentials": {
    burnPasswordCompare: vi.fn(),
    findLegacyCredentialByEmail: vi.fn(),
    getCredentialAccount: vi.fn(),
    markLegacyUpgraded: vi.fn(),
    verifyLegacyPassword: vi.fn(),
    writeCredentialAccount: vi.fn(),
  },
});

const request = () => new NextRequest("http://localhost/api/auth/login", {
  method: "POST",
  body: JSON.stringify({ email: "worshipper@example.test", password: "correct horse battery" }),
});

// An account whose Neon credential exists but whose address was never proven.
const unverifiedSignIn = () => ({
  ok: true,
  sessionValue: "session-token.signature",
  data: {
    token: "session-token",
    user: {
      id: "user-1",
      email: "worshipper@example.test",
      name: "Grace Otieno",
      createdAt: "2026-01-04T00:00:00.000Z",
      emailVerified: false,
    },
  },
});

beforeEach(() => {
  query.mockReset();
  signInWithNeonAuth.mockReset().mockResolvedValue(unverifiedSignIn());
});

describe("legacy email-verification exemption", () => {
  it("only exempts accounts still on their bcrypt hash", async () => {
    query.mockResolvedValue({ rows: [] });

    await POST(request());

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("upgraded_at IS NULL"),
      ["user-1"]
    );
  });

  it("rejects an unverified account already upgraded to a Neon credential", async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("still signs in an unverified account whose credential is not upgraded", async () => {
    query
      .mockResolvedValueOnce({ rows: [{ "1": 1 }] })
      .mockResolvedValueOnce({ rows: [{ tos_accepted_at: null }] });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect((await response.json()).user.email).toBe("worshipper@example.test");
  });
});
