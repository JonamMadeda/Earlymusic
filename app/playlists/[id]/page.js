"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ListMusic, Music, Trash2, LogIn } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/app/context/AuthContext";
import { usePlayer } from "@/app/context/PlayerContext";
import SongItem from "@/app/components/SongItem";
import Loader from "@/app/components/Loader";
import Link from "next/link";

export default function PlaylistDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { allSongs, setAllSongs, setActiveSong } = usePlayer();
  const [playlist, setPlaylist] = useState(null);
  const [songIds, setSongIds] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch playlist + its songs from DB
  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }

    Promise.all([
      supabase.from("playlists").select("*").eq("id", params.id).single(),
      supabase.from("playlist_songs").select("song_id").eq("playlist_id", params.id),
    ]).then(([plRes, songsRes]) => {
      if (!plRes.data) { router.replace("/playlists"); return; }
      setPlaylist(plRes.data);
      setSongIds((songsRes.data || []).map((s) => s.song_id));
    }).finally(() => setLoading(false));
  }, [params.id, router, user, authLoading]);

  // Sync allSongs from PlayerContext or fetch from cache/DB
  useEffect(() => {
    if (allSongs.length > 0 || !user) return;

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
  }, [allSongs.length, setAllSongs, user]);

  const songs = useMemo(() => {
    if (songIds.length === 0 || allSongs.length === 0) return [];
    return songIds
      .map((sid) => allSongs.find((s) => s.id === sid))
      .filter(Boolean);
  }, [songIds, allSongs]);

  const removeSong = async (e, songId) => {
    e.stopPropagation();
    await supabase
      .from("playlist_songs")
      .delete()
      .eq("playlist_id", params.id)
      .eq("song_id", songId);
    setSongIds(songIds.filter((sid) => sid !== songId));
  };

  const deletePlaylist = async () => {
    if (!confirm("Delete this playlist?")) return;
    await supabase.from("playlists").delete().eq("id", params.id);
    router.replace("/playlists");
  };

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
          <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mb-4">
            <Music className="text-neutral-200" size={32} />
          </div>
          <p className="text-[15px] font-medium text-neutral-900 mb-2">Sign in to view playlists</p>
          <Link href="/auth" className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-neutral-900 transition-all flex items-center gap-2 shadow-lg shadow-red-100">
            <LogIn size={16} /> Sign In
          </Link>
        </div>
      </main>
    );
  }

  if (!playlist) return null;

  return (
    <main className="min-h-[90vh] bg-white px-6 py-8 pb-40 relative">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-x-4 mb-8 px-2">
          <button onClick={() => router.back()} className="p-2 text-neutral-400 hover:text-red-600 transition">
            <ArrowLeft size={22} />
          </button>
          <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
            <ListMusic className="text-red-600" size={22} />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">{playlist.name}</h1>
            <p className="text-[13px] text-neutral-500 font-medium">
              {songIds.length} {songIds.length === 1 ? "song" : "songs"}
            </p>
          </div>
          <button onClick={deletePlaylist} className="text-neutral-300 hover:text-red-600 transition p-2" title="Delete playlist">
            <Trash2 size={18} />
          </button>
        </div>

        {songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mb-4">
              <Music className="text-neutral-200" size={32} />
            </div>
            <p className="text-[15px] font-medium text-neutral-900">This playlist is empty</p>
            <p className="text-[13px] text-neutral-400 mt-1">Add songs from the Home or Search page.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-y-1">
            {songs.map((song) => (
              <div key={song.id} className="group relative">
                <SongItem song={song} onClick={() => setActiveSong(song, songs)} />
                <button
                  onClick={(e) => removeSong(e, song.id)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-neutral-300 hover:text-red-600 transition opacity-0 group-hover:opacity-100"
                  title="Remove from playlist"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
