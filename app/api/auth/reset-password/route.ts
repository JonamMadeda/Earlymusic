import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { logAuthEvent } from "@/lib/authAudit";
import { validatePassword } from "@/lib/authValidation";
import { clearSessionCookie } from "@/lib/auth";
import { resetPasswordWithNeonAuth, resolveAuthOrigin } from "@/lib/neonAuth";

const INVALID_LINK = {
  error: "This reset link is invalid or has expired. Request a new one.",
};

export async function POST(request: NextRequest) {
  const ipLimited = await checkRateLimit(request, {
    name: "auth-reset-ip",
    limit: 10,
    windowMs: 15 * 60_000,
  });
  if (ipLimited) return ipLimited;

  try {
    const { token, password } = await request.json();

    if (typeof token !== "string" || !token) {
      return NextResponse.json(INVALID_LINK, { status: 400 });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const result = await resetPasswordWithNeonAuth({
      token,
      newPassword: password,
      origin: resolveAuthOrigin(request),
    });

    if (!result.ok) {
      // Neon owns the token, so every rejection — spent, expired, unknown —
      // is the same dead link as far as the visitor is concerned.
      await logAuthEvent(request, "password_reset_failed", {
        detail: { rejected: `${result.status} ${result.code}` },
      });
      return NextResponse.json(INVALID_LINK, { status: 400 });
    }

    await logAuthEvent(request, "password_reset_completed");

    const response = NextResponse.json({
      message: "Password reset. Sign in with your new password.",
    });
    // The link may have been opened from a browser that is still signed in,
    // and Neon has just revoked every session for the account.
    clearSessionCookie(response);
    return response;
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Unable to reset your password right now." },
      { status: 500 }
    );
  }
}
