import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { db } from "@/lib/neon";

export async function GET(request: NextRequest) {
  const limited = checkRateLimit(request, { name: "admin-songs", limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    }

    const { rows } = await db.query("SELECT * FROM public.songs ORDER BY id");
    return NextResponse.json({ songs: rows || [] });
  } catch (error) {
    console.error("Unable to read songs:", error);
    return NextResponse.json({ error: "Unable to read songs." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const limited = checkRateLimit(request, { name: "admin-songs-create", limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    }

    const { title, author, song_path, category, original_songs, duration } = await request.json();
    if (!title || !song_path) {
      return NextResponse.json({ error: "Title and song_path are required." }, { status: 400 });
    }

    const { rows } = await db.query(
      `INSERT INTO public.songs (title, author, song_path, category, original_songs, duration)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [title, author || null, song_path, category || null, original_songs ? JSON.stringify(original_songs) : null, duration || null]
    );

    return NextResponse.json({ song: rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Unable to create song:", error);
    return NextResponse.json({ error: "Unable to create song." }, { status: 500 });
  }
}
