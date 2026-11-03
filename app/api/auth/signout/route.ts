import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, getUserFromRequest } from "@/lib/auth";
import { logAuthEvent } from "@/lib/authAudit";
import { db } from "@/lib/neon";

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (user?.session_id) {
      // Revoking the session row invalidates the cookie immediately.
      await db.query(
        `DELETE FROM neon_auth.session WHERE id = $1 AND "userId" = $2`,
        [user.session_id, user.id]
      );
      await logAuthEvent(request, "signout", {
        userId: user.id,
        email: user.email,
      });
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
