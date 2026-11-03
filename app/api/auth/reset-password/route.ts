import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { logAuthEvent } from "@/lib/authAudit";
import { validatePassword } from "@/lib/authValidation";
import { clearSessionCookie } from "@/lib/auth";
import { consumeResetToken, purgeResetTokens } from "@/lib/passwordReset";
import { markLegacyUpgraded, writeCredentialAccount } from "@/lib/credentials";
import { db } from "@/lib/neon";

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

    const consumed = await consumeResetToken(token);
    if (!consumed) {
      await logAuthEvent(request, "password_reset_failed");
      return NextResponse.json(INVALID_LINK, { status: 400 });
    }

    const { userId } = consumed;

    try {
      // Creates the credential row for accounts that still only have a
      // legacy bcrypt hash, so the reset also completes their upgrade.
      await writeCredentialAccount(userId, password);
      await markLegacyUpgraded(userId);
    } catch (error) {
      console.error("Unable to write reset credential:", error);
      return NextResponse.json(
        { error: "Unable to reset your password right now." },
        { status: 500 }
      );
    }

    // A reset is a recovery event: every other device must sign in again
    // with the new password.
    try {
      await db.query(`DELETE FROM neon_auth.session WHERE "userId" = $1`, [
        userId,
      ]);
    } catch (error) {
      console.error("Unable to revoke sessions after reset:", error);
    }

    await logAuthEvent(request, "password_reset_completed", { userId });
    if (Math.random() < 0.05) void purgeResetTokens();

    const response = NextResponse.json({
      message: "Password reset. Sign in with your new password.",
    });
    // The link may have been opened from a browser that is still signed in.
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
