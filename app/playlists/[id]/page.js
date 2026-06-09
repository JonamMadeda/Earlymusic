"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ListMusic, Disc, Trash2, LogIn, Plus } from "lucide-react";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSongIds, setSelectedSongIds] = useState(new Set());
  const [showAddSongs, setShowAddSongs] = useState(false);
  const [adding, setAdding] = useState(false);

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

  const availableSongs = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allSongs.filter(
      (s) =>
        !songIds.includes(s.id) &&
        (s.title?.toLowerCase().includes(q) || s.author?.toLowerCase().includes(q))
    );
  }, [allSongs, songIds, searchQuery]);

  const toggleSelect = (id) => {
    setSelectedSongIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSelectedSongs = async () => {
    if (selectedSongIds.size === 0) return;
    setAdding(true);
    const newIds = Array.from(selectedSongIds).filter((id) => !songIds.includes(id));
    if (newIds.length === 0) { setAdding(false); return; }
    const inserts = newIds.map((songId) => ({
      playlist_id: params.id,
      song_id: songId,
    }));
    const { error } = await supabase.from("playlist_songs").insert(inserts);
    if (!error) {
      setSongIds((prev) => [...prev, ...newIds]);
      setSelectedSongIds(new Set());
      setSearchQuery("");
    }
    setAdding(false);
  };

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
          <p className="text-sm font-semibold text-neutral-900 mb-2">Sign in to view playlists</p>
          <Link href="/auth" className="inline-flex items-center gap-2 rounded-full bg-accent px-4.5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-accent/90">
            <LogIn size={14} /> Sign In
          </Link>
        </div>
      </main>
    );
  }

  if (!playlist) return null;

  return (
    <main className="min-h-[90vh] bg-transparent px-4 pb-40 pt-2 md:px-8 md:pt-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-400 hover:text-neutral-900 transition mb-4">
            <ArrowLeft size={14} />
            Back
          </button>
          <div className="flex items-center gap-3">
            <div className="h-6 w-1 rounded-full bg-accent" />
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 md:text-2xl uppercase">
              {playlist.name}
            </h1>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-400 max-w-xl">
            {songIds.length} {songIds.length === 1 ? "song" : "songs"}
          </p>
        </div>

        {/* Add Songs Section */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 pb-6">
            <button
              onClick={() => setShowAddSongs(!showAddSongs)}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-4.5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-accent/90"
            >
              <Plus size={13} />
              {showAddSongs ? "Cancel" : "Add Songs"}
            </button>
            <button onClick={deletePlaylist} className="inline-flex items-center gap-2 rounded-full border border-neutral-200/80 bg-white px-4 py-2.5 text-xs font-medium text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-900" title="Delete playlist">
              <Trash2 size={13} />
              Delete
            </button>
          </div>

          {showAddSongs && (
            <div className="mt-6 bg-neutral-50/60 rounded-2xl p-4">
              <input
                type="text"
                placeholder="Search songs by title or artist..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-full border border-neutral-200/80 bg-white px-3.5 py-2.5 text-xs font-medium outline-none transition placeholder:text-neutral-300 focus:border-neutral-300"
                autoFocus
              />

              {searchQuery.trim() && (
                <>
                  <div className="mt-3 max-h-[300px] overflow-y-auto custom-scrollbar flex flex-col gap-y-1">
                    {availableSongs.length === 0 ? (
                      <p className="text-xs text-neutral-400 italic py-4 text-center">No matching songs found.</p>
                    ) : (
                      availableSongs.map((s) => (
                        <label
                          key={s.id}
                          className="flex items-center gap-x-3 p-2.5 rounded-xl hover:bg-neutral-100/80 transition cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedSongIds.has(s.id)}
                            onChange={() => toggleSelect(s.id)}
                            className="accent-neutral-900 w-4 h-4"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-neutral-900 truncate">{s.title}</p>
                            <p className="text-[11px] text-neutral-500 truncate">{s.author}</p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>

                  {availableSongs.length > 0 && (
                    <button
                      onClick={addSelectedSongs}
                      disabled={selectedSongIds.size === 0 || adding}
                      className="mt-3 w-full rounded-full bg-accent py-2.5 text-xs font-semibold text-white transition hover:bg-accent/90 disabled:opacity-50"
                    >
                      {adding ? "Adding..." : `Add ${selectedSongIds.size} Selected Song${selectedSongIds.size !== 1 ? "s" : ""}`}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Disc className="mb-4 text-neutral-300" size={32} />
            <p className="text-sm font-semibold text-neutral-900">This playlist is empty</p>
            <p className="mt-1 max-w-sm text-xs text-neutral-450">Use "Add Songs" above to fill it up.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-y-2">
            {songs.map((song) => (
              <div key={song.id} className="group relative">
                <SongItem song={song} onClick={() => setActiveSong(song, songs)} />
                <button
                  onClick={(e) => removeSong(e, song.id)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition-all duration-300 opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-white"
                  title="Remove from playlist"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
