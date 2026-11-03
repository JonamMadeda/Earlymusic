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
      `SELECT id,
              "createdAt" AS created_at,
              "updatedAt" AS last_seen_at,
              "expiresAt" AS expires_at,
              "userAgent" AS user_agent,
              "ipAddress" AS ip
       FROM neon_auth.session
       WHERE "userId" = $1
         AND "expiresAt" > now()
       ORDER BY "updatedAt" DESC`,
      [user.id]
    );

    return NextResponse.json({
      sessions: (rows || []).map((session: any) => ({
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
