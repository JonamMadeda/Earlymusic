import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/neon";
import { checkRateLimit } from "@/lib/rateLimit";
import { logAuthEvent } from "@/lib/authAudit";
import { normalizeEmail, validateEmail } from "@/lib/authValidation";
import { issueResetToken, purgeResetTokens } from "@/lib/passwordReset";
import { isEmailConfigured, passwordResetEmail, sendEmail } from "@/lib/email";
import { resolveAuthOrigin } from "@/lib/neonAuth";

const GENERIC_RESPONSE = {
  message:
    "If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.",
};

export async function POST(request: NextRequest) {
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
      `SELECT id, name, email FROM neon_auth."user" WHERE lower(email) = $1`,
      [normalizedEmail]
    );
    const account = rows?.[0];

    if (account) {
      const issued = await issueResetToken(account.id);
      if (!issued) {
        await logAuthEvent(request, "password_reset_requested", {
          userId: account.id,
          email: account.email,
          detail: { issue_failed: true },
        });
      } else {
        const link = `${resolveAuthOrigin(request)}/auth?mode=reset&token=${encodeURIComponent(issued.token)}`;
        const sent = await sendEmail(
          passwordResetEmail({
            to: account.email,
            name: account.name || null,
            link,
          })
        );

        await logAuthEvent(request, "password_reset_requested", {
          userId: account.id,
          email: account.email,
          detail: sent ? null : { delivery_failed: true },
        });

        // Local runs have no email provider, so surface the link rather
        // than leaving the developer guessing. Never in production.
        if (!isEmailConfigured() && process.env.NODE_ENV !== "production") {
          if (Math.random() < 0.05) void purgeResetTokens();
          return NextResponse.json({ ...GENERIC_RESPONSE, devLink: link });
        }
      }
    }

    if (Math.random() < 0.05) void purgeResetTokens();

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Unable to start a password reset right now." },
      { status: 500 }
    );
  }
}
