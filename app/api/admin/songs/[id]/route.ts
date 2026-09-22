import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth";
import { logAdminAction } from "@/lib/adminAudit";
import { checkRateLimit } from "@/lib/rateLimit";
import { getR2Client } from "@/lib/r2";
import { db } from "@/lib/neon";

const getR2ObjectKey = (songPath: string) => {
  const publicBaseUrl = process.env.R2PUBLICURL?.replace(/\/$/, "");
  if (!publicBaseUrl || !songPath.startsWith(`${publicBaseUrl}/`)) return null;
  return decodeURIComponent(songPath.slice(publicBaseUrl.length + 1));
};

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = checkRateLimit(request, { name: "song-delete", limit: 120, windowMs: 60_000 });
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
    const { rows: deleted } = await db.query("DELETE FROM public.songs WHERE id = $1 RETURNING id", [id]);
    if (!deleted?.length) {
      return NextResponse.json({ error: "Song not found." }, { status: 404 });
    }

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
