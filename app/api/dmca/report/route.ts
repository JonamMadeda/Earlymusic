import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { db } from "@/lib/neon";

export async function POST(request: NextRequest) {
  const limited = await checkRateLimit(request, {
    name: "dmca-report",
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const { song_id, reason, reporter_name, reporter_email } = await request
      .json()
      .catch(() => ({}));

    if (!song_id || typeof song_id !== "number") {
      return NextResponse.json(
        { error: "A valid song id is required." },
        { status: 400 }
      );
    }
    if (
      typeof reason !== "string" ||
      !reason.trim() ||
      reason.trim().length > 1000
    ) {
      return NextResponse.json(
        { error: "A reason is required (max 1000 characters)." },
        { status: 400 }
      );
    }

    // Verify the song exists before accepting a report.
    const { rows: songs } = await db.query(
      "SELECT id FROM public.songs WHERE id = $1",
      [song_id]
    );
    if (!songs?.length) {
      return NextResponse.json({ error: "Song not found." }, { status: 404 });
    }

    const { rows } = await db.query(
      `INSERT INTO public.dmca_reports (song_id, reason, reporter_name, reporter_email)
       VALUES ($1, $2, $3, $4)
       RETURNING id, song_id, reason, reporter_name, reporter_email, status, created_at`,
      [song_id, reason.trim(), reporter_name || null, reporter_email || null]
    );

    return NextResponse.json({ report: rows?.[0] }, { status: 201 });
  } catch (error) {
    console.error("Unable to submit DMCA report:", error);
    return NextResponse.json(
      { error: "Unable to submit report." },
      { status: 500 }
    );
  }
}
