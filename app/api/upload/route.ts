import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/adminAuth";
import { r2Client } from "@/lib/r2";

const maxAudioSizeBytes = 100 * 1024 * 1024;

const requiredEnvironment = (name: "R2BUCKETNAME" | "R2PUBLICURL") => {
  const value = process.env[name];
  if (!value || value === "yourbucketname") {
    throw new Error(`${name} must be configured before uploading files.`);
  }
  return value;
};

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: "Administrator access is required to upload audio." }, { status: 403 });
    }

    const { filename, contentType, contentLength } = await request.json();
    if (typeof filename !== "string" || !filename.trim()) {
      return NextResponse.json({ error: "A filename is required." }, { status: 400 });
    }
    if (typeof contentType !== "string" || !contentType.startsWith("audio/")) {
      return NextResponse.json({ error: "Only audio files can be uploaded." }, { status: 400 });
    }
    if (!Number.isInteger(contentLength) || contentLength <= 0 || contentLength > maxAudioSizeBytes) {
      return NextResponse.json({ error: "Audio files must be between 1 byte and 100 MB." }, { status: 400 });
    }

    const extension = filename.toLowerCase().match(/\.[a-z0-9]{1,10}$/)?.[0] ?? "";
    const fileKey = `audio/${Date.now()}-${crypto.randomUUID()}${extension}`;
    const command = new PutObjectCommand({
      Bucket: requiredEnvironment("R2BUCKETNAME"),
      Key: fileKey,
      ContentType: contentType,
      ContentLength: contentLength,
    });
    const presignedUrl = await getSignedUrl(r2Client, command, { expiresIn: 60 });
    const publicBaseUrl = requiredEnvironment("R2PUBLICURL").replace(/\/$/, "");

    return NextResponse.json({
      presignedUrl,
      publicStorageUrl: `${publicBaseUrl}/${fileKey}`,
    });
  } catch (error) {
    console.error("Unable to create R2 upload URL:", error);
    return NextResponse.json({ error: "Unable to prepare the upload." }, { status: 500 });
  }
}
