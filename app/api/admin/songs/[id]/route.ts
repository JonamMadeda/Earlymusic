import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth";
import { logAdminAction } from "@/lib/adminAudit";
import { checkRateLimit } from "@/lib/rateLimit";
import { getR2Client } from "@/lib/r2";
import { verifyStoredAudio, getR2ObjectKey } from "@/lib/audioVerify";
import { announceNewSong, announceSongUpdate, retractSongAnnouncements } from "@/lib/announcement";
import { db } from "@/lib/neon";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = await checkRateLimit(request, { name: "song-update", limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    }

    const { id } = await params;
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ error: "Invalid song id." }, { status: 400 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const { rows: existingRows } = await db.query(
      "SELECT status, song_path, region_restricted, allowed_countries FROM public.songs WHERE id = $1",
      [id]
    );
    const existing = existingRows?.[0];
    if (!existing) {
      return NextResponse.json({ error: "Song not found." }, { status: 404 });
    }

    // Replace-audio flow swaps the referenced file — verify the new object
    // the same way creation does, then store the hostname-relative form so
    // rows created and updated after normalization stay env-independent.
    const replacingAudio = body.song_path !== undefined;
    const approving = body.status === "approved" && existing.status !== "approved";
    if (replacingAudio || approving) {
      const audioPath = replacingAudio ? body.song_path : existing.song_path;
      if (typeof audioPath !== "string" || !audioPath) {
        return NextResponse.json({ error: "Upload audio before approving this track." }, { status: 400 });
      }
      const stored = await verifyStoredAudio(audioPath);
      if (!stored.ok) {
        return NextResponse.json({ error: stored.error || "Audio verification failed." }, { status: 400 });
      }
      if (replacingAudio) body.song_path = `/${getR2ObjectKey(audioPath)}`;
    }
    // Compare object keys, not strings: a legacy row may still hold an
    // absolute R2 URL for the very file the admin just re-selected, which is
    // a re-save rather than a new recording.
    const previousSongPath = typeof existing.song_path === "string" ? existing.song_path : null;
    const audioReplaced =
      typeof body.song_path === "string" &&
      getR2ObjectKey(body.song_path) !== getR2ObjectKey(previousSongPath || "");

    const fields: string[] = [];
    const changedColumns: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const key of ["title", "author", "song_path", "category", "duration", "copyright_holder", "license_type", "license_url", "rights_clearance_date", "status", "region_restricted", "download_allowed"] as const) {
      if (body[key] !== undefined) {
        // status is NOT NULL with a CHECK constraint: reject bad values here
        // instead of letting "" become null and surface as a generic 500.
        if (key === "status" && !["pending", "approved", "rejected"].includes(body[key] as string)) {
          return NextResponse.json({ error: "Status must be pending, approved, or rejected." }, { status: 400 });
        }
        fields.push(`${key} = $${idx}`);
        changedColumns.push(key);
        values.push(typeof body[key] === "string" && body[key].trim() === "" ? null : body[key]);
        idx++;
      }
    }
    let normalizedCountries: string[] | null = null;
    if (body.allowed_countries !== undefined) {
      const raw = body.allowed_countries;
      const codes = Array.isArray(raw)
        ? raw
        : typeof raw === "string"
          ? raw.split(",")
          : [];
      normalizedCountries = codes
        .map((code) => String(code).trim().toUpperCase())
        .filter((code) => /^[A-Z]{2}$/.test(code));
    }
    if (body.region_restricted !== undefined || normalizedCountries !== null) {
      const restricted = body.region_restricted !== undefined
        ? body.region_restricted === true
        : existing.region_restricted === true;
      const storedCodes = (Array.isArray(existing.allowed_countries) ? existing.allowed_countries : [])
        .map((code: unknown) => String(code).trim().toUpperCase())
        .filter((code: string) => /^[A-Z]{2}$/.test(code));
      // A NULL allowlist with region_restricted hides the track everywhere geo
      // is known but fails open where it is not — reject it instead.
      if (restricted && (normalizedCountries ?? storedCodes).length === 0) {
        return NextResponse.json(
          { error: "Region-restricted tracks require at least one valid two-letter country code." },
          { status: 400 }
        );
      }
    }
    if (normalizedCountries !== null) {
      fields.push(`allowed_countries = $${idx}::text[]`);
      changedColumns.push("allowed_countries");
      values.push(normalizedCountries.length ? `{${normalizedCountries.join(",")}}` : null);
      idx++;
    }
    if (body.original_songs !== undefined) {
      // jsonb column: explicit cast so string params are accepted.
      fields.push(`original_songs = $${idx}::jsonb`);
      changedColumns.push("original_songs");
      const v = body.original_songs;
      values.push(
        v == null || (Array.isArray(v) && v.length === 0)
          ? null
          : typeof v === "string" ? v : JSON.stringify(v)
      );
      idx++;
    }
    if (!fields.length) {
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
    }

    values.push(id);
    const { rows } = await db.query(
      `UPDATE public.songs SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!rows?.length) {
      return NextResponse.json({ error: "Song not found." }, { status: 404 });
    }

    const updatedSong = rows[0];

    // Announce only approved tracks: the tile links to /share/<id>, which
    // 404s otherwise. Approval posts the release tile (deduped inside
    // announceNewSong); edits to an already-approved track post an update.
    if (updatedSong.status === "approved") {
      if (existing.status === "approved") {
        await announceSongUpdate(updatedSong, { audioReplaced });
      } else {
        await announceNewSong(updatedSong);
      }
    } else if (existing.status === "approved") {
      await retractSongAnnouncements(id);
    }

    await logAdminAction({
      actorId: admin.user.id,
      action: "song.update",
      target: id,
      detail: {
        title: updatedSong.title,
        columns: changedColumns,
        ...(audioReplaced
          ? { audio_replaced: true, song_path_before: previousSongPath, song_path_after: updatedSong.song_path }
          : null),
      },
    });

    return NextResponse.json({ song: updatedSong });
  } catch (error) {
    console.error("Unable to update song:", error);
    return NextResponse.json({ error: "Unable to update the song." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = await checkRateLimit(request, { name: "song-delete", limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    }

    const { id } = await params;
    let songPath: unknown;
    try {
      ({ songPath } = await request.json());
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    if (!/^\d+$/.test(id) || typeof songPath !== "string") {
      return NextResponse.json({ error: "Invalid song deletion request." }, { status: 400 });
    }

    const { rows: songs } = await db.query(
      "SELECT id, song_path FROM public.songs WHERE id = $1",
      [id]
    );
    const song = songs?.[0];
    if (!song) {
      return NextResponse.json({ error: "Song not found." }, { status: 404 });
    }
    if (song.song_path !== songPath) {
      return NextResponse.json({ error: "Song path does not match the stored record." }, { status: 400 });
    }

    const objectKey = getR2ObjectKey(songPath);
    if (objectKey) {
      try {
        await getR2Client().send(new DeleteObjectCommand({
          Bucket: process.env.R2BUCKETNAME,
          Key: objectKey,
        }));
      } catch (r2Error) {
        console.error("Unable to delete R2 object:", r2Error);
        return NextResponse.json({ error: "Unable to delete the audio file. Please try again." }, { status: 500 });
      }
    }

    // NOTE: the Neon HTTP driver returns only rows (no rowCount), so a
    // bare DELETE yields no usable count — RETURNING makes the check real.
    const { rows: deleted } = await db.query("DELETE FROM public.songs WHERE id = $1 RETURNING id, title", [id]);
    if (!deleted?.length) {
      return NextResponse.json({ error: "Song not found." }, { status: 404 });
    }

    // Record the takedown for legal audit trail. This runs after the song row
    // is gone, so the log must not depend on a live foreign key: the migration
    // drops `takedown_log_song_id_fkey` and keeps song_id as a plain id.
    // A logging failure must not report the already-completed deletion as a
    // failure, so it is reported separately instead of aborting the request.
    try {
      await db.query(
        `INSERT INTO public.takedown_log (song_id, song_title, actor_id, reason)
         VALUES ($1, $2, $3, $4)`,
        [id, deleted[0].title, admin.user.id, "Administrator deleted song and audio file."]
      );
    } catch (logError) {
      console.error("Unable to write takedown_log entry:", logError);
    }

    // The "New release" tile posted for this track would otherwise outlive it
    // and open an invalid share page.
    await retractSongAnnouncements(id);

    await logAdminAction({
      actorId: admin.user.id,
      action: "song.delete",
      target: id,
      detail: { song_path: songPath },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unable to delete song:", error);
    return NextResponse.json({ error: "Unable to delete the song." }, { status: 500 });
  }
}
