import { NextRequest, NextResponse } from "next/server";
import {
  hashPassword,
  verifyPassword,
  getUserFromRequest,
  bumpTokenVersion,
  revokeAllSessions,
  createSession,
  signSessionToken,
  setSessionCookie,
  getTokenVersion,
} from "@/lib/auth";
import { db } from "@/lib/neon";
import { checkRateLimit } from "@/lib/rateLimit";
import { logAuthEvent } from "@/lib/authAudit";
import { validatePassword } from "@/lib/authValidation";

export async function PATCH(request: NextRequest) {
  const ipLimited = await checkRateLimit(request, {
    name: "auth-update-pw-ip",
    limit: 10,
    windowMs: 60_000,
  });
  if (ipLimited) return ipLimited;

  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const userLimited = await checkRateLimit(request, {
      name: "auth-update-pw-user",
      limit: 5,
      windowMs: 15 * 60_000,
      key: user.id,
    });
    if (userLimited) return userLimited;

    const { currentPassword, password } = await request.json();
    if (
      typeof currentPassword !== "string" ||
      currentPassword.length === 0 ||
      currentPassword.length > 1024
    ) {
      return NextResponse.json(
        { error: "Enter your current password." },
        { status: 400 }
      );
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const { rows } = await db.query(
      "SELECT password_hash FROM public.users WHERE id = $1",
      [user.id]
    );
    const currentHash = rows?.[0]?.password_hash;
    if (!currentHash || !(await verifyPassword(currentPassword, currentHash))) {
      await logAuthEvent(request, "password_changed", {
        userId: user.id,
        email: user.email,
        detail: { result: "wrong_current_password" },
      });
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 400 }
      );
    }

    if (await verifyPassword(password, currentHash)) {
      return NextResponse.json(
        { error: "Choose a password you have not used before." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);
    await db.query("UPDATE public.users SET password_hash = $1 WHERE id = $2", [
      passwordHash,
      user.id,
    ]);

    // Revoke every existing token/session (including the caller's), then
    // mint a fresh session so the current device stays signed in.
    await bumpTokenVersion(user.id);
    await revokeAllSessions(user.id);
    const tokenVersion = await getTokenVersion(user.id);
    const sessionId = await createSession(user.id, request);
    if (!sessionId) {
      return NextResponse.json(
        { error: "Password changed, but the session could not be renewed. Sign in again." },
        { status: 500 }
      );
    }

    const token = await signSessionToken({
      user: { ...user, token_version: tokenVersion },
      sessionId,
    });
    const response = NextResponse.json({ success: true });
    setSessionCookie(response, token);
    await logAuthEvent(request, "password_changed", {
      userId: user.id,
      email: user.email,
    });
    return response;
  } catch (error) {
    console.error("Password update error:", error);
    return NextResponse.json(
      { error: "Unable to update password." },
      { status: 500 }
    );
  }
}
