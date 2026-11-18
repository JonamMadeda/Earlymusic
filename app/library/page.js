"use client";

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import SongItem from "../components/SongItem";
import SongAvatar from "@/app/components/SongAvatar";
import { PageSkeleton } from "../components/Skeleton";
import { usePlayer } from "../context/PlayerContext";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "@/lib/apiFetch";
import { getNewSongIds } from "@/lib/newSongs";
import { useOnlineStatus } from "@/lib/useOnlineStatus";
import {
  Disc, LogIn, Heart, ListMusic, Download, Play, Trash2, Plus, Trophy, Loader2,
} from "lucide-react";
import Link from "next/link";
import UndoToast from "../components/UndoToast";
import {
  getDownloadedSongs,
  removeDownload,
  getStorageEstimate,
  onDownloadsChanged,
  getActiveDownloads,
  onDownloadsProgress,
  stageClearDownloads,
  commitClearDownloads,
  undoClearDownloads,
} from "@/lib/downloadManager";

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

const tabs = [
  { key: "downloads", label: "Downloads", icon: Download },
  { key: "playlists", label: "Playlists", icon: ListMusic },
  { key: "saved", label: "Liked", icon: Heart },
  { key: "top", label: "Top", icon: Trophy },
];

const tabKeys = tabs.map((t) => t.key);

