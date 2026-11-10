import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { db } from "@/lib/neon";

export async function GET(request: NextRequest) {
  const limited = await checkRateLimit(request, {
    name: "admin-takedown-log",
    limit: 120,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json(
        { error: "Administrator access is required." },
        { status: 403 }
      );
    }

    const { rows } = await db.query(
      `SELECT t.id, t.song_id, t.song_title, t.actor_id, t.reason, t.created_at,
              u.email AS actor_email
         FROM public.takedown_log t
         LEFT JOIN neon_auth."user" u ON u.id = t.actor_id
        ORDER BY t.created_at DESC
        LIMIT 500`
    );

    return NextResponse.json({ entries: rows || [] });
  } catch (error) {
    console.error("Unable to read takedown log:", error);
    return NextResponse.json(
      { error: "Unable to read the takedown log." },
      { status: 500 }
    );
  }
}
