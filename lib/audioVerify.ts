import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client } from "@/lib/r2";

export const MAX_AUDIO_BYTES = 100 * 1024 * 1024;

export const ALLOWED_AUDIO_MIME = new Set([
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

export const getR2ObjectKey = (songPath: string): string | null => {
  const publicBaseUrl = process.env.R2PUBLICURL?.replace(/\/$/, "");
  if (!publicBaseUrl || !songPath.startsWith(`${publicBaseUrl}/`)) return null;
  return decodeURIComponent(songPath.slice(publicBaseUrl.length + 1));
};

/**
 * Server-side check of what actually landed in R2. The presign step only
 * sees client-declared metadata, so the song record endpoints call this to
 * enforce the real size/type before a track can reference the file.
 */
export const verifyStoredAudio = async (
  songPath: string
): Promise<{ ok: boolean; error?: string }> => {
  const key = getR2ObjectKey(songPath);
  if (!key) {
    return { ok: false, error: "Audio file must be uploaded through this app before creating the track." };
  }

  let head;
  try {
    head = await getR2Client().send(
      new HeadObjectCommand({ Bucket: process.env.R2BUCKETNAME, Key: key })
    );
  } catch {
    return { ok: false, error: "Audio file not found in storage. Please re-upload it." };
  }

  const size = head.ContentLength ?? 0;
  if (!size || size > MAX_AUDIO_BYTES) {
    return { ok: false, error: "Audio files must be between 1 byte and 100 MB." };
  }
  if (!head.ContentType || !ALLOWED_AUDIO_MIME.has(head.ContentType.toLowerCase())) {
    return { ok: false, error: "Stored file is not a supported audio type." };
  }
  return { ok: true };
};
