import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/adminAuth";
import { r2Client } from "@/lib/r2";

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
    const { songPath } = await request.json();
    if (!/^\d+$/.test(id) || typeof songPath !== "string") {
      return NextResponse.json({ error: "Invalid song deletion request." }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${admin.accessToken}` } } }
    );
    const { error } = await supabase.from("songs").delete().eq("id", id);
    if (error) throw error;

    const objectKey = getR2ObjectKey(songPath);
    if (objectKey) {
      await r2Client.send(new DeleteObjectCommand({
        Bucket: process.env.R2BUCKETNAME,
        Key: objectKey,
      }));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unable to delete song:", error);
    return NextResponse.json({ error: "Unable to delete the song." }, { status: 500 });
  }
}
