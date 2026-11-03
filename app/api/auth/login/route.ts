import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { logAuthEvent } from "@/lib/authAudit";
import { normalizeEmail, validateEmail } from "@/lib/authValidation";
import { setSessionCookie } from "@/lib/auth";
import {
  NEON_AUTH_ERRORS,
  resolveAuthOrigin,
  signInWithNeonAuth,
} from "@/lib/neonAuth";
import {
  burnPasswordCompare,
  findLegacyCredentialByEmail,
  markLegacyUpgraded,
  verifyLegacyPassword,
  writeCredentialAccount,
} from "@/lib/credentials";

const publicUser = (user: any) => ({
  id: user.id,
  email: user.email,
  name: user.name || null,
  created_at: user.createdAt || null,
});

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

    // Malformed addresses never reach Neon Auth: they would still cost a
    // round trip and leak which inputs are worth trying.
    if (validateEmail(normalizedEmail)) {
      await burnPasswordCompare(password);
      await logAuthEvent(request, "login_failed", {
        email: normalizedEmail.slice(0, 254),
      });
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const origin = resolveAuthOrigin(request);
    const result = await signInWithNeonAuth({
      email: normalizedEmail,
      password,
      origin,
    });

    if (result.ok) {
      if (!result.sessionValue) {
        return NextResponse.json(
          { error: "Unable to start a session." },
          { status: 500 }
        );
      }
      const response = NextResponse.json({
        user: publicUser(result.data.user),
      });
      setSessionCookie(response, result.sessionValue);
      await logAuthEvent(request, "login_success", {
        userId: result.data.user.id,
        email: result.data.user.email,
      });
      return response;
    }

    if (result.code === NEON_AUTH_ERRORS.invalidCredentials) {
      // Accounts that predate Neon Auth still hold a bcrypt hash. Verify it
      // once, write the Neon Auth credential, and sign them in for real.
      const legacy = await findLegacyCredentialByEmail(normalizedEmail);
      if (!legacy) {
        await burnPasswordCompare(password);
        await logAuthEvent(request, "login_failed", { email: normalizedEmail });
        return NextResponse.json(
          { error: "Invalid email or password." },
          { status: 401 }
        );
      }

      const valid = await verifyLegacyPassword(password, legacy.password_hash);
      if (!valid) {
        await logAuthEvent(request, "login_failed", { email: normalizedEmail });
        return NextResponse.json(
          { error: "Invalid email or password." },
          { status: 401 }
        );
      }

      try {
        await writeCredentialAccount(legacy.user_id, password);
        await markLegacyUpgraded(legacy.user_id);
      } catch (error) {
        console.error("Unable to upgrade legacy credentials:", error);
        return NextResponse.json(
          { error: "Unable to sign in right now." },
          { status: 500 }
        );
      }

      const retry = await signInWithNeonAuth({
        email: normalizedEmail,
        password,
        origin,
      });
      if (!retry.ok || !retry.sessionValue) {
        await logAuthEvent(request, "login_failed", { email: normalizedEmail });
        return NextResponse.json(
          { error: "Invalid email or password." },
          { status: 401 }
        );
      }

      const response = NextResponse.json({
        user: publicUser(retry.data.user),
      });
      setSessionCookie(response, retry.sessionValue);
      await logAuthEvent(request, "login_success", {
        userId: retry.data.user.id,
        email: retry.data.user.email,
        detail: { upgraded_legacy_account: true },
      });
      return response;
    }

    console.error(
      "Neon Auth sign-in failed:",
      result.status,
      result.code,
      result.message
    );
    return NextResponse.json(
      { error: "Unable to sign in right now." },
      { status: 500 }
    );
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Unable to sign in right now." },
      { status: 500 }
    );
  }
}
