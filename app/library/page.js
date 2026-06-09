"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import SongItem from "../components/SongItem";
import Loader from "../components/Loader";
import { usePlayer } from "../context/PlayerContext";
import { useAuth } from "../context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { Disc, LogIn } from "lucide-react";
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
      <main className="min-h-[90vh] bg-transparent px-4 pb-40 pt-2 md:px-8 md:pt-6">
        <div className="max-w-5xl mx-auto"><Loader /></div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-[90vh] bg-transparent px-4 pb-40 pt-2 md:px-8 md:pt-6">
        <div className="max-w-5xl mx-auto flex flex-col items-center justify-center py-32 text-center">
          <Disc className="mb-4 text-neutral-300" size={32} />
          <p className="text-sm font-semibold text-neutral-900 mb-2">Sign in to see your library</p>
          <Link href="/auth" className="inline-flex items-center gap-2 rounded-full bg-accent px-4.5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-accent/90">
            <LogIn size={14} /> Sign In
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[90vh] bg-transparent px-4 pb-40 pt-2 md:px-8 md:pt-6">
      <div className="max-w-5xl mx-auto">
        <section className="mb-8">
          <div className="flex items-center gap-3">
            <div className="h-6 w-1 rounded-full bg-accent" />
            <h1 className="text-xl font-bold tracking-[0.15em] text-neutral-900 md:text-2xl uppercase">
              Library
            </h1>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-450 max-w-xl">
            Everything you&apos;ve liked, organized and ready to play.
          </p>
          <div className="mt-4 flex items-center gap-3.5 text-xs text-neutral-400">
            <span>{librarySongs.length} saved song{librarySongs.length !== 1 ? "s" : ""}</span>
          </div>
        </section>

        {librarySongs.length > 0 ? (
          <div className="flex flex-col gap-y-6">
            {alphabet.map((letter) => (
              <div key={letter} className="flex flex-col gap-y-3">
                <div className="flex items-center gap-x-4 border-b border-neutral-100 pb-2 px-2">
                  <h2 className="text-3xl font-semibold tracking-tight text-neutral-900">
                    {letter}
                  </h2>
                </div>
                <div className="flex flex-col gap-y-2">
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
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Disc className="mb-4 text-neutral-300" size={32} />
            <p className="text-sm font-semibold text-neutral-900">
              Your library is empty
            </p>
            <p className="mt-1 max-w-sm text-xs text-neutral-450">
              Songs you heart will appear here.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
