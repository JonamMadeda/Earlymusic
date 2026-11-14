import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { db } from "@/lib/neon";

/**
 * Self-service data export promised by the Privacy Policy. Returns the
 * account, library, listening history, reports the user filed, and consent
 * records as a single JSON download. Access tokens and password material are
 * never included.
 */
export async function GET(request: NextRequest) {
  const limited = await checkRateLimit(request, {
    name: "account-export",
    limit: 5,
    windowMs: 15 * 60_000,
  });
  if (limited) return limited;

  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const [account, sessions, saved, playlists, playlistSongs, recent, reports, consents] =
      await Promise.all([
        db.query(
          `SELECT id, email, name, role, "createdAt" AS created_at,
                  tos_accepted_at, privacy_accepted_at,
                  terms_version, privacy_version, age_attested_at
             FROM neon_auth."user"
            WHERE id = $1`,
          [user.id]
        ),
        db.query(
          `SELECT "createdAt" AS created_at, "expiresAt" AS expires_at,
                  "ipAddress" AS ip, "userAgent" AS user_agent
             FROM neon_auth.session
            WHERE "userId" = $1
            ORDER BY "createdAt" DESC`,
          [user.id]
        ),
        db.query(
          `SELECT ss.id, ss.song_id, ss.created_at, s.title, s.author
             FROM public.saved_songs ss
             LEFT JOIN public.songs s ON s.id = ss.song_id
            WHERE ss.user_id = $1
            ORDER BY ss.created_at DESC`,
          [user.id]
        ),
        db.query(
          `SELECT id, name, created_at
             FROM public.playlists
            WHERE user_id = $1
            ORDER BY created_at DESC`,
          [user.id]
        ),
        db.query(
          `SELECT ps.id, ps.playlist_id, ps.song_id, s.title, s.author
             FROM public.playlist_songs ps
             JOIN public.playlists p ON p.id = ps.playlist_id
             LEFT JOIN public.songs s ON s.id = ps.song_id
            WHERE p.user_id = $1`,
          [user.id]
        ),
        db.query(
          `SELECT rp.id, rp.song_id, rp.played_at, rp.play_count, s.title, s.author
             FROM public.recently_played rp
             LEFT JOIN public.songs s ON s.id = rp.song_id
            WHERE rp.user_id = $1
            ORDER BY rp.played_at DESC`,
          [user.id]
        ),
        db.query(
          // resolution_note is internal admin correspondence; reporter_email
          // is unverified, so it must never reach a self-service export.
          `SELECT id, song_id, report_type, reason, status, created_at, resolved_at
             FROM public.dmca_reports
            WHERE lower(reporter_email) = lower($1)
            ORDER BY created_at DESC`,
          [user.email]
        ),
        db.query(
          `SELECT kind, granted, policy_version, created_at
             FROM public.consent_log
            WHERE user_id = $1
            ORDER BY created_at DESC`,
          [user.id]
        ),
      ]);

    const payload = {
      generated_at: new Date().toISOString(),
      account: account.rows?.[0] || null,
      sessions: sessions.rows || [],
      saved_songs: saved.rows || [],
      playlists: playlists.rows || [],
      playlist_songs: playlistSongs.rows || [],
      recently_played: recent.rows || [],
      reports: reports.rows || [],
      consent_log: consents.rows || [],
    };

    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="luumbo-data-export-${date}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Unable to build account export:", error);
    return NextResponse.json(
      { error: "Unable to build your data export." },
      { status: 500 }
    );
  }
}
