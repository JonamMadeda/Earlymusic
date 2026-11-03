import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/neon";
import { checkRateLimit } from "@/lib/rateLimit";

export async function GET(request: NextRequest) {
  const limited = await checkRateLimit(request, {
    name: "auth-sessions-list",
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { rows } = await db.query(
      `SELECT id, created_at, last_seen_at, expires_at, user_agent, ip
       FROM public.user_sessions
       WHERE user_id = $1
         AND revoked_at IS NULL
         AND expires_at > now()
       ORDER BY last_seen_at DESC`,
      [user.id]
    );

    return NextResponse.json({
      sessions: (rows || []).map((session) => ({
        ...session,
        current: session.id === user.session_id,
      })),
    });
  } catch (error) {
    console.error("Unable to list sessions:", error);
    return NextResponse.json(
      { error: "Unable to load sessions." },
      { status: 500 }
    );
  }
}