function LibraryContent() {
  const { user, loading: authLoading } = useAuth();
  const { allSongs, setAllSongs, setActiveSong } = usePlayer();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isOnline = useOnlineStatus();
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get("tab");
    return tabKeys.includes(tab) ? tab : "downloads";
  });
  const [loading, setLoading] = useState(true);

  // Same History-API approach as the songs page: the address bar mirrors the
  // selected tab without a soft navigation re-suspending the page.
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (activeTab === "downloads") params.delete("tab");
    else params.set("tab", activeTab);
    const query = params.toString();
    const url = `${pathname}${query ? `?${query}` : ""}`;
    if (url === `${window.location.pathname}${window.location.search}`) return;
    window.history.replaceState(window.history.state, "", url);
  }, [activeTab, pathname, searchParams]);

  // Saved songs
  const [savedSongIds, setSavedSongIds] = useState([]);

  // Most listened (this user's play counts from recently_played)
  const [topPlays, setTopPlays] = useState([]);

  // Playlists
  const [playlists, setPlaylists] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  // Downloads
  const [downloadedSongs, setDownloadedSongs] = useState([]);
  const [downloading, setDownloading] = useState([]);
  const [storage, setStorage] = useState(null);
  const [undoSnapshot, setUndoSnapshot] = useState(null);
  const undoRef = useRef(null);

  const refreshDownloads = useCallback(() => {
    // Newest first: the list is how listeners judge what they just saved.
    setDownloadedSongs(
      getDownloadedSongs().sort(
        (a, b) => new Date(b.downloadedAt || 0) - new Date(a.downloadedAt || 0)
      )
    );
    setDownloading(getActiveDownloads());
    getStorageEstimate()
      .then(setStorage)
      .catch((error) => console.error("Unable to read storage estimate:", error));
  }, []);

  useEffect(() => {
    const timeout = setTimeout(refreshDownloads, 0);
    const unsubscribe = onDownloadsChanged(refreshDownloads);
    const unsubscribeProgress = onDownloadsProgress(refreshDownloads);
    return () => {
      clearTimeout(timeout);
      unsubscribe();
      unsubscribeProgress();
    };
  }, [refreshDownloads]);

  // Leaving the page closes the undo window: finalize the staged deletion.
  useEffect(() => {
    return () => {
      if (undoRef.current) {
        commitClearDownloads(undoRef.current);
        undoRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isOnline || authLoading || !user) return;

    let cancelled = false;
    // Play counts need lib/migration-play-count.sql; on databases without
    // the column, fall back to recency order so the tab still works.
    const fetchTop = async () => {
      try {
        return await apiFetch("/api/data/recently_played?order=play_count&ascending=false");
      } catch {
        return await apiFetch("/api/data/recently_played?order=played_at&ascending=false");
      }
    };
    Promise.all([
      apiFetch("/api/data/saved_songs?order=created_at&ascending=false"),
      apiFetch("/api/data/playlists?order=created_at&ascending=false"),
      fetchTop(),
    ])
      .then(([savedData, plData, topData]) => {
        if (cancelled) return;
        setSavedSongIds((savedData || []).map((s) => s.song_id));
        setPlaylists(plData || []);
        setTopPlays(Array.isArray(topData) ? topData : []);
      })
      .catch((error) => console.error("Unable to load library:", error))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user, authLoading, isOnline]);

  const songsFetchedRef = useRef(false);
  useEffect(() => {
    // Public catalog: fetch regardless of auth so saved-song titles resolve
    // for fresh sign-ins / new browsers.
    if (!isOnline || authLoading) return;
    if (allSongs.length > 0) return;

    const fetchSongs = async () => {
      if (songsFetchedRef.current) return;
      songsFetchedRef.current = true;

      try {
        const data = await apiFetch("/api/data/songs?order=title&ascending=true");
        if (data) {
          setAllSongs(data);
        }
      } catch (error) {
        console.error("Unable to load songs:", error);
      }
    };

    fetchSongs();
  }, [allSongs.length, setAllSongs, authLoading, isOnline]);

  const savedSongs = useMemo(() => {
    if (savedSongIds.length === 0 || allSongs.length === 0) return [];
    return savedSongIds.map((sid) => allSongs.find((s) => s.id === sid)).filter(Boolean);
  }, [savedSongIds, allSongs]);

  const newSongIds = useMemo(() => getNewSongIds(allSongs), [allSongs]);

  const topSongs = useMemo(() => {
    if (topPlays.length === 0 || allSongs.length === 0) return [];
    return topPlays
      .map((row) => {
        const song = allSongs.find((s) => s.id === row.song_id);
        return song ? { ...song, playCount: row.play_count || 0 } : null;
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          (b.playCount || 0) - (a.playCount || 0)
      )
      .slice(0, 10);
  }, [topPlays, allSongs]);

  const groupedSaved = useMemo(() => {    const sorted = [...savedSongs].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    return sorted.reduce((groups, song) => {
      const letter = song.title?.[0]?.toUpperCase() || "#";
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(song);
      return groups;
    }, {});
  }, [savedSongs]);

  // Queue must follow the rendered order (letter groups sorted, A-Z within),
  // not the save-date order of savedSongs.
  const savedQueue = useMemo(
    () => Object.keys(groupedSaved).sort().flatMap((letter) => groupedSaved[letter]),
    [groupedSaved]
  );

  // Downloads group A-Z like Saved, but inside a letter the newest-first
  // download order stays — the rail and headers are for finding, not re-sorting.
  const groupedDownloads = useMemo(() => {
    const groups = {};
    downloadedSongs.forEach((song) => {
      const first = (song.title || "").charAt(0).toUpperCase();
      const letter = first >= "A" && first <= "Z" ? first : "#";
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(song);
    });
    return groups;
  }, [downloadedSongs]);

  const downloadLetters = useMemo(() => Object.keys(groupedDownloads).sort(), [groupedDownloads]);

  const downloadQueue = useMemo(
    () => downloadLetters.flatMap((letter) => groupedDownloads[letter]),
    [downloadLetters, groupedDownloads]
  );

  const jumpToDownloadLetter = (letter) => {
    document.getElementById(`download-group-${letter}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const createPlaylist = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const data = await apiFetch("/api/data/playlists", {
        method: "POST",
        body: JSON.stringify({ name, user_id: user.id }),
      });
      if (data) {
        setPlaylists((prev) => [data, ...prev]);
        setNewName("");
        setShowCreate(false);
      }
    } catch (error) {
      console.error("Unable to create playlist:", error);
    }
  };

  const deletePlaylist = async (e, id) => {
    e.stopPropagation();
    if (!confirm("Delete this playlist?")) return;
    try {
      await apiFetch(`/api/data/playlists?id=${id}`, { method: "DELETE" });
      setPlaylists((prev) => prev.filter((p) => p.id !== id));
    } catch (error) {
      console.error("Unable to delete playlist:", error);
    }
  };

  const handleRemoveDownload = async (e, songId) => {
    e.stopPropagation();
    try {
      await removeDownload(songId);
      refreshDownloads();
    } catch (error) {
      console.error("Unable to remove download:", error);
    }
  };

  const handleClearDownloads = () => {
    const snapshot = stageClearDownloads();
    undoRef.current = snapshot;
    setUndoSnapshot(snapshot);
    refreshDownloads();
  };

  const handleUndoClear = () => {
    if (!undoRef.current) return;
    undoClearDownloads(undoRef.current);
    undoRef.current = null;
    setUndoSnapshot(null);
    refreshDownloads();
  };

  const commitClear = () => {
    const snapshot = undoRef.current;
    if (!snapshot) return;
    undoRef.current = null;
    setUndoSnapshot(null);
    commitClearDownloads(snapshot).then(refreshDownloads);
  };

  const handleToggleSaved = async (songId) => {
    if (!user) return;
    try {
      await apiFetch(`/api/data/saved_songs?song_id=${songId}`, { method: "DELETE" });
      setSavedSongIds((prev) => prev.filter((sid) => sid !== songId));
    } catch (error) {
      console.error("Unable to remove saved song:", error);
    }
  };

  // The header count chips jump to their tab, but only while the tab strip
  // itself is rendered (offline, loading, and signed-out states have no tabs).
  const tabsAvailable = isOnline && !authLoading && !!user && !loading;
  const tablistRef = useRef(null);
  const tabRefs = useRef([]);

  const jumpToTab = (key) => {
    setActiveTab(key);
    tablistRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const focusTab = (index) => {
    const next = (index + tabs.length) % tabs.length;
    setActiveTab(tabs[next].key);
    tabRefs.current[next]?.focus();
  };

  const handleTabKeyDown = (e, index) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      focusTab(index + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusTab(index - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusTab(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusTab(tabs.length - 1);
    }
  };

  return (
    <main className="min-h-[90vh] bg-neutral-50/60 px-4 pb-40 pt-2 md:px-8 md:pt-6">
      <div className="max-w-5xl mx-auto">
        <section className="mb-6 md:mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 md:text-2xl">
              Library
            </h1>
            {tabsAvailable ? (
              <span className="hidden md:inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-400">
                <button
                  type="button"
                  onClick={() => jumpToTab("saved")}
                  className="transition hover:text-neutral-900"
                >
                  {savedSongs.length} liked
                </button>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => jumpToTab("playlists")}
                  className="transition hover:text-neutral-900"
                >
                  {playlists.length} playlist{playlists.length !== 1 ? "s" : ""}
                </button>
                <span aria-hidden="true">·</span>
                <span>{downloadedSongs.length} downloaded</span>
              </span>
            ) : (
              <span className="hidden md:inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-400">
                {savedSongs.length} liked · {playlists.length} playlist{playlists.length !== 1 ? "s" : ""} · {downloadedSongs.length} downloaded
              </span>
            )}
          </div>
          <div className="mt-3 md:hidden flex items-center gap-2 text-xs text-neutral-500">
            {tabsAvailable ? (
              <>
                <button
                  type="button"
                  onClick={() => jumpToTab("saved")}
                  className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 font-medium transition hover:text-neutral-900"
                >
                  {savedSongs.length} liked
                </button>
                <button
                  type="button"
                  onClick={() => jumpToTab("playlists")}
                  className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 font-medium transition hover:text-neutral-900"
                >
                  {playlists.length} playlist{playlists.length !== 1 ? "s" : ""}
                </button>
                <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 font-medium">{downloadedSongs.length} downloaded</span>
              </>
            ) : (
              <>
                <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 font-medium">{savedSongs.length} liked</span>
                <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 font-medium">{playlists.length} playlist{playlists.length !== 1 ? "s" : ""}</span>
                <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 font-medium">{downloadedSongs.length} downloaded</span>
              </>
            )}
          </div>
        </section>

        {/* One tab strip — Downloads first, then the account collections */}
        <section className="mb-8">
          <div
            ref={tablistRef}
            role="tablist"
            aria-label="Library sections"
            className="mb-6 flex gap-1 overflow-x-auto no-scrollbar overscroll-x-contain rounded-2xl border border-neutral-200 bg-white p-1 shadow-sm"
          >
            {tabs.map((tab, idx) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  ref={(node) => {
                    tabRefs.current[idx] = node;
                  }}
                  role="tab"
                  id={`library-tab-${tab.key}`}
                  aria-selected={isActive}
                  aria-controls={`library-tabpanel-${tab.key}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActiveTab(tab.key)}
                  onKeyDown={(e) => handleTabKeyDown(e, idx)}
                  className={`flex shrink-0 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap transition ${
                    isActive
                      ? "bg-accent text-white shadow-sm"
                      : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50"
                  }`}
                >
                  <tab.icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {activeTab === "downloads" && (
            <div role="tabpanel" id="library-tabpanel-downloads" aria-labelledby="library-tab-downloads">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-neutral-400">
              {downloadedSongs.length > 0
                ? `${downloadedSongs.length} available offline`
                : "Saved on this device for offline listening"}
            </p>
            {downloadedSongs.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSong(downloadQueue[0], downloadQueue)}
                  className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-accent/90"
                >
                  <Play size={11} fill="currentColor" />
                  Play all
                </button>
                <button
                  type="button"
                  onClick={handleClearDownloads}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-neutral-500 transition hover:bg-red-50 hover:text-red-500"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {storage && storage.quota > 0 && (
            <p className={`mb-4 text-xs font-medium ${(storage.usage / storage.quota) >= 0.95 ? "text-red-500" : "text-neutral-400"}`}>
              {(storage.usage / storage.quota) >= 0.95
                ? "Storage is full — remove some downloads to free up space"
                : `${formatBytes(storage.usage)} used · ${formatBytes(storage.available)} free`}
            </p>
          )}

          {downloadedSongs.length === 0 && downloading.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-dashed border-neutral-200 bg-white shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/[0.06] border border-accent/10 text-accent mb-3.5">
                <Download size={26} />
              </div>
              <h3 className="text-sm md:text-base font-bold text-neutral-900">No downloaded songs</h3>
              <p className="mt-1 max-w-sm text-xs text-neutral-500 leading-relaxed">
                {isOnline ? "Save songs to your device for smooth listening without an internet connection." : "Reconnect to download songs, then listen here without an internet connection."}
              </p>
              {isOnline && (
                <Link
                  href="/songs"
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-4.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-accent/90 transition"
                >
                  Browse Songs to Download
                </Link>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 flex flex-col gap-y-6">
                {downloading.length > 0 && (
                  <div className="flex flex-col gap-y-2 md:gap-y-3">
                    {downloading.map((song) => (
                      <div
                        key={`dl-${song.id}`}
                        className="flex w-full items-center gap-3 px-2 py-2.5 text-left opacity-80 sm:px-3 md:gap-3.5"
                      >
                        <SongAvatar title={song.title} size="sm" variant="mono" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold tracking-tight text-neutral-900">{song.title}</p>
                          <p className="truncate text-xs font-medium text-neutral-400 mt-0.5">{song.author}</p>
                        </div>
                        <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-neutral-500">
                          <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                          Downloading&hellip;
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {downloadLetters.map((letter) => (
                  <div key={letter} id={`download-group-${letter}`} className="scroll-mt-24 flex flex-col gap-y-3">
                    <div className="flex items-center gap-3 border-b border-neutral-100 px-1 pb-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-accent/[0.06] border border-accent/10 text-xs font-bold text-accent">{letter}</span>
                    </div>
                    <div className="flex flex-col divide-y divide-neutral-200/70">
                      {groupedDownloads[letter].map((song) => (
                        <div
                          key={song.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setActiveSong(song, downloadQueue)}
                          onKeyDown={(e) => {
                            if (e.target !== e.currentTarget) return;
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setActiveSong(song, downloadQueue);
                            }
                          }}
                          className="group flex w-full cursor-pointer items-center gap-3 px-2 py-2.5 text-left transition-colors duration-150 hover:bg-neutral-50 active:bg-neutral-100 sm:px-3 md:gap-3.5"
                        >
                          <SongAvatar title={song.title} size="sm" variant="mono" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold tracking-tight text-neutral-900">{song.title}</p>
                            <p className="truncate text-xs font-medium text-neutral-400 mt-0.5">{song.author}</p>
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
                  </div>
                ))}
              </div>
              {downloadLetters.length > 1 && (
                <nav
                  aria-label="Jump to letter in downloads"
                  className="sticky top-24 flex shrink-0 flex-col items-center gap-1 py-1 pr-1"
                >
                  {downloadLetters.map((letter) => (
                    <button
                      key={letter}
                      type="button"
                      onClick={() => jumpToDownloadLetter(letter)}
                      className="px-1 text-[10px] font-bold leading-tight text-neutral-400 transition hover:text-accent"
                    >
                      {letter}
                    </button>
                  ))}
                </nav>
              )}
            </div>
          )}
            </div>
          )}
        </section>

        {/* Account tabs — gated individually so Downloads never disappears */}
        {activeTab !== "downloads" && (
          <div role="tabpanel" id={`library-tabpanel-${activeTab}`} aria-labelledby={`library-tab-${activeTab}`}>
          {!isOnline ? (
          <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-6 text-center shadow-sm">
            <p className="text-xs font-medium text-neutral-500">
              You&rsquo;re offline. Downloads still play here — Playlists, Liked and Top return when you reconnect.
            </p>
          </div>
        ) : authLoading || (user && loading) ? (
          <PageSkeleton />
        ) : !user ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-white px-4 py-16 text-center shadow-sm">
            <Disc className="mb-4 text-neutral-300" size={32} />
            <p className="mb-1 text-sm font-semibold text-neutral-900">Sign in to see your library</p>
            <p className="mb-4 max-w-sm text-xs text-neutral-500">Your downloads stay available on this device without an account.</p>
            <Link href="/auth" className="inline-flex items-center gap-2 rounded-full bg-accent px-4.5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-accent/90">
              <LogIn size={14} /> Sign In
            </Link>
          </div>
        ) : (
          <>
        {/* Liked songs */}
        {activeTab === "saved" && (
          <div>
            {savedSongs.length > 0 ? (
              <div className="flex flex-col gap-y-6">
                {Object.keys(groupedSaved).sort().map((letter) => (
                    <div key={letter} className="flex flex-col gap-y-3">
                      <div className="flex items-center gap-3 border-b border-neutral-100 pb-2 px-1">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-accent/[0.06] border border-accent/10 text-xs font-bold text-accent">{letter}</span>
                      </div>
                    <div className="flex flex-col divide-y divide-neutral-200/70">
                      {groupedSaved[letter].map((song) => (
                        <SongItem
                          key={song.id}
                          song={song}
                          onClick={() => setActiveSong(song, savedQueue)}
                          saved={true}
                          onToggleSave={handleToggleSaved}
                          isNew={newSongIds.has(song.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-dashed border-neutral-200 bg-white shadow-sm">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/[0.06] border border-accent/10 text-accent mb-3.5">
                  <Heart size={26} />
                </div>
                <h3 className="text-sm md:text-base font-bold text-neutral-900">No liked songs yet</h3>
                <p className="mt-1 max-w-sm text-xs text-neutral-500 leading-relaxed">Tap the heart on any song while listening to collect your favorites here.</p>
                <Link href="/songs" className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-4.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-accent/90 transition">
                  Discover Songs
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Most listened — this user's top 10 by play count */}
        {activeTab === "top" && (
          <div>
            {topSongs.length > 0 ? (
              <>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-medium text-neutral-500">
                    Your most played tracks
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveSong(topSongs[0], topSongs)}
                    className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-accent/90"
                  >
                    <Play size={11} fill="currentColor" />
                    Play Top 10
                  </button>
                </div>
                <div className="flex flex-col divide-y divide-neutral-200/70">
                  {topSongs.map((song, idx) => (
                    <div
                      key={song.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setActiveSong(song, topSongs)}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setActiveSong(song, topSongs);
                        }
                      }}
                      className="group flex w-full cursor-pointer items-center gap-2.5 px-2 py-2.5 text-left transition-colors duration-150 hover:bg-neutral-50 active:bg-neutral-100 sm:px-3 sm:gap-3.5"
                    >
                      <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-neutral-400">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <SongAvatar title={song.title} size="sm" variant="mono" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold tracking-tight text-neutral-900">{song.title}</p>
                        <p className="truncate text-xs font-medium text-neutral-500 mt-0.5">{song.author}</p>
                      </div>
                      {song.playCount > 0 && (
                        <span className="shrink-0 rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-bold text-neutral-600">
                          {song.playCount} {song.playCount === 1 ? "play" : "plays"}
                        </span>
                      )}
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 transition-all group-hover:bg-accent group-hover:text-white">
                        <Play size={12} fill="currentColor" className="ml-0.5" />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-dashed border-neutral-200 bg-white shadow-sm">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/[0.06] border border-accent/10 text-accent mb-3.5">
                  <Trophy size={26} />
                </div>
                <h3 className="text-sm md:text-base font-bold text-neutral-900">No plays counted yet</h3>
                <p className="mt-1 max-w-sm text-xs text-neutral-500 leading-relaxed">Listen to songs while signed in and your personal top 10 will build up here.</p>
                <Link href="/songs" className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-4.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-accent/90 transition">
                  Discover Songs
                </Link>
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
              <div className="mb-6 -mt-2 flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3.5 shadow-sm">
                <input
                  type="text"
                  placeholder="Playlist name..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createPlaylist()}
                  className="flex-1 rounded-full border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-xs font-medium outline-none transition placeholder:text-neutral-300 focus:border-accent focus:bg-white"
                  autoFocus
                />
                <button
                  onClick={createPlaylist}
                  disabled={!newName.trim()}
                  className="rounded-full bg-accent px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-accent/90 disabled:opacity-50 shadow-sm"
                >
                  Create
                </button>
              </div>
            )}

            {playlists.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-dashed border-neutral-200 bg-white shadow-sm">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/[0.06] border border-accent/10 text-accent mb-3.5">
                  <ListMusic size={26} />
                </div>
                <h3 className="text-sm md:text-base font-bold text-neutral-900">No playlists yet</h3>
                <p className="mt-1 max-w-sm text-xs text-neutral-500 leading-relaxed">Create collections for praise, meditation, personal worship, or study.</p>
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-4.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-accent/90 transition"
                >
                  <Plus size={14} /> Create Playlist
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {playlists.map((pl) => (
                  <div
                    key={pl.id}
                    onClick={() => router.push(`/playlists/${pl.id}`)}
                    className="group flex cursor-pointer flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:shadow-md hover:border-neutral-300 hover:-translate-y-0.5"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-accent/[0.06] border border-accent/10 text-accent">
                        <ListMusic size={22} />
                      </div>
                      <button
                        onClick={(e) => deletePlaylist(e, pl.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition-all duration-300 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 hover:bg-accent hover:text-white"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div>
                      <h3 className="truncate text-sm font-semibold tracking-tight text-neutral-900">{pl.name}</h3>
                      <p className="mt-0.5 text-xs font-medium text-neutral-400">Playlist</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
          </>
        )}
          </div>
        )}

        {undoSnapshot && (
          <UndoToast
            key={undoSnapshot.id}
            expiresAt={undoSnapshot.expiresAt}
            message={`${undoSnapshot.songs.length} ${undoSnapshot.songs.length === 1 ? "download" : "downloads"} cleared`}
            onAction={handleUndoClear}
            onDismiss={commitClear}
          />
        )}
      </div>
    </main>
  );
}

export default function LibraryPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[90vh] bg-neutral-50/60 px-4 pb-40 pt-2 md:px-8 md:pt-6">
          <div className="max-w-5xl mx-auto"><PageSkeleton /></div>
        </main>
      }
    >
      <LibraryContent />
    </Suspense>
  );
}
