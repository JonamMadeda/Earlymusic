import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/adminAuth";
import { getR2Client } from "@/lib/r2";

const maxAudioSizeBytes = 100 * 1024 * 1024;

const ALLOWED_AUDIO_MIME = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/ogg",
  "audio/opus",
  "audio/flac",
  "audio/webm",
  "audio/x-ms-wma",
]);

const ALLOWED_EXTENSIONS = /\.(mp3|m4a|aac|wav|ogg|opus|flac|webm|wma)$/i;

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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const { filename, contentType, contentLength } = (body ?? {}) as {
      filename?: unknown;
      contentType?: unknown;
      contentLength?: unknown;
    };

    if (typeof filename !== "string" || !filename.trim()) {
      return NextResponse.json({ error: "A filename is required." }, { status: 400 });
    }
    if (typeof contentType !== "string" || !ALLOWED_AUDIO_MIME.has(contentType.toLowerCase())) {
      return NextResponse.json({ error: "Only audio files can be uploaded." }, { status: 400 });
    }
    if (!ALLOWED_EXTENSIONS.test(filename)) {
      return NextResponse.json({ error: "Unsupported audio file extension." }, { status: 400 });
    }
    if (
      typeof contentLength !== "number" ||
      !Number.isInteger(contentLength) ||
      contentLength <= 0 ||
      contentLength > maxAudioSizeBytes
    ) {
      return NextResponse.json({ error: "Audio files must be between 1 byte and 100 MB." }, { status: 400 });
    }

    const extension = filename.toLowerCase().match(ALLOWED_EXTENSIONS)?.[0] ?? ".mp3";
    const fileKey = `audio/${Date.now()}-${crypto.randomUUID()}${extension}`;
    const command = new PutObjectCommand({
      Bucket: requiredEnvironment("R2BUCKETNAME"),
      Key: fileKey,
      ContentType: contentType,
      ContentLength: contentLength,
    });
    const presignedUrl = await getSignedUrl(getR2Client(), command, { expiresIn: 60 });
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
