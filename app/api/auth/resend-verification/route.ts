import { NextRequest, NextResponse } from "next/server";
import { normalizeEmail, validateEmail } from "@/lib/authValidation";
import { resolveAuthOrigin, sendVerificationEmailWithNeonAuth } from "@/lib/neonAuth";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  const limited = await checkRateLimit(request, {
    name: "auth-resend-verification-ip",
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const { email } = await request.json();
    const normalizedEmail = normalizeEmail(typeof email === "string" ? email : "");
    if (validateEmail(normalizedEmail)) {
      return NextResponse.json({
        message: "If the account needs verification, a new email is on its way.",
      });
    }

    const emailLimited = await checkRateLimit(request, {
      name: "auth-resend-verification-email",
      limit: 3,
      windowMs: 15 * 60_000,
      key: normalizedEmail,
    });
    if (emailLimited) return emailLimited;

    await sendVerificationEmailWithNeonAuth({
      email: normalizedEmail,
      origin: resolveAuthOrigin(request),
    });
    return NextResponse.json({
      message: "If the account needs verification, a new email is on its way.",
    });
  } catch (error) {
    console.error("Verification resend error:", error);
    return NextResponse.json(
      { error: "Unable to resend the verification email." },
      { status: 500 }
    );
  }
}
