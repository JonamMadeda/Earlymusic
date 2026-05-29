"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ListMusic, Music, Trash2, LogIn, Plus } from "lucide-react";
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

        {/* Add Songs Section */}
        <div className="mb-6 px-2">
          <button
            onClick={() => setShowAddSongs(!showAddSongs)}
            className="flex items-center gap-x-2 text-[13px] font-semibold text-red-600 hover:text-neutral-900 transition"
          >
            <Plus size={16} />
            {showAddSongs ? "Cancel" : "Add Songs"}
          </button>

          {showAddSongs && (
            <div className="mt-4 bg-neutral-50 rounded-2xl p-4 border border-neutral-100">
              <input
                type="text"
                placeholder="Search songs by title or artist..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-3 bg-white border border-neutral-200 rounded-xl outline-none focus:border-red-600 text-[14px] transition"
                autoFocus
              />

              {searchQuery.trim() && (
                <>
                  <div className="mt-3 max-h-[300px] overflow-y-auto custom-scrollbar flex flex-col gap-y-1">
                    {availableSongs.length === 0 ? (
                      <p className="text-[13px] text-neutral-400 italic py-4 text-center">No matching songs found.</p>
                    ) : (
                      availableSongs.map((s) => (
                        <label
                          key={s.id}
                          className="flex items-center gap-x-3 p-2.5 rounded-xl hover:bg-white transition cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedSongIds.has(s.id)}
                            onChange={() => toggleSelect(s.id)}
                            className="accent-red-600 w-4 h-4"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-semibold text-neutral-900 truncate">{s.title}</p>
                            <p className="text-[12px] text-neutral-500 truncate">{s.author}</p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>

                  {availableSongs.length > 0 && (
                    <button
                      onClick={addSelectedSongs}
                      disabled={selectedSongIds.size === 0 || adding}
                      className="mt-3 w-full bg-red-600 text-white py-2.5 rounded-xl font-bold text-[13px] hover:bg-neutral-900 transition disabled:opacity-50"
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
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mb-4">
              <Music className="text-neutral-200" size={32} />
            </div>
            <p className="text-[15px] font-medium text-neutral-900">This playlist is empty</p>
            <p className="text-[13px] text-neutral-400 mt-1">Use "Add Songs" above to fill it up.</p>
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
