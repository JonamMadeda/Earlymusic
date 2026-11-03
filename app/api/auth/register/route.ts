import { NextRequest, NextResponse } from "next/server";
import {
  hashPassword,
  createSession,
  signSessionToken,
  setSessionCookie,
} from "@/lib/auth";
import { db } from "@/lib/neon";
import { checkRateLimit } from "@/lib/rateLimit";
import { logAuthEvent } from "@/lib/authAudit";
import {
  normalizeEmail,
  validateEmail,
  validatePassword,
} from "@/lib/authValidation";

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

    const existing = await db.query(
      "SELECT id FROM public.users WHERE lower(email) = $1",
      [normalizedEmail]
    );
    if (existing.rows?.length) {
      // Same bcrypt cost as the create path so timing does not add a
      // second signal on top of the explicit "exists" response.
      await hashPassword(`timing-noise-${normalizedEmail}-${Date.now()}`);
      await logAuthEvent(request, "register_exists", {
        email: normalizedEmail,
      });
      return NextResponse.json({
        exists: true,
        message:
          "An account with this email already exists. Try signing in instead.",
      });
    }

    const passwordHash = await hashPassword(password);
    const result = await db.query(
      `INSERT INTO public.users (email, password_hash)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING id, email, created_at, token_version`,
      [normalizedEmail, passwordHash]
    );
    const user = result.rows?.[0];

    // Lost the race against a concurrent registration: behave like the
    // existing-account path instead of returning a 500.
    if (!user) {
      await hashPassword(`timing-noise-${normalizedEmail}-${Date.now()}`);
      await logAuthEvent(request, "register_exists", {
        email: normalizedEmail,
      });
      return NextResponse.json({
        exists: true,
        message:
          "An account with this email already exists. Try signing in instead.",
      });
    }

    // Profile creation is cosmetic; never fail registration (and leave
    // an unusable account) because this insert failed.
    try {
      await db.query(
        "INSERT INTO public.profiles (id) VALUES ($1) ON CONFLICT DO NOTHING",
        [user.id]
      );
    } catch (error) {
      console.error("Unable to create profile for new user:", error);
    }

    const sessionId = await createSession(user.id, request);
    if (!sessionId) {
      return NextResponse.json(
        { error: "Unable to start a session." },
        { status: 500 }
      );
    }

    const token = await signSessionToken({ user, sessionId });
    const response = NextResponse.json({
      user: { id: user.id, email: user.email, created_at: user.created_at },
    });
    setSessionCookie(response, token);
    await logAuthEvent(request, "register_success", {
      userId: user.id,
      email: user.email,
    });
    return response;
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Unable to register right now." },
      { status: 500 }
    );
  }
}
