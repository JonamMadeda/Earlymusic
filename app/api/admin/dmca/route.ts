import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth";
import { logAdminAction } from "@/lib/adminAudit";
import { checkRateLimit } from "@/lib/rateLimit";
import { db } from "@/lib/neon";

const STATUSES = new Set(["open", "reviewed", "resolved", "dismissed"]);

const str = (value: unknown, max = 2000) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export async function GET(request: NextRequest) {
  const limited = await checkRateLimit(request, {
    name: "admin-dmca-list",
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const values: string[] = [];
    let where = "";
    if (status && STATUSES.has(status)) {
      values.push(status);
      where = "WHERE r.status = $1";
    }

    const { rows } = await db.query(
      `SELECT r.*,
              s.title AS song_title,
              s.author AS song_author,
              s.status AS song_status
         FROM public.dmca_reports r
         LEFT JOIN public.songs s ON s.id = r.song_id
         ${where}
         ORDER BY r.created_at DESC
         LIMIT 250`,
      values
    );

    return NextResponse.json({ reports: rows || [] });
  } catch (error) {
    console.error("Unable to read DMCA reports:", error);
    return NextResponse.json(
      { error: "Unable to read reports." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const limited = await checkRateLimit(request, {
    name: "admin-dmca-update",
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

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const id = str(body.id, 64);
    if (!id) {
      return NextResponse.json({ error: "A report id is required." }, { status: 400 });
    }

    // Effective takedown: disable access to the track immediately, write the
    // audit row, and close the report. Deleting the song is a separate action
    // because it also removes the R2 object.
    if (body.action === "takedown") {
      const { rows: reports } = await db.query(
        "SELECT id, song_id, reason FROM public.dmca_reports WHERE id = $1",
        [id]
      );
      const report = reports?.[0];
      if (!report) {
        return NextResponse.json({ error: "Report not found." }, { status: 404 });
      }

      const { rows: songs } = await db.query(
        "SELECT id, title FROM public.songs WHERE id = $1",
        [report.song_id]
      );
      const song = songs?.[0];
      if (!song) {
        return NextResponse.json({ error: "Song not found." }, { status: 404 });
      }

      await db.query(
        "UPDATE public.songs SET status = 'rejected' WHERE id = $1",
        [report.song_id]
      );

      try {
        await db.query(
          `INSERT INTO public.takedown_log (song_id, song_title, actor_id, reason)
           VALUES ($1, $2, $3, $4)`,
          [
            report.song_id,
            song.title,
            admin.user.id,
            `Copyright takedown from report ${id}: ${report.reason}`.slice(0, 1000),
          ]
        );
      } catch (logError) {
        console.error("Unable to write takedown_log entry:", logError);
      }

      const note =
        str(body.resolution_note, 2000) ||
        "Track disabled after a copyright report.";

      const { rows: updated } = await db.query(
        `UPDATE public.dmca_reports
            SET status = 'resolved',
                resolution_note = $2,
                resolved_at = now(),
                resolved_by = $3,
                updated_at = now()
          WHERE id = $1
          RETURNING *`,
        [id, note, admin.user.id]
      );

      await logAdminAction({
        actorId: admin.user.id,
        action: "song.takedown",
        target: String(report.song_id),
        detail: { report_id: id },
      });

      return NextResponse.json({ report: updated?.[0] || null, takedown: true });
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (body.status !== undefined) {
      const status = str(body.status, 20);
      if (!STATUSES.has(status)) {
        return NextResponse.json({ error: "Invalid report status." }, { status: 400 });
      }
      fields.push(`status = $${idx++}`);
      values.push(status);
      if (status === "resolved" || status === "dismissed") {
        fields.push("resolved_at = now()");
        fields.push(`resolved_by = $${idx++}`);
        values.push(admin.user.id);
      } else {
        fields.push("resolved_at = NULL");
        fields.push("resolved_by = NULL");
      }
    }

    if (body.resolution_note !== undefined) {
      fields.push(`resolution_note = $${idx++}`);
      values.push(str(body.resolution_note, 2000) || null);
    }

    if (body.reply_sent === true) {
      fields.push("reply_sent_at = now()");
    }

    if (!fields.length) {
      return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    }

    fields.push("updated_at = now()");
    values.push(id);

    const { rows } = await db.query(
      `UPDATE public.dmca_reports
          SET ${fields.join(", ")}
        WHERE id = $${idx}
        RETURNING *`,
      values
    );
    if (!rows?.length) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    await logAdminAction({
      actorId: admin.user.id,
      action: "dmca.update",
      target: id,
      detail: { status: rows[0].status },
    });

    return NextResponse.json({ report: rows[0] });
  } catch (error) {
    console.error("Unable to update DMCA report:", error);
    return NextResponse.json(
      { error: "Unable to update the report." },
      { status: 500 }
    );
  }
}
