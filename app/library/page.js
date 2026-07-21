"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import SongItem from "../components/SongItem";
import SongAvatar from "@/app/components/SongAvatar";
import { PageSkeleton } from "../components/Skeleton";
import { usePlayer } from "../context/PlayerContext";
import { useAuth } from "../context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import {
  Disc, LogIn, Heart, ListMusic, Download, Play, Trash2, Plus, HardDrive,
} from "lucide-react";
import Link from "next/link";
import {
  getDownloadedSongs,
  removeDownload,
  getStorageEstimate,
} from "@/lib/downloadManager";

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

const tabs = [
  { key: "saved", label: "Saved", icon: Heart },
  { key: "playlists", label: "Playlists", icon: ListMusic },
  { key: "downloads", label: "Downloads", icon: Download },
];

export default function LibraryPage() {
  const { user, loading: authLoading } = useAuth();
  const { allSongs, setAllSongs, setActiveSong } = usePlayer();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("saved");
  const [loading, setLoading] = useState(true);

  // Saved songs
  const [savedSongIds, setSavedSongIds] = useState([]);

  // Playlists
  const [playlists, setPlaylists] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  // Downloads
  const [downloadedSongs, setDownloadedSongs] = useState([]);
  const [storage, setStorage] = useState(null);

  const refreshDownloads = useCallback(() => {
    setDownloadedSongs(getDownloadedSongs());
    getStorageEstimate().then(setStorage);
  }, []);

  useEffect(() => {
    refreshDownloads();
  }, [refreshDownloads]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }

    Promise.all([
      supabase.from("saved_songs").select("song_id").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("playlists").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]).then(([savedRes, plRes]) => {
      setSavedSongIds((savedRes.data || []).map((s) => s.song_id));
      setPlaylists(plRes.data || []);
    }).finally(() => setLoading(false));
  }, [user, authLoading]);

  useEffect(() => {
    if (allSongs.length > 0 || authLoading || !user) return;
    const cached = localStorage.getItem("earlymusic_songs_cache");
    if (cached) {
      try { const parsed = JSON.parse(cached); if (parsed.length > 0) { setAllSongs(parsed); return; } } catch {}
    }
    supabase.from("songs").select("*").order("title", { ascending: true }).then(({ data }) => {
      if (data) { setAllSongs(data); localStorage.setItem("earlymusic_songs_cache", JSON.stringify(data)); }
    });
  }, [allSongs.length, setAllSongs, authLoading, user]);

  const savedSongs = useMemo(() => {
    if (savedSongIds.length === 0 || allSongs.length === 0) return [];
    return savedSongIds.map((sid) => allSongs.find((s) => s.id === sid)).filter(Boolean);
  }, [savedSongIds, allSongs]);

  const groupedSaved = useMemo(() => {
    const sorted = [...savedSongs].sort((a, b) => a.title.localeCompare(b.title));
    return sorted.reduce((groups, song) => {
      const letter = song.title[0]?.toUpperCase() || "#";
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(song);
      return groups;
    }, {});
  }, [savedSongs]);

  const createPlaylist = async () => {
    const name = newName.trim();
    if (!name) return;
    const { data } = await supabase.from("playlists").insert({ name, user_id: user.id }).select().single();
    if (data) {
      setPlaylists([data, ...playlists]);
      setNewName("");
      setShowCreate(false);
    }
  };

  const deletePlaylist = async (e, id) => {
    e.stopPropagation();
    if (!confirm("Delete this playlist?")) return;
    await supabase.from("playlists").delete().eq("id", id);
    setPlaylists(playlists.filter((p) => p.id !== id));
  };

  const handleRemoveDownload = async (e, songId) => {
    e.stopPropagation();
    await removeDownload(songId);
    refreshDownloads();
  };

  if (authLoading || loading) {
    return (
      <main className="min-h-[90vh] bg-transparent px-4 pb-40 pt-2 md:px-8 md:pt-6">
        <div className="max-w-5xl mx-auto"><PageSkeleton /></div>
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
        <section className="mb-6 md:mb-8">
          <div className="flex items-center gap-3">
            <div className="h-6 w-1 rounded-full bg-accent" />
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 md:text-2xl uppercase">
              Library
            </h1>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-400 max-w-xl">
            Your saved songs, playlists, and offline downloads.
          </p>
          <div className="mt-3 md:mt-4 flex items-center gap-2 text-xs text-neutral-400">
            <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-medium">{savedSongs.length} saved</span>
            <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-medium">{playlists.length} playlist{playlists.length !== 1 ? "s" : ""}</span>
            <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-medium">{downloadedSongs.length} downloaded</span>
          </div>
        </section>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-2xl bg-neutral-50/60 p-1 backdrop-blur-2xl">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition ${
                  isActive ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-900"
                }`}
              >
                <tab.icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Saved Songs */}
        {activeTab === "saved" && (
          <div>
            {savedSongs.length > 0 ? (
              <div className="flex flex-col gap-y-6">
                {Object.keys(groupedSaved).sort().map((letter) => (
                    <div key={letter} className="flex flex-col gap-y-3">
                      <div className="flex items-center gap-3 border-b border-neutral-100 pb-2 px-1">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-accent/10 text-[10px] font-bold text-accent">{letter}</span>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">{letter}</h2>
                      </div>
                    <div className="flex flex-col gap-y-2">
                      {groupedSaved[letter].map((song) => (
                        <SongItem key={song.id} song={song} onClick={() => setActiveSong(song, savedSongs)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Heart className="mb-4 text-neutral-300" size={32} />
                <p className="text-sm font-semibold text-neutral-900">Your library is empty</p>
                <p className="mt-1 max-w-sm text-xs text-neutral-450">Songs you heart will appear here.</p>
              </div>
            )}
          </div>
        )}

        {/* Playlists */}
        {activeTab === "playlists" && (
          <div>
            <div className="mb-6">
              <button
                onClick={() => setShowCreate(!showCreate)}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-4.5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-accent/90"
              >
                <Plus size={13} />
                New Playlist
              </button>
            </div>

            {showCreate && (
              <div className="mb-6 -mt-2 flex items-center gap-3 bg-neutral-50/60 rounded-2xl p-3.5 backdrop-blur-2xl">
                <input
                  type="text"
                  placeholder="Playlist name..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createPlaylist()}
                  className="flex-1 rounded-full border border-neutral-200/80 bg-white px-3.5 py-2.5 text-xs font-medium outline-none transition placeholder:text-neutral-300 focus:border-neutral-300"
                  autoFocus
                />
                <button
                  onClick={createPlaylist}
                  disabled={!newName.trim()}
                  className="rounded-full bg-accent px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-accent/90 disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            )}

            {playlists.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <ListMusic className="mb-4 text-neutral-300" size={32} />
                <p className="text-sm font-semibold text-neutral-900">No playlists yet</p>
                <p className="mt-1 max-w-sm text-xs text-neutral-450">Create your first playlist to organize your songs.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {playlists.map((pl) => (
                  <div
                    key={pl.id}
                    onClick={() => router.push(`/playlists/${pl.id}`)}
                    className="group flex cursor-pointer flex-col gap-3 rounded-2xl bg-neutral-50/60 p-5 text-left transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 backdrop-blur-2xl"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-neutral-900/5 text-neutral-800">
                        <ListMusic size={22} />
                      </div>
                      <button
                        onClick={(e) => deletePlaylist(e, pl.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition-all duration-300 md:opacity-0 md:group-hover:opacity-100 hover:bg-accent hover:text-white"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div>
                      <h3 className="truncate text-sm font-semibold tracking-tight text-neutral-900">{pl.name}</h3>
                      <p className="mt-0.5 text-[11px] font-medium text-neutral-400">Playlist</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Downloads */}
        {activeTab === "downloads" && (
          <div>
            {storage && (
              <div className="mb-6 rounded-2xl bg-neutral-50/60 p-4 backdrop-blur-2xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-neutral-500">
                    <HardDrive size={13} />
                    <span>Device storage</span>
                  </div>
                  <span className={`text-[11px] font-semibold ${(storage.usage / storage.quota) >= 0.95 ? "text-red-500" : "text-neutral-500"}`}>
                    {formatBytes(storage.usage)} / {formatBytes(storage.quota)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-neutral-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${(storage.usage / storage.quota) >= 0.95 ? "bg-red-500" : "bg-accent"}`}
                    style={{ width: `${Math.min((storage.usage / storage.quota) * 100, 100)}%` }}
                  />
                </div>
                <p className={`mt-1.5 text-[11px] font-medium ${(storage.usage / storage.quota) >= 0.95 ? "text-red-500" : "text-neutral-400"}`}>
                  {(storage.usage / storage.quota) >= 0.95
                    ? "Storage is full — remove some downloads to free up space"
                    : `${formatBytes(storage.available)} available`}
                </p>
              </div>
            )}

            {downloadedSongs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Download className="mb-4 text-neutral-300" size={32} />
                <p className="text-sm font-semibold text-neutral-900">No downloads yet</p>
                <p className="mt-1 max-w-sm text-xs text-neutral-450">Download songs from the Songs page to listen offline.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-y-2 md:gap-y-3">
                {downloadedSongs.map((song) => (
                  <div
                    key={song.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveSong(song, downloadedSongs)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setActiveSong(song, downloadedSongs); }}
                    className="group flex w-full items-center gap-3 md:gap-3.5 rounded-2xl bg-neutral-50/60 p-3 text-left transition-all duration-300 hover:bg-neutral-100/80 hover:shadow-sm backdrop-blur-2xl"
                  >
                    <SongAvatar title={song.title} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold tracking-tight text-neutral-900">{song.title}</p>
                      <p className="truncate text-[11px] font-medium text-neutral-400 mt-0.5">{song.author}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition-all group-hover:bg-accent group-hover:text-white">
                        <Play size={13} fill="currentColor" className="ml-0.5" />
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleRemoveDownload(e, song.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 transition hover:bg-red-50 hover:text-red-500"
                        title="Remove download"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
