import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { db } from "@/lib/neon";

// Aggregate-only user metrics for the admin Insights tab.
// No per-user rows ever leave this endpoint (counts and tops only).
export async function GET(request: NextRequest) {
  const limited = checkRateLimit(request, { name: "admin-metrics", limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    }

    // The live recently_played timestamp column is played_at (see
    // PlayerContext sync); older schemas used created_at — detect it so
    // this endpoint works against either.
    let tsCol = "played_at";
    try {
      const { rows: cols } = await db.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'recently_played'`
      );
      const names = new Set((cols || []).map((c: any) => c.column_name));
      if (!names.has("played_at")) tsCol = "created_at";
    } catch {
      tsCol = "played_at";
    }
    // Interpolated below, but strictly our own allowlisted identifier.
    if (tsCol !== "played_at" && tsCol !== "created_at") tsCol = "played_at";

    const { rows: userRows } = await db.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS d7,
              COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS d30
       FROM public.users`
    );

    const { rows: signupRows } = await db.query(
      `SELECT TO_CHAR(DATE(created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
       FROM public.users
       WHERE created_at >= NOW() - INTERVAL '14 days'
       GROUP BY 1 ORDER BY 1`
    );

    const { rows: activeRows } = await db.query(
      `SELECT COUNT(DISTINCT user_id) FILTER (WHERE ${tsCol} >= NOW() - INTERVAL '1 day')::int AS dau,
              COUNT(DISTINCT user_id) FILTER (WHERE ${tsCol} >= NOW() - INTERVAL '7 days')::int AS wau,
              COUNT(DISTINCT user_id) FILTER (WHERE ${tsCol} >= NOW() - INTERVAL '30 days')::int AS mau,
              COUNT(DISTINCT user_id)::int AS total_listeners
       FROM public.recently_played`
    );

    const { rows: playRows } = await db.query(
      `SELECT TO_CHAR(DATE(${tsCol}), 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
       FROM public.recently_played
       WHERE ${tsCol} >= NOW() - INTERVAL '14 days'
       GROUP BY 1 ORDER BY 1`
    );

    const { rows: topRows } = await db.query(
      `SELECT rp.song_id, s.title, s.author,
              COUNT(DISTINCT rp.user_id)::int AS listeners,
              MAX(rp.${tsCol}) AS last_played
       FROM public.recently_played rp
       LEFT JOIN public.songs s ON s.id = rp.song_id
       GROUP BY rp.song_id, s.title, s.author
       ORDER BY listeners DESC, last_played DESC
       LIMIT 10`
    );

    const { rows: saveRows } = await db.query(`SELECT COUNT(*)::int AS total FROM public.saved_songs`);
    const { rows: plRows } = await db.query(`SELECT COUNT(*)::int AS total FROM public.playlists`);

    const users = userRows?.[0] || { total: 0, d7: 0, d30: 0 };
    const active = activeRows?.[0] || { dau: 0, wau: 0, mau: 0, total_listeners: 0 };

    return NextResponse.json({
      users: {
        total: users.total || 0,
        d7: users.d7 || 0,
        d30: users.d30 || 0,
        perDay: signupRows || [],
      },
      active: {
        dau: active.dau || 0,
        wau: active.wau || 0,
        mau: active.mau || 0,
        totalListeners: active.total_listeners || 0,
      },
      playsPerDay: playRows || [],
      topSongs: (topRows || []).map((r: any) => ({
        song_id: r.song_id,
        title: r.title || "Unknown track",
        author: r.author || "Unknown artist",
        listeners: r.listeners || 0,
        last_played: r.last_played,
      })),
      totals: {
        saved: saveRows?.[0]?.total || 0,
        playlists: plRows?.[0]?.total || 0,
      },
    });
  } catch (error) {
    console.error("Unable to read admin metrics:", error);
    return NextResponse.json({ error: "Unable to read metrics." }, { status: 500 });
  }
}
