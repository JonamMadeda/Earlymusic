import { NextRequest, NextResponse } from "next/server";
import { normalizeEmail, validateEmail } from "@/lib/authValidation";
import { db } from "@/lib/neon";
import { resolveAuthOrigin, verifyEmailWithNeonAuth } from "@/lib/neonAuth";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  const limited = await checkRateLimit(request, {
    name: "auth-verify-email-ip",
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const { email, otp } = await request.json();
    const normalizedEmail = normalizeEmail(typeof email === "string" ? email : "");
    if (validateEmail(normalizedEmail) || typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { error: "Enter the six-digit code from your email." },
        { status: 400 }
      );
    }

    const emailLimited = await checkRateLimit(request, {
      name: "auth-verify-email-address",
      limit: 10,
      windowMs: 15 * 60_000,
      key: normalizedEmail,
    });
    if (emailLimited) return emailLimited;

    const result = await verifyEmailWithNeonAuth({
      email: normalizedEmail,
      otp,
      origin: resolveAuthOrigin(request),
    });

    const sessionToken = result.data?.token || result.sessionValue?.split(".")[0];
    if (sessionToken) {
      await db.query(`DELETE FROM neon_auth.session WHERE token = $1`, [sessionToken]);
    }

    if (!result.ok) {
      return NextResponse.json(
        { error: "That code is invalid or has expired. Request a new code and try again." },
        { status: 400 }
      );
    }

    return NextResponse.json({ verified: true });
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.json(
      { error: "Unable to verify your email right now." },
      { status: 500 }
    );
  }
}
