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

    // Neon returns bigint ids as strings, so callers legitimately send either.
    const songId =
      typeof song_id === "number"
        ? song_id
        : typeof song_id === "string" && /^\d+$/.test(song_id.trim())
          ? Number(song_id.trim())
          : NaN;
    if (!Number.isSafeInteger(songId) || songId <= 0) {
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

    // Reporter details are optional, but a malformed address would make the
    // report impossible to answer, so reject it instead of storing it.
    const rawName = typeof reporter_name === "string" ? reporter_name.trim() : "";
    const rawEmail =
      typeof reporter_email === "string" ? reporter_email.trim() : "";
    const reporterName = rawName ? rawName.slice(0, 120) : null;
    const reporterEmail = rawEmail ? rawEmail.slice(0, 254) : null;
    if (
      reporterEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(reporterEmail)
    ) {
      return NextResponse.json(
        { error: "Enter a valid email address, or leave it blank." },
        { status: 400 }
      );
    }

    // Verify the song exists before accepting a report.
    const { rows: songs } = await db.query(
      "SELECT id FROM public.songs WHERE id = $1",
      [songId]
    );
    if (!songs?.length) {
      return NextResponse.json({ error: "Song not found." }, { status: 404 });
    }

    const { rows } = await db.query(
      `INSERT INTO public.dmca_reports (song_id, reason, reporter_name, reporter_email)
       VALUES ($1, $2, $3, $4)
       RETURNING id, song_id, reason, reporter_name, reporter_email, status, created_at`,
      [songId, reason.trim(), reporterName, reporterEmail]
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
