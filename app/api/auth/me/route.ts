import { NextRequest, NextResponse } from "next/server";
import {
  getUserFromRequest,
  extendSession,
  signSessionToken,
  setSessionCookie,
  RENEW_WINDOW_MS,
} from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, created_at: user.created_at },
      session: { expiresAt: user.expires_at },
    });

    // Sliding renewal: active users are never logged out on a timer, but
    // an abandoned session still expires after the 30-day window.
    const expiresAt = new Date(user.expires_at).getTime();
    if (Number.isFinite(expiresAt) && expiresAt - Date.now() < RENEW_WINDOW_MS) {
      const newExpiry = await extendSession(user.session_id);
      if (newExpiry) {
        const token = await signSessionToken({
          user,
          sessionId: user.session_id,
        });
        setSessionCookie(response, token);
      }
    }

    return response;
  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json(
      { error: "Unable to verify session." },
      { status: 500 }
    );
  }
}
