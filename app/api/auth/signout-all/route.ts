import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, getUserFromRequest } from "@/lib/auth";
import { logAuthEvent } from "@/lib/authAudit";
import { db } from "@/lib/neon";

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (user) {
      await db.query(`DELETE FROM neon_auth.session WHERE "userId" = $1`, [
        user.id,
      ]);
      await logAuthEvent(request, "signout_all", {
        userId: user.id,
        email: user.email,
      });
    }
  } catch (error) {
    console.error("Sign-out-all error:", error);
    return NextResponse.json({ error: "Unable to sign out. Please try again." }, { status: 500 });
  }

  const response = NextResponse.json({ success: true });
  clearSessionCookie(response);
  return response;
}
