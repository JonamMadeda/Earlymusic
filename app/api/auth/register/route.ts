import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { logAuthEvent } from "@/lib/authAudit";
import {
  normalizeEmail,
  validateEmail,
  validatePassword,
} from "@/lib/authValidation";
import {
  NEON_AUTH_ERRORS,
  resolveAuthOrigin,
  sendVerificationEmailWithNeonAuth,
  signUpWithNeonAuth,
} from "@/lib/neonAuth";
import { burnPasswordCompare } from "@/lib/credentials";
import { db } from "@/lib/neon";
import { getClientIp } from "@/lib/requestIp";
import { LEGAL_MIN_AGE, LEGAL_PRIVACY_VERSION, LEGAL_TERMS_VERSION } from "@/lib/legal";

// Neon Auth requires a non-empty display name, so the sign-up form's
// first/last pair is collapsed into it and read back apart by /api/profiles.
const cleanNamePart = (value: unknown) =>
  typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().replace(/\s+/g, " ").slice(0, 40)
    : "";

export async function POST(request: NextRequest) {
  const ipLimited = await checkRateLimit(request, {
    name: "auth-register-ip",
    limit: 10,
    windowMs: 60_000,
  });
  if (ipLimited) return ipLimited;

  try {
    const { email, password, first_name, last_name, tos_accepted, privacy_accepted, age_attested } = await request.json();
    if (typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    if (tos_accepted !== true || privacy_accepted !== true) {
      return NextResponse.json(
        { error: "You must accept the Terms of Service and Privacy Policy." },
        { status: 400 }
      );
    }

    if (age_attested !== true) {
      return NextResponse.json(
        { error: "You must confirm that you meet the minimum age requirement." },
        { status: 400 }
      );
    }

    const firstName = cleanNamePart(first_name);
    const lastName = cleanNamePart(last_name);
    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "Enter your first and last name." },
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
      name: `${firstName} ${lastName}`,
      origin: resolveAuthOrigin(request),
    });

    if (result.ok) {
      const origin = resolveAuthOrigin(request);
      const verification = await sendVerificationEmailWithNeonAuth({
        email: result.data.user.email,
        origin,
      });

      const sessionToken = result.data.token || result.sessionValue?.split(".")[0];
      if (sessionToken) {
        await db.query(`DELETE FROM neon_auth.session WHERE token = $1`, [
          sessionToken,
        ]);
      }

      if (!verification.ok) {
        await db.query(`DELETE FROM neon_auth.user WHERE id = $1`, [
          result.data.user.id,
        ]);
        await logAuthEvent(request, "register_failed", {
          email: normalizedEmail,
          detail: { verification_send_failed: true },
        });
        return NextResponse.json(
          { error: "Unable to send a verification email. Please try again." },
          { status: 502 }
        );
      }

      await logAuthEvent(request, "register_success", {
        userId: result.data.user.id,
        email: result.data.user.email,
      });

      // Record that the user accepted the Terms and Privacy Policy and attested
      // to the minimum age at sign-up, then keep an append-only audit row.
      try {
        await db.query(
          `UPDATE neon_auth."user"
              SET tos_accepted_at = now(),
                  privacy_accepted_at = now(),
                  terms_version = $2,
                  privacy_version = $3,
                  age_attested_at = now()
            WHERE id = $1`,
          [result.data.user.id, LEGAL_TERMS_VERSION, LEGAL_PRIVACY_VERSION]
        );
      } catch (error) {
        console.error("Unable to store sign-up consent:", error);
      }

      try {
        const ip = getClientIp(request);
        const userAgent = request.headers.get("user-agent") || null;
        await db.query(
          `INSERT INTO public.consent_log
             (user_id, kind, granted, policy_version, ip, user_agent)
           VALUES ($1, 'terms', TRUE, $2, $4, $5),
                  ($1, 'privacy', TRUE, $3, $4, $5),
                  ($1, 'age', TRUE, $6, $4, $5)`,
          [
            result.data.user.id,
            LEGAL_TERMS_VERSION,
            LEGAL_PRIVACY_VERSION,
            ip,
            userAgent,
            String(LEGAL_MIN_AGE),
          ]
        );
      } catch (error) {
        console.error("Unable to write sign-up consent log:", error);
      }

      return NextResponse.json({ verificationRequired: true });
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
