import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/adminAuth";
import { getR2Client } from "@/lib/r2";

/**
 * Storage overview for the admin Vault: R2 usage plus orphaned audio files
 * (uploaded objects no track references), which can be removed with the
 * existing DELETE /api/admin/storage endpoint.
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    }

    const bucket = process.env.R2BUCKETNAME;
    const publicBaseUrl = process.env.R2PUBLICURL?.replace(/\/$/, "");
    if (!bucket || !publicBaseUrl) {
      return NextResponse.json({ error: "R2 storage is not configured." }, { status: 500 });
    }

    const objects: { key: string; size: number }[] = [];
    let continuationToken: string | undefined;
    do {
      const res = await getR2Client().send(new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: "audio/",
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      }));
      for (const o of res.Contents || []) {
        if (o.Key) objects.push({ key: o.Key, size: o.Size || 0 });
      }
      continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (continuationToken);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: songs, error: songsError } = await supabase
      .from("songs")
      .select("song_path");
    if (songsError) throw songsError;

    const referenced = new Set<string>();
    let legacyCount = 0;
    for (const s of songs || []) {
      const p = (s as { song_path?: string }).song_path;
      if (!p) continue;
      if (p.startsWith(`${publicBaseUrl}/`)) {
        referenced.add(decodeURIComponent(p.slice(publicBaseUrl.length + 1)));
      } else {
        legacyCount += 1;
      }
    }

    const orphans = objects
      .filter((o) => !referenced.has(o.key))
      .map((o) => `${publicBaseUrl}/${o.key}`);

    return NextResponse.json({
      fileCount: objects.length,
      totalBytes: objects.reduce((sum, o) => sum + o.size, 0),
      trackCount: (songs || []).length,
      legacyCount,
      orphanCount: orphans.length,
      orphans: orphans.slice(0, 200),
    });
  } catch (error) {
    console.error("Unable to read storage stats:", error);
    return NextResponse.json({ error: "Unable to read storage stats." }, { status: 500 });
  }
}
