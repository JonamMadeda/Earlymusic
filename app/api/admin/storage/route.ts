import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/adminAuth";
import { getR2Client } from "@/lib/r2";

/**
 * Deletes an orphaned R2 object that was uploaded but never linked to a
 * database record (e.g. after a failed database insert).
 */
export async function DELETE(request: NextRequest) {
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

    await getR2Client().send(new DeleteObjectCommand({
      Bucket: process.env.R2BUCKETNAME,
      Key: decodeURIComponent(publicStorageUrl.slice(publicBaseUrl.length + 1)),
    }));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unable to clean up R2 object:", error);
    return NextResponse.json({ error: "Unable to clean up the upload." }, { status: 500 });
  }
}