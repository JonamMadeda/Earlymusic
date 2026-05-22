"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import SongItem from "../components/SongItem";
import Loader from "../components/Loader";
import { usePlayer } from "../context/PlayerContext";
import { useAuth } from "../context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { Library as LibraryIcon, HeartOff, LogIn } from "lucide-react";
import Link from "next/link";

export default function LibraryPage() {
  const { user, loading: authLoading } = useAuth();
  const { allSongs, setAllSongs, setActiveSong } = usePlayer();
  const [savedSongIds, setSavedSongIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Fetch saved songs from DB
  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }

    supabase
      .from("saved_songs")
      .select("song_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setSavedSongIds((data || []).map((s) => s.song_id));
      })
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  // Ensure allSongs is loaded
  useEffect(() => {
    if (allSongs.length > 0 || authLoading || !user) return;

    const cached = localStorage.getItem("earlymusic_songs_cache");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.length > 0) { setAllSongs(parsed); return; }
      } catch {}
    }

    supabase
      .from("songs")
      .select("*")
      .order("title", { ascending: true })
      .then(({ data }) => {
        if (data) {
          setAllSongs(data);
          localStorage.setItem("earlymusic_songs_cache", JSON.stringify(data));
        }
      });
  }, [allSongs.length, setAllSongs, authLoading, user]);

  const librarySongs = useMemo(() => {
    if (savedSongIds.length === 0 || allSongs.length === 0) return [];
    return savedSongIds
      .map((sid) => allSongs.find((s) => s.id === sid))
      .filter(Boolean);
  }, [savedSongIds, allSongs]);

  const groupedSongs = useMemo(() => {
    const sorted = [...librarySongs].sort((a, b) =>
      a.title.localeCompare(b.title)
    );
    return sorted.reduce((groups, song) => {
      const letter = song.title[0]?.toUpperCase() || "#";
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(song);
      return groups;
    }, {});
  }, [librarySongs]);

  const alphabet = Object.keys(groupedSongs).sort();

  if (authLoading || loading) {
    return (
      <main className="min-h-[90vh] bg-white px-6 py-8 pb-40 relative">
        <div className="max-w-5xl mx-auto"><Loader /></div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-[90vh] bg-white px-6 py-8 pb-40 relative">
        <div className="max-w-5xl mx-auto flex flex-col items-center justify-center py-32 text-center">
          <HeartOff className="text-neutral-200 mb-4" size={32} />
          <p className="text-[15px] font-medium text-neutral-900 mb-2">Sign in to see your library</p>
          <Link href="/auth" className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-neutral-900 transition-all flex items-center gap-2 shadow-lg shadow-red-100">
            <LogIn size={16} /> Sign In
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[90vh] bg-white px-6 py-8 pb-40 relative">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-x-3 mb-12 px-2">
          <LibraryIcon className="text-red-600" size={24} />
          <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">
            Library
          </h1>
        </div>

        {librarySongs.length > 0 ? (
          <div className="flex flex-col gap-y-6">
            {alphabet.map((letter) => (
              <div key={letter} className="flex flex-col gap-y-2">
                <div className="flex items-center gap-x-4 border-b border-neutral-50 pb-2 px-2">
                  <h2 className="text-3xl font-semibold text-neutral-900 tracking-tight">
                    {letter}
                  </h2>
                </div>
                <div className="flex flex-col gap-y-1">
                  {groupedSongs[letter].map((song) => (
                    <SongItem
                      key={song.id}
                      song={song}
                      onClick={() => setActiveSong(song, librarySongs)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <HeartOff className="text-neutral-200 mb-4" size={32} />
            <p className="text-[15px] font-medium text-neutral-900">
              Your library is empty
            </p>
            <p className="text-[13px] text-neutral-400 mt-1">
              Songs you heart will appear here.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
