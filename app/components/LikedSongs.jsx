"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Music, Heart } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/app/context/AuthContext";

const LikedSongs = () => {
  const { user } = useAuth();
  const [songs, setSongs] = useState([]);

  useEffect(() => {
    if (!user) { setSongs([]); return; }

    supabase
      .from("saved_songs")
      .select("song_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(async ({ data }) => {
        if (!data || data.length === 0) { setSongs([]); return; }
        const ids = data.map((s) => s.song_id);

        const { data: allSongs } = await supabase
          .from("songs")
          .select("*")
          .in("id", ids);

        // Preserve the order from saved_songs
        const ordered = ids
          .map((id) => allSongs?.find((s) => s.id === id))
          .filter(Boolean);
        setSongs(ordered);
      });
  }, [user]);

  if (!user || songs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[22px] border border-dashed border-neutral-200 bg-white/60 py-6 px-4">
        <Heart size={16} className="mb-2 text-neutral-200" />
        <p className="text-center text-[12px] font-medium leading-snug text-neutral-400">
          Liked songs will <br /> appear here
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-y-2">
      {songs.map((song) => (
        <Link
          key={song.id}
          href="/library"
          className="group flex cursor-pointer items-center gap-x-3 rounded-2xl border border-transparent p-2 transition hover:border-neutral-100 hover:bg-neutral-50"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-transparent bg-neutral-50 transition-all group-hover:border-neutral-100 group-hover:bg-white group-hover:shadow-sm">
            <Music
              size={14}
              className="text-neutral-400 group-hover:text-accent transition"
            />
          </div>

          <div className="overflow-hidden">
            <p className="truncate text-[13px] font-semibold text-neutral-600 transition-colors group-hover:text-neutral-900">
              {song.title}
            </p>
            <p className="truncate text-[11px] font-medium text-neutral-400">
              {song.author}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default LikedSongs;
