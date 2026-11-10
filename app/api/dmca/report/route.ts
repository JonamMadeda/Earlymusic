import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { db } from "@/lib/neon";

const str = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: NextRequest) {
  const limited = await checkRateLimit(request, {
    name: "dmca-report",
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const body = await request.json().catch(() => ({}));

    // Neon returns bigint ids as strings, so callers legitimately send either.
    const songId =
      typeof body.song_id === "number"
        ? body.song_id
        : typeof body.song_id === "string" && /^\d+$/.test(body.song_id.trim())
          ? Number(body.song_id.trim())
          : NaN;
    if (!Number.isSafeInteger(songId) || songId <= 0) {
      return NextResponse.json(
        { error: "A valid song id is required." },
        { status: 400 }
      );
    }

    const reportType = body.report_type === "copyright" ? "copyright" : "other";
    const reason = str(body.reason, 1000);
    if (!reason) {
      return NextResponse.json(
        { error: "A reason is required (max 1000 characters)." },
        { status: 400 }
      );
    }

    const reporterName = str(body.reporter_name, 120) || null;
    const reporterEmail = str(body.reporter_email, 254) || null;
    if (reporterEmail && !EMAIL_RE.test(reporterEmail)) {
      return NextResponse.json(
        { error: "Enter a valid email address, or leave it blank." },
        { status: 400 }
      );
    }

    const copyrightedWork = str(body.copyrighted_work, 300) || null;
    const infringingUrl = str(body.infringing_url, 500) || null;
    const reporterAddress = str(body.reporter_address, 300) || null;
    const reporterPhone = str(body.reporter_phone, 40) || null;
    const signature = str(body.signature, 120) || null;
    const goodFaith = body.good_faith === true;
    const accuracyPenalty = body.accuracy_penalty === true;
    const authorizedAgent = body.authorized_agent === true;

    if (reportType === "copyright") {
      if (
        !copyrightedWork ||
        !reporterName ||
        !reporterEmail ||
        !reporterAddress ||
        !signature
      ) {
        return NextResponse.json(
          {
            error:
              "A copyright notice needs the work, your name, email, address, and signature.",
          },
          { status: 400 }
        );
      }
      if (!goodFaith || !accuracyPenalty || !authorizedAgent) {
        return NextResponse.json(
          {
            error:
              "Confirm the good-faith, accuracy, and authority statements.",
          },
          { status: 400 }
        );
      }
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
      `INSERT INTO public.dmca_reports
         (song_id, report_type, reason, reporter_name, reporter_email,
          copyrighted_work, infringing_url, reporter_address, reporter_phone,
          signature, good_faith, accuracy_penalty, authorized_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, song_id, report_type, reason, reporter_name,
                 reporter_email, copyrighted_work, infringing_url,
                 reporter_address, reporter_phone, signature, good_faith,
                 accuracy_penalty, authorized_agent, status, created_at`,
      [
        songId,
        reportType,
        reason,
        reporterName,
        reporterEmail,
        copyrightedWork,
        infringingUrl,
        reporterAddress,
        reporterPhone,
        signature,
        goodFaith,
        accuracyPenalty,
        authorizedAgent,
      ]
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
