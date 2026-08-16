import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/adminAuth";
import { getR2Client } from "@/lib/r2";

const getR2ObjectKey = (songPath: string) => {
  const publicBaseUrl = process.env.R2PUBLICURL?.replace(/\/$/, "");
  if (!publicBaseUrl || !songPath.startsWith(`${publicBaseUrl}/`)) return null;
  return decodeURIComponent(songPath.slice(publicBaseUrl.length + 1));
};

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${admin.accessToken}` } } }
    );

    // Verify the song exists and that the provided path matches the stored record,
    // so a caller can never delete an arbitrary R2 object.
    const { data: song, error: fetchError } = await supabase
      .from("songs")
      .select("id, song_path")
      .eq("id", id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!song) {
      return NextResponse.json({ error: "Song not found." }, { status: 404 });
    }
    if (song.song_path !== songPath) {
      return NextResponse.json({ error: "Song path does not match the stored record." }, { status: 400 });
    }

    // Delete the R2 object first. If this fails, the DB row stays intact and the
    // operation can be retried without data loss.
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

    // Only remove the DB row after the storage object is gone.
    const { error: deleteError, count } = await supabase
      .from("songs")
      .delete({ count: "exact" })
      .eq("id", id);
    if (deleteError) throw deleteError;
    if (!count) {
      return NextResponse.json({ error: "Song not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unable to delete song:", error);
    return NextResponse.json({ error: "Unable to delete the song." }, { status: 500 });
  }
}