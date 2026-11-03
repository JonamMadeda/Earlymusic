import { NextRequest, NextResponse } from "next/server";
import {
  getUserFromRequest,
  revokeAllSessions,
  bumpTokenVersion,
  clearSessionCookie,
} from "@/lib/auth";
import { logAuthEvent } from "@/lib/authAudit";

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (user) {
      await bumpTokenVersion(user.id);
      await revokeAllSessions(user.id);
      await logAuthEvent(request, "signout_all", {
        userId: user.id,
        email: user.email,
      });
    }
  } catch (error) {
    console.error("Sign-out-all error:", error);
  }

  const response = NextResponse.json({ success: true });
  clearSessionCookie(response);
  return response;
}
