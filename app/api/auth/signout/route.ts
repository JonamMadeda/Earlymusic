import { NextRequest, NextResponse } from "next/server";
import {
  getUserFromRequest,
  getLegacyUserFromRequest,
  revokeSession,
  revokeAllSessions,
  bumpTokenVersion,
  clearSessionCookie,
} from "@/lib/auth";
import { logAuthEvent } from "@/lib/authAudit";

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (user?.session_id) {
      await revokeSession(user.session_id, user.id);
      await logAuthEvent(request, "signout", {
        userId: user.id,
        email: user.email,
      });
    } else {
      // A pre-hardening bearer token has no session row. Revoke it (and
      // any other legacy tokens) so "log out" still means something.
      const legacy = await getLegacyUserFromRequest(request);
      if (legacy) {
        await bumpTokenVersion(legacy.id);
        await revokeAllSessions(legacy.id);
        await logAuthEvent(request, "signout", {
          userId: legacy.id,
          email: legacy.email,
        });
      }
    }
  } catch (error) {
    console.error("Sign-out error:", error);
  }

  // Always clear the cookie, even if revocation failed; the client must
  // never be left holding a session it thinks is gone.
  const response = NextResponse.json({ success: true });
  clearSessionCookie(response);
  return response;
}
