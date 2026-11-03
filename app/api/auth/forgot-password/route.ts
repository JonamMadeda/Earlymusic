import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/neon";
import { checkRateLimit } from "@/lib/rateLimit";
import { logAuthEvent } from "@/lib/authAudit";
import { normalizeEmail, validateEmail } from "@/lib/authValidation";
import {
  requestPasswordResetWithNeonAuth,
  resolveAuthOrigin,
} from "@/lib/neonAuth";

const GENERIC_RESPONSE = {
  message:
    "If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.",
};

export async function POST(request: NextRequest) {
  // Neon's shared sender is rate-limited, so the limit that matters most is
  // the one applied before its endpoint is ever reached.
  const ipLimited = await checkRateLimit(request, {
    name: "auth-forgot-ip",
    limit: 5,
    windowMs: 15 * 60_000,
  });
  if (ipLimited) return ipLimited;

  try {
    const { email } = await request.json();
    const normalizedEmail = normalizeEmail(email);

    if (validateEmail(normalizedEmail)) {
      // Same reply as a real request: a malformed or unknown address must
      // not be distinguishable from one that has an account.
      return NextResponse.json(GENERIC_RESPONSE);
    }

    const emailLimited = await checkRateLimit(request, {
      name: "auth-forgot-email",
      limit: 3,
      windowMs: 60 * 60_000,
      key: normalizedEmail,
    });
    if (emailLimited) return emailLimited;

    const { rows } = await db.query(
      `SELECT id, email FROM neon_auth."user" WHERE lower(email) = $1`,
      [normalizedEmail]
    );
    const account = rows?.[0];

    if (!account) return NextResponse.json(GENERIC_RESPONSE);

    const origin = resolveAuthOrigin(request);
    const result = await requestPasswordResetWithNeonAuth({
      email: account.email,
      redirectTo: `${origin}/reset-password`,
      origin,
    });

    await logAuthEvent(request, "password_reset_requested", {
      userId: account.id,
      email: account.email,
      detail: result.ok ? null : { send_failed: `${result.status} ${result.code}` },
    });

    if (!result.ok && process.env.NODE_ENV !== "production") {
      // A 404 here means "Sign-up with Email" is still off in the Neon
      // console, which is invisible in production and maddening to debug.
      return NextResponse.json(
        { error: `Neon Auth refused the reset: ${result.status} ${result.code} ${result.message}` },
        { status: 502 }
      );
    }

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Unable to start a password reset right now." },
      { status: 500 }
    );
  }
}
