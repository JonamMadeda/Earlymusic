import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { logAuthEvent } from "@/lib/authAudit";
import {
  normalizeEmail,
  validateEmail,
  validatePassword,
} from "@/lib/authValidation";
import { setSessionCookie } from "@/lib/auth";
import {
  NEON_AUTH_ERRORS,
  resolveAuthOrigin,
  signUpWithNeonAuth,
} from "@/lib/neonAuth";
import { burnPasswordCompare } from "@/lib/credentials";

// Neon Auth requires a non-empty display name.
const displayNameFromEmail = (email: string) =>
  (email.split("@")[0] || "Member").slice(0, 80);

export async function POST(request: NextRequest) {
  const ipLimited = await checkRateLimit(request, {
    name: "auth-register-ip",
    limit: 10,
    windowMs: 60_000,
  });
  if (ipLimited) return ipLimited;

  try {
    const { email, password } = await request.json();
    if (typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const normalizedEmail = normalizeEmail(email);
    const emailError = validateEmail(normalizedEmail);
    if (emailError) {
      return NextResponse.json({ error: emailError }, { status: 400 });
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const emailLimited = await checkRateLimit(request, {
      name: "auth-register-email",
      limit: 5,
      windowMs: 15 * 60_000,
      key: normalizedEmail,
    });
    if (emailLimited) return emailLimited;

    const result = await signUpWithNeonAuth({
      email: normalizedEmail,
      password,
      name: displayNameFromEmail(normalizedEmail),
      origin: resolveAuthOrigin(request),
    });

    if (result.ok) {
      if (!result.sessionValue) {
        return NextResponse.json(
          { error: "Unable to start a session." },
          { status: 500 }
        );
      }
      const response = NextResponse.json({
        user: {
          id: result.data.user.id,
          email: result.data.user.email,
          name: result.data.user.name || null,
          created_at: result.data.user.createdAt || null,
        },
      });
      setSessionCookie(response, result.sessionValue);
      await logAuthEvent(request, "register_success", {
        userId: result.data.user.id,
        email: result.data.user.email,
      });
      return response;
    }

    if (result.code === NEON_AUTH_ERRORS.emailExists) {
      // Same bcrypt cost as the create path so timing does not add a
      // second signal on top of the explicit "exists" response.
      await burnPasswordCompare(password);
      await logAuthEvent(request, "register_exists", {
        email: normalizedEmail,
      });
      return NextResponse.json({
        exists: true,
        message:
          "An account with this email already exists. Try signing in instead.",
      });
    }

    // 422 carries the policy failure (password length, malformed address).
    if (result.status === 422 || result.status === 400) {
      await logAuthEvent(request, "register_failed", {
        email: normalizedEmail,
        detail: { code: result.code },
      });
      return NextResponse.json(
        { error: result.message || "Unable to create the account." },
        { status: 400 }
      );
    }

    console.error(
      "Neon Auth sign-up failed:",
      result.status,
      result.code,
      result.message
    );
    return NextResponse.json(
      { error: "Unable to register right now." },
      { status: 500 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Unable to register right now." },
      { status: 500 }
    );
  }
}
