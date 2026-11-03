import { NextRequest, NextResponse } from "next/server";
import {
  verifyPassword,
  createSession,
  signSessionToken,
  setSessionCookie,
} from "@/lib/auth";
import { db } from "@/lib/neon";
import { checkRateLimit } from "@/lib/rateLimit";
import { logAuthEvent } from "@/lib/authAudit";
import { normalizeEmail, validateEmail } from "@/lib/authValidation";

// A real bcrypt hash so unknown emails still pay the same cost as known
// ones. Without this, response timing reveals which accounts exist.
const DUMMY_HASH = "$2b$10$Br4BLaLE0Vc4lWKUq1Li2OKYFl6Wrphnq5k1LxdUMAivG31Qbt6KG";

export async function POST(request: NextRequest) {
  const ipLimited = await checkRateLimit(request, {
    name: "auth-login-ip",
    limit: 20,
    windowMs: 60_000,
  });
  if (ipLimited) return ipLimited;

  try {
    const { email, password } = await request.json();
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      password.length === 0 ||
      password.length > 1024
    ) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const normalizedEmail = normalizeEmail(email);
    const emailLimited = await checkRateLimit(request, {
      name: "auth-login-email",
      limit: 10,
      windowMs: 15 * 60_000,
      key: normalizedEmail || "invalid",
    });
    if (emailLimited) return emailLimited;

    // Invalid addresses take the same dummy-bcrypt path as unknown users.
    if (validateEmail(normalizedEmail)) {
      await verifyPassword(password, DUMMY_HASH);
      await logAuthEvent(request, "login_failed", {
        email: normalizedEmail.slice(0, 254),
      });
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const result = await db.query(
      `SELECT id, email, password_hash, created_at, token_version
       FROM public.users
       WHERE lower(email) = $1`,
      [normalizedEmail]
    );
    const user = result.rows?.[0];

    const valid = await verifyPassword(
      password,
      user?.password_hash || DUMMY_HASH
    );
    if (!user || !valid) {
      await logAuthEvent(request, "login_failed", { email: normalizedEmail });
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const sessionId = await createSession(user.id, request);
    if (!sessionId) {
      return NextResponse.json(
        { error: "Unable to start a session." },
        { status: 500 }
      );
    }

    const token = await signSessionToken({ user, sessionId });
    const response = NextResponse.json({
      user: { id: user.id, email: user.email, created_at: user.created_at },
    });
    setSessionCookie(response, token);
    await logAuthEvent(request, "login_success", {
      userId: user.id,
      email: user.email,
    });
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Unable to sign in right now." },
      { status: 500 }
    );
  }
}
