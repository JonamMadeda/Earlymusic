import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth";
import { logAdminAction } from "@/lib/adminAudit";
import { checkRateLimit } from "@/lib/rateLimit";
import { getR2Client } from "@/lib/r2";
import { db } from "@/lib/neon";

export async function DELETE(request: NextRequest) {
  const limited = checkRateLimit(request, { name: "storage-delete", limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    }

    let publicStorageUrl: unknown;
    try {
      ({ publicStorageUrl } = await request.json());
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    if (typeof publicStorageUrl !== "string" || !publicStorageUrl) {
      return NextResponse.json({ error: "An audio URL is required." }, { status: 400 });
    }

    const publicBaseUrl = process.env.R2PUBLICURL?.replace(/\/$/, "");
    if (!publicBaseUrl || !publicStorageUrl.startsWith(`${publicBaseUrl}/audio/`)) {
      return NextResponse.json({ error: "Invalid audio URL." }, { status: 400 });
    }

    const candidates = [
      publicStorageUrl,
      decodeURIComponent(publicStorageUrl),
      encodeURI(decodeURIComponent(publicStorageUrl)),
    ];
    const { rows: referencing } = await db.query(
      "SELECT id FROM public.songs WHERE song_path = ANY($1) LIMIT 1",
      [candidates]
    );
    if (referencing?.length > 0) {
      return NextResponse.json(
        { error: "This file is linked to a track. Delete the track instead." },
        { status: 409 }
      );
    }

    await getR2Client().send(new DeleteObjectCommand({
      Bucket: process.env.R2BUCKETNAME,
      Key: decodeURIComponent(publicStorageUrl.slice(publicBaseUrl.length + 1)),
    }));

    await logAdminAction({
      actorId: admin.user.id,
      action: "storage.orphan_delete",
      target: publicStorageUrl,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unable to clean up R2 object:", error);
    return NextResponse.json({ error: "Unable to clean up the upload." }, { status: 500 });
  }
}
