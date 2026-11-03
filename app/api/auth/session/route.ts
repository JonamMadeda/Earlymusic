import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  verifyToken,
  verifyLegacyToken,
  getUserFromRequest,
  getTokenVersion,
  bumpTokenVersion,
  revokeAllSessions,
  createSession,
  signSessionToken,
  setSessionCookie,
} from "@/lib/auth";
import { db } from "@/lib/neon";
import { checkRateLimit } from "@/lib/rateLimit";
import { logAuthEvent } from "@/lib/authAudit";

/**
 * One-time migration endpoint for sessions issued before the HttpOnly
 * cookie hardening. The client sends its old localStorage bearer token
 * here once; we verify it, revoke all legacy tokens for that user, and
 * return a normal cookie session.
 *
 * New session tokens (which carry a sid) are also accepted so a stale
 * cookie can be refreshed after a browser restart.
 */
export async function POST(request: NextRequest) {
  const limited = await checkRateLimit(request, {
    name: "auth-session",
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const bearer = request.headers
      .get("authorization")
      ?.match(/^Bearer\s+(.+)$/i)?.[1];
    const token =
      bearer || request.cookies?.get?.(SESSION_COOKIE)?.value || null;
    if (!token) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    // Current session tokens verify with issuer/audience.
    const sessionPayload = await verifyToken(token);
    if (sessionPayload?.sid) {
      const user = await getUserFromRequest(request);
      if (!user) {
        return NextResponse.json(
          { error: "Not authenticated." },
          { status: 401 }
        );
      }
      const response = NextResponse.json({
        user: { id: user.id, email: user.email, created_at: user.created_at },
      });
      setSessionCookie(response, token);
      return response;
    }

    // Otherwise this is a pre-hardening token: signature only.
    const payload = await verifyLegacyToken(token);
    if (!payload?.sub) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { rows } = await db.query(
      "SELECT id, email, created_at, token_version FROM public.users WHERE id = $1",
      [payload.sub]
    );
    const user = rows?.[0];
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    if (payload.tv !== undefined && payload.tv !== user.token_version) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    // Legacy tokens cannot be revoked individually (no sid), so bump the
    // version once: every old token for this user dies, then this device
    // gets a normal revocable session.
    await bumpTokenVersion(user.id);
    await revokeAllSessions(user.id);
    const tokenVersion = await getTokenVersion(user.id);
    const sessionId = await createSession(user.id, request);
    if (!sessionId) {
      return NextResponse.json(
        { error: "Unable to start a session." },
        { status: 500 }
      );
    }

    const newToken = await signSessionToken({
      user: { ...user, token_version: tokenVersion },
      sessionId,
    });
    const response = NextResponse.json({
      user: { id: user.id, email: user.email, created_at: user.created_at },
    });
    setSessionCookie(response, newToken);
    await logAuthEvent(request, "session_migrated", {
      userId: user.id,
      email: user.email,
    });
    return response;
  } catch (error) {
    console.error("Session migration error:", error);
    return NextResponse.json(
      { error: "Unable to verify session." },
      { status: 500 }
    );
  }
}
