import Link from "next/link";
import { db } from "@/lib/neon";
import ShareClient from "./ShareClient";

async function getSharedSong(id) {
  if (!id || typeof id !== "string") return null;
  try {
    const { rows } = await db.query(
      "SELECT id, title, author, song_path, category, duration, original_songs, created_at FROM public.songs WHERE id = $1 LIMIT 1",
      [id]
    );
    return rows?.[0] || null;
  } catch (error) {
    console.error("Share page song lookup failed:", error);
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const song = await getSharedSong(id);
  if (!song) {
    return {
      title: "Shared song | Luumbo",
      description: "This shared song could not be found on Luumbo.",
    };
  }
  const title = `${song.title || "Untitled"}${song.author ? ` by ${song.author}` : ""} | Luumbo`;
  const description = `Listen to "${song.title || "this song"}"${song.author ? ` by ${song.author}` : ""} on Luumbo.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "music.song",
      url: `/share/${song.id}`,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function SharePage({ params }) {
  const { id } = await params;
  const song = await getSharedSong(id);

  if (!song) {
    return (
      <main className="min-h-[90vh] bg-white px-3 sm:px-6 md:px-8 pb-12 pt-10">
        <div className="mx-auto max-w-md rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-2xs">
          <p className="text-base font-bold tracking-tight text-neutral-900">
            Song not found
          </p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">
            This shared link is invalid or the song was removed. Browse the
            library to find something else to play.
          </p>
          <Link
            href="/songs"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition hover:bg-accent/90"
          >
            Browse all songs
          </Link>
        </div>
      </main>
    );
  }

  return <ShareClient song={song} />;
}
