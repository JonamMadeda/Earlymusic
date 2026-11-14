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
  getCredentialAccount,
  markLegacyUpgraded,
  verifyLegacyPassword,
  writeCredentialAccount,
} from "@/lib/credentials";
import { db } from "@/lib/neon";

const publicUser = (user: any) => ({
  id: user.id,
  email: user.email,
  name: user.name || null,
  created_at: user.createdAt || null,
});

// The policy columns live on our own user table, not in Neon Auth's sign-in
// payload. Include them so the re-consent banner can tell whether the account
// already accepted the current versions.
const policyFields = async (userId: string) => {
  try {
    const { rows } = await db.query(
      `SELECT tos_accepted_at, privacy_accepted_at, terms_version,
              privacy_version, age_attested_at
         FROM neon_auth."user"
        WHERE id = $1`,
      [userId]
    );
    return rows?.[0] || {};
  } catch {
    return {};
  }
};

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

      if (!result.data.user.emailVerified) {
        // Only accounts still authenticating against their bcrypt hash get a
        // pass on verification. Once the account has been upgraded to a native
        // Neon credential, Neon owns the verification state and an unverified
        // address has to be proven before it can open a session.
        const { rows: legacyRows } = await db.query(
          `SELECT 1 FROM public.legacy_credentials
            WHERE user_id = $1 AND upgraded_at IS NULL LIMIT 1`,
          [result.data.user.id]
        );
        if (!legacyRows.length) {
          await db.query(`DELETE FROM neon_auth.session WHERE token = $1`, [
            result.data.token || result.sessionValue.split(".")[0],
          ]);
          return NextResponse.json(
            {
              error: "Verify your email before signing in.",
              code: "EMAIL_NOT_VERIFIED",
            },
            { status: 403 }
          );
        }
      }

      const response = NextResponse.json({
        user: {
          ...publicUser(result.data.user),
          ...(await policyFields(result.data.user.id)),
        },
      });
      setSessionCookie(response, result.sessionValue);
      await logAuthEvent(request, "login_success", {
        userId: result.data.user.id,
        email: result.data.user.email,
      });
      return response;
    }

    if (result.code === "EMAIL_NOT_VERIFIED") {
      return NextResponse.json(
        {
          error: "Verify your email before signing in.",
          code: "EMAIL_NOT_VERIFIED",
        },
        { status: 403 }
      );
    }

    if (result.code === NEON_AUTH_ERRORS.invalidCredentials) {
      // Accounts that predate Neon Auth still hold a bcrypt hash. Verify it
      // once, write the Neon Auth credential, and sign them in for real.
      const legacy = await findLegacyCredentialByEmail(normalizedEmail);
      // Once Neon Auth has a credential row for the account, that hash is the
      // only one allowed to open it. Password resets are completed inside
      // Neon now, and Neon does not touch legacy_credentials.upgraded_at, so
      // without this check the pre-reset password would keep signing the
      // account in through this fallback.
      const neonOwnedCredential =
        legacy && (await getCredentialAccount(legacy.user_id));
      if (!legacy || neonOwnedCredential) {
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
        user: {
          ...publicUser(retry.data.user),
          ...(await policyFields(retry.data.user.id)),
        },
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
