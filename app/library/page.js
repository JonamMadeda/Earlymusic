"use client";

import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef, Suspense } from "react";
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
  Disc,
  LogIn,
  Heart,
  ListMusic,
  Download,
  Play,
  Trash2,
  Plus,
  Trophy,
  Loader2,
  Search,
  X,
  Shuffle,
  ExternalLink,
  WifiOff,
  Award,
  CalendarDays,
  Pencil,
  Share2,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import ActionMenu from "@/app/components/ActionMenu";
import ConfirmModal from "@/app/components/ConfirmModal";
import EmptyState from "@/app/components/EmptyState";
import PlaylistNameDialog from "@/app/components/PlaylistNameDialog";
import UndoToast from "../components/UndoToast";
import PickSongDialog from "../components/PickSongDialog";
import {
  PICK_PERIODS,
  PICK_PERIOD_KEYS,
  periodStart,
  summarizePlays,
} from "@/lib/highlights";
import { shareSongWithContext } from "@/lib/share";
import {
  useLibraryNudge,
  markLibraryNudgeSeen,
  markStandoutsSubTabSeen,
  publishStandoutsContent,
} from "@/lib/libraryNudge";
import StandoutsNudgeSettings from "@/app/components/StandoutsNudgeSettings";
import {
  getDownloadedSongs,
  removeDownload,
  onDownloadsChanged,
  getActiveDownloads,
  onDownloadsProgress,
  stageClearDownloads,
  commitClearDownloads,
  undoClearDownloads,
} from "@/lib/downloadManager";

const DOWNLOAD_STICKY_TOP = 8;
const MOBILE_RAIL_BOTTOM_GAP = 12;

const measureTabOverflow = (element, setter) => {
  if (!element || typeof element.scrollWidth !== "number") return;
  const next = {
    left: element.scrollLeft > 1,
    right: element.scrollLeft + element.clientWidth < element.scrollWidth - 1,
  };
  setter((prev) => (prev.left === next.left && prev.right === next.right ? prev : next));
};

const tabs = [
  { key: "downloads", label: "Downloads", icon: Download },
  { key: "playlists", label: "Playlists", icon: ListMusic },
  { key: "standouts", label: "Standouts", icon: TrendingUp },
  { key: "saved", label: "Liked", icon: Heart },
];

const tabKeys = tabs.map((t) => t.key);

const standoutsTabs = [
  { key: "highlights", label: "Highlights", icon: Award },
  { key: "picks", label: "Picks", icon: CalendarDays },
  { key: "top", label: "Top", icon: Trophy },
];

const standoutsSubTabKeys = standoutsTabs.map((t) => t.key);

// Fisher–Yates keeps "Shuffle" honest: every ordering is equally likely.
const shuffleSongs = (queue) => {
  const shuffled = [...queue];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

function LibraryContent() {
  const { user, loading: authLoading } = useAuth();
  const { allSongs, setAllSongs, setActiveSong, activeSong } = usePlayer();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isOnline = useOnlineStatus();
  const standoutsNudge = useLibraryNudge();
  const resolveTabState = useCallback((rawTab) => {
    if (standoutsSubTabKeys.includes(rawTab)) {
      return { tab: "standouts", subTab: rawTab };
    }
    if (rawTab === "standouts" || rawTab === "insights") {
      return { tab: "standouts", subTab: "highlights" };
    }
    if (tabKeys.includes(rawTab)) {
      return { tab: rawTab, subTab: "highlights" };
    }
    return { tab: "downloads", subTab: "highlights" };
  }, []);
  const initialTabState = resolveTabState(searchParams.get("tab"));
  const [activeTab, setActiveTab] = useState(initialTabState.tab);
  const [standoutsSubTab, setStandoutsSubTab] = useState(initialTabState.subTab);
  const [loading, setLoading] = useState(true);

  // Only react when ?tab= itself changes. The URL-sync effect below rewrites
  // the query with replaceState, which does not update Next's searchParams,
  // so unrelated query changes must never reset the selected tab.
  const lastUrlTabRef = useRef(searchParams.get("tab"));
  useEffect(() => {
    const rawTab = searchParams.get("tab");
    if (rawTab === lastUrlTabRef.current) return;
    lastUrlTabRef.current = rawTab;
    const next = resolveTabState(rawTab);
    setActiveTab(next.tab);
    setStandoutsSubTab(next.subTab);
  }, [searchParams, resolveTabState]);

  // Back/Forward can also move through the address bar; the ref keeps this
  // listener and the effect above from applying the same navigation twice.
  useEffect(() => {
    const applyTabFromLocation = () => {
      const rawTab = new URLSearchParams(window.location.search).get("tab");
      if (rawTab === lastUrlTabRef.current) return;
      lastUrlTabRef.current = rawTab;
      const next = resolveTabState(rawTab);
      setActiveTab(next.tab);
      setStandoutsSubTab(next.subTab);
    };
    window.addEventListener("popstate", applyTabFromLocation);
    return () => window.removeEventListener("popstate", applyTabFromLocation);
  }, [resolveTabState]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const tabParam = activeTab === "standouts" ? standoutsSubTab : activeTab;
    if (tabParam === "downloads") params.delete("tab");
    else params.set("tab", tabParam);
    const query = params.toString();
    const url = `${pathname}${query ? `?${query}` : ""}`;
    if (url === `${window.location.pathname}${window.location.search}`) return;
    window.history.replaceState(window.history.state, "", url);
  }, [activeTab, standoutsSubTab, pathname, searchParams]);

  // Saved songs
  const [savedSongIds, setSavedSongIds] = useState([]);

  // Most listened (this user's play counts from recently_played)
  const [topPlays, setTopPlays] = useState([]);

  // Picks — one saved song per period, shared with a contextual message.
  const [picks, setPicks] = useState([]);
  const [pickerPeriod, setPickerPeriod] = useState(null);
  const [pickSaving, setPickSaving] = useState(false);

  // Highlights — automatic leaders from play_events.
  const [playEvents, setPlayEvents] = useState(null);
  const [highlightsLoading, setHighlightsLoading] = useState(false);
  const [highlightsFallback, setHighlightsFallback] = useState(false);

  // One transient confirmation shared by pick/highlight share buttons.
  const [shareFeedback, setShareFeedback] = useState(null);
  const shareFeedbackTimer = useRef(null);

  // Playlists
  const [playlists, setPlaylists] = useState([]);
  const [playlistCounts, setPlaylistCounts] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingPlaylist, setRenamingPlaylist] = useState(null);
  const [deletingPlaylist, setDeletingPlaylist] = useState(null);
  const [playlistBusy, setPlaylistBusy] = useState(false);

  // Liked-song search keeps long collections scannable.
  const [likedQuery, setLikedQuery] = useState("");

  // Downloads
  const [downloadedSongs, setDownloadedSongs] = useState([]);
  const [downloading, setDownloading] = useState([]);

  // One undo window serves downloads, liked songs, and picks. The callbacks
  // live in a ref so a dismissal after navigation commits the right change.
  const [undoToast, setUndoToast] = useState(null);
  const undoToastRef = useRef(null);

  const refreshDownloads = useCallback(() => {
    // Newest first: the list is how listeners judge what they just saved.
    setDownloadedSongs(
      getDownloadedSongs().sort(
        (a, b) => new Date(b.downloadedAt || 0) - new Date(a.downloadedAt || 0)
      )
    );
    setDownloading(getActiveDownloads());
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

  // Leaving the page closes the undo window: finalize whatever was staged.
  useEffect(() => {
    return () => {
      const pending = undoToastRef.current;
      undoToastRef.current = null;
      pending?.onDismiss?.();
      clearTimeout(shareFeedbackTimer.current);
    };
  }, []);

  const dismissUndo = useCallback(() => {
    const pending = undoToastRef.current;
    undoToastRef.current = null;
    setUndoToast(null);
    pending?.onDismiss?.();
  }, []);

  const showUndoToast = useCallback(({ message, onAction, onDismiss }) => {
    undoToastRef.current?.onDismiss?.();
    const next = {
      id: `undo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      message,
      expiresAt: Date.now() + 8000,
      onAction,
      onDismiss,
    };
    undoToastRef.current = next;
    setUndoToast(next);
  }, []);

  const applyUndo = useCallback(() => {
    const pending = undoToastRef.current;
    undoToastRef.current = null;
    setUndoToast(null);
    pending?.onAction?.();
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
    // Picks needs lib/migration-picks.sql; a missing table must not stop the
    // rest of the library (liked songs, playlists, top tracks) from loading.
    const fetchPicks = async () => {
      try {
        return await apiFetch("/api/data/picks");
      } catch {
        return [];
      }
    };
    // Each section is independent: a failed playlists or saved-songs request
    // must not throw away Picks/Top rows that did load successfully.
    Promise.allSettled([
      apiFetch("/api/data/saved_songs?order=created_at&ascending=false"),
      apiFetch("/api/data/playlists?order=created_at&ascending=false"),
      fetchTop(),
      fetchPicks(),
    ])
      .then(async ([savedResult, plResult, topResult, pickResult]) => {
        if (cancelled) return;
        if (savedResult.status === "rejected") console.error("Unable to load saved songs:", savedResult.reason);
        if (plResult.status === "rejected") console.error("Unable to load playlists:", plResult.reason);
        const savedData = savedResult.status === "fulfilled" ? savedResult.value : [];
        const plData = plResult.status === "fulfilled" ? plResult.value : [];
        const topData = topResult.status === "fulfilled" ? topResult.value : [];
        const pickData = pickResult.status === "fulfilled" ? pickResult.value : [];
        const list = Array.isArray(plData) ? plData : [];
        setSavedSongIds((Array.isArray(savedData) ? savedData : []).map((s) => s.song_id));
        setPlaylists(list);
        setTopPlays(Array.isArray(topData) ? topData : []);
        setPicks(Array.isArray(pickData) ? pickData : []);

        // Counts are small per user and the generic API already scopes these
        // rows to the caller. A missing/unavailable count only hides the
        // metadata; it never blocks the playlist itself from rendering.
        const counts = await Promise.all(
          list.map(async (playlist) => {
            try {
              const rows = await apiFetch(
                `/api/data/playlist_songs?playlist_id=${playlist.id}&columns=id`
              );
              return [playlist.id, Array.isArray(rows) ? rows.length : 0];
            } catch {
              return [playlist.id, 0];
            }
          })
        );
        if (!cancelled) setPlaylistCounts(Object.fromEntries(counts));
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

  const picksByPeriod = useMemo(() => {
    const map = {};
    if (allSongs.length === 0) return map;
    picks.forEach((pick) => {
      const song = allSongs.find((item) => String(item.id) === String(pick.song_id));
      if (song) map[pick.period] = { ...pick, song };
    });
    return map;
  }, [picks, allSongs]);

  const picksQueue = useMemo(
    () => PICK_PERIOD_KEYS.map((key) => picksByPeriod[key]?.song).filter(Boolean),
    [picksByPeriod]
  );

  // Refresh the year's play events every time Highlights opens, so a song
  // played since the last visit is counted immediately. A missing table
  // falls back to recently_played counts below.
  useEffect(() => {
    if (!isOnline || authLoading || !user || activeTab !== "standouts" || standoutsSubTab !== "highlights") return undefined;

    let cancelled = false;
    setHighlightsLoading(true);
    const since = periodStart("year").toISOString();
    apiFetch(
      `/api/data/play_events?since=${encodeURIComponent(since)}&order=played_at&ascending=false`
    )
      .then((rows) => {
        if (cancelled) return;
        setPlayEvents(Array.isArray(rows) ? rows : []);
        setHighlightsFallback(false);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Unable to load play history:", error);
        setPlayEvents([]);
        setHighlightsFallback(true);
      })
      .finally(() => {
        if (!cancelled) setHighlightsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOnline, authLoading, user, activeTab, standoutsSubTab]);

  // Recently_played stores one lifetime total and the last timestamp per song.
  // Feeding those rows into the period ranker made the newest song win day,
  // week and year at once, so Highlights only ever uses real play events.
  // The first play_events migration copied recently_played one-for-one; those
  // snapshot rows still match by song/timestamp and must not count as plays.
  const seededEventKeys = useMemo(
    () =>
      new Set(
        topPlays
          .filter((row) => row.played_at)
          .map((row) => `${row.song_id}|${row.played_at}`)
      ),
    [topPlays]
  );

  const highlightEvents = useMemo(
    () =>
      (playEvents || []).filter(
        (event) => !seededEventKeys.has(`${event.song_id}|${event.played_at}`)
      ),
    [playEvents, seededEventKeys]
  );

  const highlights = useMemo(
    () => summarizePlays(highlightEvents, allSongs),
    [highlightEvents, allSongs]
  );

  const highlightQueue = useMemo(
    () => highlights.map((item) => item.song).filter(Boolean),
    [highlights]
  );

  // Feed the nudge the rows we already loaded instead of duplicating queries.
  // Opening Standouts is the "seen" signal, and content that loads while it is
  // already open is seen too — a slow fetch must not re-light the dot on the
  // very page displaying it.
  useEffect(() => {
    publishStandoutsContent({ picks, highlights });
    if (activeTab === "standouts") markLibraryNudgeSeen();
  }, [picks, highlights, activeTab]);

  const notifyShare = useCallback((key, message) => {
    setShareFeedback({ key, message });
    clearTimeout(shareFeedbackTimer.current);
    shareFeedbackTimer.current = setTimeout(() => setShareFeedback(null), 2000);
  }, []);

  const savePick = async (song) => {
    const period = pickerPeriod;
    if (!period || !song) return;
    setPickSaving(true);
    try {
      const saved = await apiFetch("/api/data/picks", {
        method: "POST",
        body: JSON.stringify({ song_id: song.id, period }),
      });
      setPicks((prev) => [
        ...prev.filter((pick) => pick.period !== period),
        saved && saved.period ? saved : { period, song_id: song.id },
      ]);
      setPickerPeriod(null);
    } catch (error) {
      console.error("Unable to save pick:", error);
    } finally {
      setPickSaving(false);
    }
  };

  const removePick = (period, song) => {
    const existing = picks.find((pick) => pick.period === period);
    if (!existing) return;
    setPicks((prev) => prev.filter((pick) => pick.period !== period));
    showUndoToast({
      message: `${song?.title || "Song"} removed from ${period}`,
      onAction: () => {
        setPicks((prev) => [...prev.filter((pick) => pick.period !== period), existing]);
        publishStandoutsContent({ picks: [...picks.filter((pick) => pick.period !== period), existing] });
      },
      onDismiss: async () => {
        try {
          await apiFetch(`/api/data/picks?period=${period}`, { method: "DELETE" });
        } catch (error) {
          console.error("Unable to remove pick:", error);
        }
      },
    });
  };

  const handleShare = async (kind, period, song, headingLabel) => {
    if (!song) return;
    try {
      const result = await shareSongWithContext(song, headingLabel.toLowerCase());
      const message =
        result === "copied" ? "Link copied" : result === "shared" ? "Shared" : "Share failed";
      notifyShare(`${kind}-${period}`, message);
    } catch (error) {
      console.error("Unable to share:", error);
      notifyShare(`${kind}-${period}`, "Share failed");
    }
  };

  const filteredSavedSongs = useMemo(() => {
    const query = likedQuery.trim().toLowerCase();
    if (!query) return savedSongs;
    return savedSongs.filter(
      (song) =>
        (song.title || "").toLowerCase().includes(query) ||
        (song.author || "").toLowerCase().includes(query)
    );
  }, [savedSongs, likedQuery]);

  const groupedSaved = useMemo(() => {
    const sorted = [...filteredSavedSongs].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    return sorted.reduce((groups, song) => {
      const letter = song.title?.[0]?.toUpperCase() || "#";
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(song);
      return groups;
    }, {});
  }, [filteredSavedSongs]);

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
    setJumpDownloadLetter(letter);
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
        setPlaylistCounts((prev) => ({ ...prev, [data.id]: 0 }));
        setNewName("");
        setShowCreate(false);
      }
    } catch (error) {
      console.error("Unable to create playlist:", error);
    }
  };

  const renamePlaylist = async (name) => {
    const playlist = renamingPlaylist;
    if (!playlist || !name) return;
    setPlaylistBusy(true);
    try {
      const updated = await apiFetch(`/api/data/playlists?id=${playlist.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      const nextName = Array.isArray(updated) ? updated[0]?.name : updated?.name;
      setPlaylists((prev) =>
        prev.map((item) => (item.id === playlist.id ? { ...item, name: nextName || name } : item))
      );
      setRenamingPlaylist(null);
    } catch (error) {
      console.error("Unable to rename playlist:", error);
    } finally {
      setPlaylistBusy(false);
    }
  };

  const confirmDeletePlaylist = async () => {
    const playlist = deletingPlaylist;
    if (!playlist) return;
    setPlaylistBusy(true);
    try {
      await apiFetch(`/api/data/playlists?id=${playlist.id}`, { method: "DELETE" });
      setPlaylists((prev) => prev.filter((item) => item.id !== playlist.id));
      setPlaylistCounts((prev) => {
        const next = { ...prev };
        delete next[playlist.id];
        return next;
      });
      setDeletingPlaylist(null);
    } catch (error) {
      console.error("Unable to delete playlist:", error);
    } finally {
      setPlaylistBusy(false);
    }
  };

  const handleRemoveDownload = async (songId) => {
    try {
      await removeDownload(songId);
      refreshDownloads();
    } catch (error) {
      console.error("Unable to remove download:", error);
    }
  };

  const handleClearDownloads = () => {
    const snapshot = stageClearDownloads();
    showUndoToast({
      message: `${snapshot.songs.length} ${snapshot.songs.length === 1 ? "download" : "downloads"} cleared`,
      onAction: () => {
        undoClearDownloads(snapshot);
        refreshDownloads();
      },
      onDismiss: () => commitClearDownloads(snapshot).then(refreshDownloads),
    });
    refreshDownloads();
  };

  // A liked song is removed locally first; the DELETE is committed only when
  // the undo window closes, so an accidental tap is genuinely recoverable.
  const handleToggleSaved = (songId) => {
    if (!user) return;
    const song = allSongs.find((item) => item.id === songId);
    showUndoToast({
      message: `${song?.title || "Song"} removed from Liked`,
      onAction: async () => {
        setSavedSongIds((prev) => (prev.includes(songId) ? prev : [...prev, songId]));
        try {
          await apiFetch("/api/data/saved_songs", {
            method: "POST",
            body: JSON.stringify({ song_id: songId }),
          });
        } catch (error) {
          console.error("Unable to restore liked song:", error);
        }
      },
      onDismiss: async () => {
        try {
          await apiFetch(`/api/data/saved_songs?song_id=${songId}`, { method: "DELETE" });
        } catch (error) {
          console.error("Unable to remove saved song:", error);
        }
      },
    });
    setSavedSongIds((prev) => prev.filter((sid) => sid !== songId));
  };

  const playShuffled = (queue) => {
    if (!queue || queue.length === 0) return;
    const shuffled = shuffleSongs(queue);
    setActiveSong(shuffled[0], shuffled);
  };

  const tablistRef = useRef(null);
  const tabRefs = useRef([]);
  const standoutsTablistRef = useRef(null);
  const standoutsTabRefs = useRef([]);
  const [mainTabsOverflow, setMainTabsOverflow] = useState({ left: false, right: false });
  const [standoutsTabsOverflow, setStandoutsTabsOverflow] = useState({
    left: false,
    right: false,
  });
  const downloadListRowRef = useRef(null);
  const [downloadRailBox, setDownloadRailBox] = useState(null);
  const [jumpDownloadLetter, setJumpDownloadLetter] = useState(null);
  const tabCounts = {
    downloads: downloadedSongs.length,
    playlists: playlists.length,
    standouts: null,
    saved: savedSongs.length,
  };
  const showTabCounts = isOnline && !!user && !loading;

  // A hidden scrollbar gives no clue that a tab strip continues. Track the
  // right edge so the fade and swipe hint appear only when tabs are hidden.
  const measureTabs = useCallback(() => {
    measureTabOverflow(tablistRef.current, setMainTabsOverflow);
    measureTabOverflow(standoutsTablistRef.current, setStandoutsTabsOverflow);
  }, []);

  const scrollActiveTabIntoView = (element, index) => {
    const buttons = element?.querySelectorAll?.('[role="tab"]');
    if (!buttons?.[index] || typeof buttons[index].scrollIntoView !== "function") return;
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    buttons[index].scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };

  useEffect(() => {
    measureTabs();
    const onResize = () => measureTabs();
    window.addEventListener?.("resize", onResize);
    return () => window.removeEventListener?.("resize", onResize);
  }, [measureTabs, activeTab, standoutsSubTab, showTabCounts]);

  useEffect(() => {
    scrollActiveTabIntoView(tablistRef.current, tabs.findIndex((tab) => tab.key === activeTab));
  }, [activeTab]);

  useEffect(() => {
    scrollActiveTabIntoView(
      standoutsTablistRef.current,
      standoutsTabs.findIndex((tab) => tab.key === standoutsSubTab)
    );
  }, [standoutsSubTab]);

  // The A-Z rail is pinned to the visible list area, just above the bottom
  // player/nav, instead of following the list from the top. Measuring the real
  // app chrome keeps it clear of whichever player is on screen.
  useLayoutEffect(() => {
    const row = downloadListRowRef.current;
    const scroller = document.getElementById("app-scroll");
    if (!row || !scroller) return;
    const chrome = ["bottom-nav", "now-playing-bar", "mobile-now-playing-bar"]
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    const viewport = window.visualViewport;
    const measureRail = () => {
      const rowRect = row.getBoundingClientRect();
      const scRect = scroller.getBoundingClientRect();
      const top = Math.max(scRect.top, viewport?.offsetTop || 0) + DOWNLOAD_STICKY_TOP;
      let bottom = Math.min(
        scRect.bottom,
        viewport ? viewport.offsetTop + viewport.height : window.innerHeight
      );
      for (const element of chrome) {
        const rect = element.getBoundingClientRect();
        if (rect.height > 0) bottom = Math.min(bottom, rect.top);
      }
      const available = Math.max(0, bottom - DOWNLOAD_STICKY_TOP - top);
      // Match the Songs rail: half the letter count, with a four-letter floor,
      // so extra letters scroll inside a short track instead of stretching it.
      const visibleLetters = Math.max(4, Math.ceil(downloadLetters.length / 2));
      const height = Math.min(available, visibleLetters * 24 + 12);
      const isPhone = window.matchMedia("(max-width: 639px)").matches;
      const railTop = isPhone
        ? Math.max(top, bottom - MOBILE_RAIL_BOTTOM_GAP - height)
        : top + (available - height) / 2;
      const next = {
        top: railTop,
        height,
        right: Math.max(8, window.innerWidth - rowRect.right),
      };
      setDownloadRailBox((previous) =>
        previous && previous.top === next.top && previous.height === next.height && previous.right === next.right
          ? previous
          : next
      );
    };
    measureRail();
    const ResizeObserverClass = window.ResizeObserver;
    const observer = ResizeObserverClass ? new ResizeObserverClass(measureRail) : null;
    [scroller, row, ...chrome].forEach((element) => observer?.observe(element));
    window.addEventListener("resize", measureRail);
    viewport?.addEventListener("resize", measureRail);
    viewport?.addEventListener("scroll", measureRail);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measureRail);
      viewport?.removeEventListener("resize", measureRail);
      viewport?.removeEventListener("scroll", measureRail);
    };
  }, [activeTab, activeSong, downloadLetters.length]);

  const selectMainTab = (key) => {
    setActiveTab(key);
    // Standouts has a main view: opening the tab returns to Highlights.
    if (key === "standouts") {
      setStandoutsSubTab("highlights");
      markStandoutsSubTabSeen("highlights");
    }
  };

  const focusTab = (index) => {
    const next = (index + tabs.length) % tabs.length;
    selectMainTab(tabs[next].key);
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

  const focusStandoutsTab = (index) => {
    const next = (index + standoutsTabs.length) % standoutsTabs.length;
    const key = standoutsTabs[next].key;
    setStandoutsSubTab(key);
    markStandoutsSubTabSeen(key);
    standoutsTabRefs.current[next]?.focus();
  };

  const handleStandoutsTabKeyDown = (e, index) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      focusStandoutsTab(index + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusStandoutsTab(index - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusStandoutsTab(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusStandoutsTab(standoutsTabs.length - 1);
    }
  };

  return (
    <div className="min-h-[90vh] bg-white px-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3 sm:px-6 md:px-8 md:pt-5">
      <div className="mx-auto max-w-5xl">
        <h1 className="sr-only">Library</h1>

        <div className="relative mt-2 md:mt-2.5">
          <div
            ref={tablistRef}
            role="tablist"
            aria-label="Library collections"
            onScroll={measureTabs}
            className="inline-flex w-auto max-w-full scroll-mt-4 flex-nowrap items-center gap-0.5 overflow-x-auto rounded-full border border-neutral-200 bg-neutral-100/70 p-0.5 no-scrollbar sm:overflow-x-visible"
          >
            {tabs.map((tab, idx) => {
              const isActive = activeTab === tab.key;
              const count = showTabCounts ? tabCounts[tab.key] : null;
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
                  onClick={() => selectMainTab(tab.key)}
                  onKeyDown={(e) => handleTabKeyDown(e, idx)}
                  className={`flex shrink-0 items-center justify-center gap-1 rounded-full px-2 py-1.5 text-[11px] font-semibold whitespace-nowrap transition sm:flex-none sm:gap-1.5 sm:px-2.5 ${
                    isActive
                      ? "bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200/70"
                      : "text-neutral-500 hover:bg-white/60 hover:text-neutral-900"
                  }`}
                >
                  <tab.icon
                    size={13}
                    strokeWidth={isActive ? 2.5 : 2}
                    className="shrink-0"
                    aria-hidden="true"
                  />
                  <span>{tab.label}</span>
                  {count !== null && (
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums ${
                        isActive ? "bg-accent/10 text-accent" : "bg-neutral-200/70 text-neutral-500"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                  {tab.key === "standouts" && standoutsNudge.active && (
                    <span
                      aria-hidden="true"
                      title={`New ${standoutsNudge.reasonLabel}`}
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent ring-2 ring-white/80"
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-y-0.5 left-0.5 w-6 rounded-l-full bg-gradient-to-r from-neutral-100 to-transparent transition-opacity ${
              mainTabsOverflow.left ? "opacity-100" : "opacity-0"
            }`}
          />
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-y-0.5 right-0.5 w-6 rounded-r-full bg-gradient-to-l from-neutral-100 to-transparent transition-opacity ${
              mainTabsOverflow.right ? "opacity-100" : "opacity-0"
            }`}
          />
          {mainTabsOverflow.right && (
            <p className="mt-1 text-[10px] font-medium text-neutral-400 sm:hidden">
              Swipe for more tabs
            </p>
          )}
        </div>

        <div className="mt-4 md:mt-5">
          {activeTab === "downloads" && (
            <div
              role="tabpanel"
              id="library-tabpanel-downloads"
              aria-labelledby="library-tab-downloads"
              className="animate-fade-in"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <h2 className="section-title">Downloads</h2>
                  {downloadedSongs.length > 0 && (
                    <p className="mt-0.5 text-xs font-medium text-neutral-500">
                      {downloadedSongs.length} {downloadedSongs.length === 1 ? "song" : "songs"}
                    </p>
                  )}
                </div>
                {downloadedSongs.length > 0 && (
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveSong(downloadQueue[0], downloadQueue)}
                      className="btn-primary min-h-9 px-3.5 py-1.5 text-xs"
                    >
                      <Play size={11} fill="currentColor" />
                      Play all
                    </button>
                    <ActionMenu
                      label="More download actions"
                      triggerTitle="More download options"
                      align="left"
                    >
                      {({ close }) => (
                        <button
                          type="button"
                          onClick={() => {
                            close();
                            handleClearDownloads();
                          }}
                          className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2 size={15} aria-hidden="true" />
                          Clear all downloads
                        </button>
                      )}
                    </ActionMenu>
                  </div>
                )}
              </div>

              {downloadedSongs.length === 0 && downloading.length === 0 ? (
                <EmptyState
                  icon={Download}
                  title="No downloaded songs"
                  action={
                    isOnline ? (
                      <Link href="/songs" className="btn-primary min-h-9 px-4 py-2 text-xs">
                        Browse songs
                      </Link>
                    ) : null
                  }
                />
              ) : (
                <div ref={downloadListRowRef} className="mt-4 flex gap-1.5 sm:gap-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-y-3">
                    {downloading.length > 0 && (
                      <div className="flex flex-col gap-y-1">
                        <div className="sticky z-10 -mx-1.5 flex items-center gap-2 border-b border-neutral-200/70 bg-white/95 px-1.5 py-1.5 backdrop-blur-md">
                          <Loader2 size={13} className="animate-spin text-neutral-500" aria-hidden="true" />
                          <span className="text-xs font-medium text-neutral-500">
                            Downloading {downloading.length}
                          </span>
                        </div>
                        <div className="flex flex-col divide-y divide-neutral-200/70">
                          {downloading.map((song) => (
                            <div
                              key={`dl-${song.id}`}
                              className="group relative flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left opacity-80 transition-colors duration-150 sm:px-3 sm:py-2.5 sm:gap-3.5"
                            >
                              <div className="relative shrink-0">
                                <SongAvatar title={song.title} variant="mono" size="md" />
                              </div>
                              <div className="flex min-h-11 min-w-0 flex-1 flex-col justify-center gap-0.5 rounded text-left">
                                <span className="flex w-full min-w-0 items-center gap-1.5">
                                  <span className="truncate text-sm font-semibold leading-5 tracking-tight text-neutral-900">
                                    {song.title}
                                  </span>
                                </span>
                                <span className="flex w-full min-w-0 items-center gap-1.5 text-xs leading-4 text-neutral-500">
                                  <span className="truncate font-medium">{song.author}</span>
                                </span>
                              </div>
                              <span className="shrink-0 text-xs font-semibold text-neutral-500">
                                Saving&hellip;
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-y-3 sm:gap-y-4">
                      {downloadLetters.map((letter) => (
                        <section
                          key={letter}
                          id={`download-group-${letter}`}
                          style={{ scrollMarginTop: DOWNLOAD_STICKY_TOP + 34 }}
                          className="flex flex-col gap-y-1"
                        >
                          <div
                            style={{ top: DOWNLOAD_STICKY_TOP }}
                            className="sticky z-10 -mx-1.5 flex items-center gap-2 border-b border-neutral-200/70 bg-white/95 px-1.5 py-1.5 backdrop-blur-md"
                          >
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/[0.07] text-xs font-bold text-accent">
                              {letter}
                            </div>
                            <span className="text-xs font-medium text-neutral-500">
                              {groupedDownloads[letter].length}{" "}
                              {groupedDownloads[letter].length === 1 ? "song" : "songs"}
                            </span>
                          </div>
                          <div className="flex flex-col divide-y divide-neutral-200/70">
                            {groupedDownloads[letter].map((song) => {
                              const isActive = activeSong?.id === song.id;
                              const isNew = newSongIds.has(song.id);
                              return (
                                <div
                                  key={song.id}
                                  className={`group relative flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors duration-150 sm:px-3 sm:py-2.5 sm:gap-3.5 ${
                                    isActive ? "bg-accent/[0.07]" : "hover:bg-neutral-50 active:bg-neutral-100"
                                  }`}
                                >
                                  <div className="relative shrink-0">
                                    <SongAvatar title={song.title} variant="mono" size="md" />
                                    {isActive && (
                                      <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-white" />
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setActiveSong(song, downloadQueue)}
                                    aria-current={isActive ? "true" : undefined}
                                    aria-label={`${isActive ? "Playing" : "Play"}: ${song.title || "this song"}`}
                                    className="flex min-h-11 min-w-0 flex-1 cursor-pointer flex-col justify-center gap-0.5 rounded text-left after:absolute after:inset-0"
                                  >
                                    <span className="flex w-full min-w-0 items-center gap-1.5">
                                      <span className={`truncate text-sm font-semibold leading-5 tracking-tight ${isActive ? "text-accent" : "text-neutral-900 group-hover:text-accent"}`}>
                                        {song.title}
                                      </span>
                                      {isActive && (
                                        <span className="waveform shrink-0 text-accent" aria-hidden="true">
                                          <span /><span /><span /><span />
                                        </span>
                                      )}
                                      {isNew && !isActive && (
                                        <span className="shrink-0 rounded-full bg-ink/10 px-1.5 py-0.5 text-[10px] font-semibold leading-3 text-ink">
                                          New
                                        </span>
                                      )}
                                    </span>
                                    <span className="flex w-full min-w-0 items-center gap-1.5 text-xs leading-4 text-neutral-500">
                                      <span className="truncate font-medium">
                                        {song.author || "Unknown Artist"}
                                      </span>
                                      {song.category && (
                                        <>
                                          <span className="sm:hidden text-neutral-300" aria-hidden="true">•</span>
                                          <span className="sm:hidden shrink-0">{song.category}</span>
                                        </>
                                      )}
                                    </span>
                                  </button>
                                  <div className="relative z-20 flex items-center gap-1.5">
                                    {song.category && (
                                      <span className="hidden sm:inline-flex tap-sm items-center rounded-full border border-neutral-200/80 bg-neutral-50 px-2.5 py-0.5 text-[11px] font-medium text-neutral-600">
                                        {song.category}
                                      </span>
                                    )}
                                    <ActionMenu
                                      label={`More actions for ${song.title || "downloaded song"}`}
                                      triggerTitle="More"
                                      className="shrink-0"
                                      triggerClassName="tap-sm flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-accent"
                                    >
                                      {({ close }) => (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            close();
                                            handleRemoveDownload(song.id);
                                          }}
                                          className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-red-600 transition hover:bg-red-50"
                                        >
                                          <Trash2 size={15} aria-hidden="true" />
                                          Remove download
                                        </button>
                                      )}
                                    </ActionMenu>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                  </div>

                  {downloadLetters.length > 1 && (
                    <>
                      <div aria-hidden="true" className="w-6 shrink-0 sm:w-7" />
                      <div
                        style={downloadRailBox && downloadRailBox.height > 0 ? {
                          top: downloadRailBox.top,
                          height: downloadRailBox.height,
                          right: downloadRailBox.right,
                          touchAction: "pan-y",
                        } : { visibility: "hidden" }}
                        aria-label="Jump to letter in downloads"
                        role="group"
                        className="songs-index fixed z-30 flex w-6 select-none flex-col items-stretch justify-start overflow-y-auto rounded-full bg-neutral-100/80 py-1.5 sm:w-7"
                      >
                        {downloadLetters.map((letter) => (
                          <button
                            key={letter}
                            type="button"
                            onClick={() => jumpToDownloadLetter(letter)}
                            aria-label={`Jump to ${letter}`}
                            aria-current={jumpDownloadLetter === letter ? "location" : undefined}
                            className={`flex h-6 min-h-0 w-full shrink-0 cursor-pointer items-center justify-center rounded-full text-[11px] font-bold leading-none transition-colors duration-150 select-none ${
                              jumpDownloadLetter === letter
                                ? "bg-accent text-white"
                                : "text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800 active:bg-neutral-200 active:text-neutral-800"
                            }`}
                          >
                            {letter}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Account tabs — gated individually so Downloads never disappears */}
          {activeTab !== "downloads" && (
            <div
              role="tabpanel"
              id={`library-tabpanel-${activeTab}`}
              aria-labelledby={`library-tab-${activeTab}`}
              className="animate-fade-in"
            >
              {!isOnline ? (
                <EmptyState icon={WifiOff} title="You’re offline" />
              ) : authLoading || (user && loading) ? (
                <PageSkeleton />
              ) : !user ? (
                <div className="rounded-2xl border border-neutral-200 bg-gradient-to-b from-neutral-50/70 to-white p-6 shadow-sm sm:p-8">
                  <div className="max-w-md">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/10 bg-accent/[0.06] text-accent">
                      <Disc size={24} />
                    </div>
                    <h2 className="mt-4 text-lg font-bold tracking-tight text-neutral-900">
                      Sign in to see your library
                    </h2>
                    <Link href="/auth" className="btn-primary mt-4 px-4.5 text-xs">
                      <LogIn size={14} /> Sign In
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  {/* Liked songs */}
                  {activeTab === "saved" && (
                    <div>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div className="min-w-0">
                          <h2 className="section-title">Liked songs</h2>
                          {savedSongs.length > 0 && (
                            <p className="mt-0.5 text-xs font-medium text-neutral-500">
                              {filteredSavedSongs.length} of {savedSongs.length}{" "}
                              {savedSongs.length === 1 ? "song" : "songs"}
                            </p>
                          )}
                        </div>
                        {savedSongs.length > 0 && (
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveSong(savedQueue[0], savedQueue)}
                              className="btn-primary min-h-9 px-3.5 py-1.5 text-xs"
                            >
                              <Play size={11} fill="currentColor" />
                              Play all
                            </button>
                            <ActionMenu
                              label="More liked-song actions"
                              triggerTitle="More liked-song options"
                              align="left"
                            >
                              {({ close }) => (
                                <button
                                  type="button"
                                  onClick={() => {
                                    close();
                                    playShuffled(savedQueue);
                                  }}
                                  className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                                >
                                  <Shuffle size={15} aria-hidden="true" />
                                  Shuffle all
                                </button>
                              )}
                            </ActionMenu>
                          </div>
                        )}
                      </div>

                      {savedSongs.length > 0 && (
                        <div className="search-field mt-3 flex h-10 items-center gap-2 rounded-xl border border-neutral-200/80 bg-neutral-50 px-3 text-neutral-500 transition focus-within:border-neutral-300 focus-within:bg-white">
                          <Search size={14} className="shrink-0 text-neutral-400" />
                          <input
                            type="text"
                            value={likedQuery}
                            onChange={(e) => setLikedQuery(e.target.value)}
                            placeholder="Search liked songs…"
                            aria-label="Search liked songs"
                            autoComplete="off"
                            className="w-full min-w-0 bg-transparent text-sm font-medium text-neutral-900 outline-none placeholder:text-neutral-400"
                          />
                          {likedQuery && (
                            <button
                              type="button"
                              onClick={() => setLikedQuery("")}
                              aria-label="Clear search"
                              className="tap-sm flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-200"
                            >
                              <X size={11} strokeWidth={3} />
                            </button>
                          )}
                        </div>
                      )}

                      {savedSongs.length === 0 ? (
                        <EmptyState
                          icon={Heart}
                          title="No liked songs yet"
                          action={
                            <Link href="/songs" className="btn-primary min-h-9 px-4 py-2 text-xs">
                              Discover songs
                            </Link>
                          }
                        />
                      ) : filteredSavedSongs.length === 0 ? (
                        <EmptyState
                          compact
                          icon={Search}
                          title="No matching songs"
                          action={
                            <button
                              type="button"
                              onClick={() => setLikedQuery("")}
                              className="btn-tertiary min-h-9 text-xs"
                            >
                              Clear search
                            </button>
                          }
                        />
                      ) : (
                        <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                          {Object.keys(groupedSaved).sort().map((letter, groupIndex) => (
                            <section
                              key={letter}
                              className={groupIndex > 0 ? "border-t border-neutral-100" : ""}
                            >
                              <div className="flex items-center gap-2 bg-neutral-50/80 px-3.5 py-1.5">
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-accent/10 bg-accent/[0.06] text-xs font-bold text-accent">
                                  {letter}
                                </span>
                                <span className="text-xs font-semibold text-neutral-400">
                                  {groupedSaved[letter].length}{" "}
                                  {groupedSaved[letter].length === 1 ? "song" : "songs"}
                                </span>
                              </div>
                              <div className="divide-y divide-neutral-100">
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
                            </section>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Standouts — top, picks, and highlights */}
                  {activeTab === "standouts" && (
                    <div>
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <div className="relative inline-flex max-w-full min-w-0">
                          <div
                            ref={standoutsTablistRef}
                            role="tablist"
                            aria-label="Standouts views"
                            onScroll={measureTabs}
                            className="inline-flex w-auto max-w-full flex-nowrap items-center gap-0.5 overflow-x-auto rounded-full border border-neutral-200 bg-neutral-50 p-0.5 no-scrollbar"
                          >
                          {standoutsTabs.map((tab, idx) => {
                            const isActive = standoutsSubTab === tab.key;
                            return (
                              <button
                                key={tab.key}
                                ref={(node) => {
                                  standoutsTabRefs.current[idx] = node;
                                }}
                                type="button"
                                role="tab"
                                id={`standouts-tab-${tab.key}`}
                                aria-selected={isActive}
                                aria-controls={`standouts-tabpanel-${tab.key}`}
                                tabIndex={isActive ? 0 : -1}
                                onClick={() => {
                                  setStandoutsSubTab(tab.key);
                                  markStandoutsSubTabSeen(tab.key);
                                }}
                                onKeyDown={(e) => handleStandoutsTabKeyDown(e, idx)}
                                className={`flex shrink-0 items-center justify-center gap-1 rounded-full px-2 py-1.5 text-[11px] font-semibold whitespace-nowrap transition sm:flex-none ${
                                  isActive
                                    ? "bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200/70"
                                    : "text-neutral-500 hover:bg-white/60 hover:text-neutral-900"
                                }`}
                              >
                                <tab.icon size={13} className="shrink-0" aria-hidden="true" />
                                <span>{tab.label}</span>
                              </button>
                            );
                          })}
                          </div>

                          <div
                            aria-hidden="true"
                            className={`pointer-events-none absolute inset-y-0.5 left-0.5 w-6 rounded-l-full bg-gradient-to-r from-neutral-50 to-transparent transition-opacity ${
                              standoutsTabsOverflow.left ? "opacity-100" : "opacity-0"
                            }`}
                          />
                          <div
                            aria-hidden="true"
                            className={`pointer-events-none absolute inset-y-0.5 right-0.5 w-6 rounded-r-full bg-gradient-to-l from-neutral-50 to-transparent transition-opacity ${
                              standoutsTabsOverflow.right ? "opacity-100" : "opacity-0"
                            }`}
                          />
                          {standoutsTabsOverflow.right && (
                            <p className="absolute left-0 top-full mt-1 whitespace-nowrap text-[10px] font-medium text-neutral-400">
                              Swipe for more views
                            </p>
                          )}
                        </div>
                        <ActionMenu
                          label="Standouts alert settings"
                          triggerTitle="More Standouts options"
                          className="ml-auto"
                        >
                          {({ close }) => <StandoutsNudgeSettings onDone={close} />}
                        </ActionMenu>
                      </div>
                    {/* Most listened — this user's top 10 by play count */}
                    {standoutsSubTab === "top" && (
                      <div
                        role="tabpanel"
                        id="standouts-tabpanel-top"
                        aria-labelledby="standouts-tab-top"
                      >
                        {topSongs.length > 0 ? (
                          <>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                              <div className="min-w-0">
                                <h2 className="section-title">Your most played</h2>
                              </div>
                              <button
                                type="button"
                                onClick={() => setActiveSong(topSongs[0], topSongs)}
                                className="btn-primary min-h-9 shrink-0 px-3.5 py-1.5 text-xs"
                              >
                                <Play size={11} fill="currentColor" />
                                Play Top 10
                              </button>
                            </div>

                            <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                              <div className="divide-y divide-neutral-100">
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
                                    className="group flex w-full cursor-pointer items-center gap-3 px-3.5 py-2.5 text-left transition-colors duration-150 hover:bg-neutral-50 active:bg-neutral-100"
                                  >
                                    <span
                                      className={`w-5 shrink-0 text-center text-xs font-bold tabular-nums ${
                                        idx < 3 ? "text-accent" : "text-neutral-400"
                                      }`}
                                    >
                                      {String(idx + 1).padStart(2, "0")}
                                    </span>
                                    <SongAvatar title={song.title} size="row" variant="mono" />
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-semibold tracking-tight text-neutral-900">
                                        {song.title}
                                      </p>
                                      <p className="mt-0.5 truncate text-xs font-medium text-neutral-400">
                                        {song.author}
                                      </p>
                                    </div>
                                    {song.playCount > 0 && (
                                      <span className="hidden shrink-0 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-semibold text-neutral-500 sm:inline">
                                        {song.playCount} {song.playCount === 1 ? "play" : "plays"}
                                      </span>
                                    )}
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition-colors group-hover:bg-accent group-hover:text-white">
                                      <Play size={12} fill="currentColor" className="ml-0.5" />
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        ) : (
                          <EmptyState
                            icon={Trophy}
                            title="No plays counted yet"
                            action={
                              <Link href="/songs" className="btn-primary min-h-9 px-4 py-2 text-xs">
                                Discover songs
                              </Link>
                            }
                          />
                        )}
                      </div>
                    )}
                    {/* Picks — one shareable song per period */}
                    {standoutsSubTab === "picks" && (
                      <div
                        role="tabpanel"
                        id="standouts-tabpanel-picks"
                        aria-labelledby="standouts-tab-picks"
                      >
                        <h2 className="section-title">Your picks</h2>

                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {PICK_PERIODS.map((period) => {
                            const pick = picksByPeriod[period.key];
                            const feedback =
                              shareFeedback?.key === `pick-${period.key}`
                                ? shareFeedback.message
                                : "";
                            return (
                              <div
                                key={period.key}
                                className={`flex flex-col rounded-2xl border p-3.5 shadow-sm ${
                                  pick
                                    ? "border-neutral-200 bg-white"
                                    : "border-dashed border-neutral-200 bg-neutral-50/40"
                                }`}
                              >
                                <div className="flex min-w-0 items-start justify-between gap-2">
                                  <div className="flex min-w-0 items-center gap-2.5">
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent/10 bg-accent/[0.06] text-accent">
                                      <CalendarDays size={15} />
                                    </span>
                                    <div className="min-w-0">
                                      <h3 className="truncate text-sm font-bold tracking-tight text-neutral-900">
                                        {period.heading}
                                      </h3>
                                      <p className="text-xs font-medium text-neutral-500">
                                        {period.range}
                                      </p>
                                    </div>
                                  </div>
                                  {pick && (
                                    <ActionMenu
                                      label={`More actions for ${period.heading} pick`}
                                      triggerTitle="More pick options"
                                      className="shrink-0"
                                    >
                                      {({ close }) => (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              close();
                                              setPickerPeriod(period.key);
                                            }}
                                            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                                          >
                                            <Pencil size={15} aria-hidden="true" />
                                            Change pick
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              close();
                                              removePick(period.key, pick.song);
                                            }}
                                            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-red-600 transition hover:bg-red-50"
                                          >
                                            <Trash2 size={15} aria-hidden="true" />
                                            Remove pick
                                          </button>
                                        </>
                                      )}
                                    </ActionMenu>
                                  )}
                                </div>

                                {pick ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setActiveSong(pick.song, picksQueue)}
                                      className="mt-3 flex min-w-0 items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50/60 p-2 text-left transition hover:border-neutral-200 hover:bg-neutral-50"
                                    >
                                      <SongAvatar
                                        title={pick.song.title}
                                        size="row"
                                        variant="mono"
                                      />
                                      <span className="min-w-0 flex-1">
                                        <span
                                          title={pick.song.title}
                                          className="block truncate text-sm font-semibold tracking-tight text-neutral-900"
                                        >
                                          {pick.song.title}
                                        </span>
                                        <span className="mt-0.5 block truncate text-xs font-medium text-neutral-400">
                                          {pick.song.author}
                                        </span>
                                      </span>
                                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white transition hover:bg-accent/90">
                                        <Play size={12} fill="currentColor" className="ml-0.5" />
                                      </span>
                                    </button>

                                    <div className="mt-2.5 flex justify-end">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleShare(
                                            "pick",
                                            period.key,
                                            pick.song,
                                            period.heading
                                          )
                                        }
                                        className="btn-primary min-h-9 gap-1.5 px-3.5 py-1.5 text-xs"
                                      >
                                        <Share2 size={13} />
                                        {feedback || "Share pick"}
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setPickerPeriod(period.key)}
                                    className="mt-3 flex min-h-[68px] w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-neutral-200 bg-white/70 px-3 py-3 text-center transition hover:border-accent/40 hover:bg-white"
                                  >
                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
                                      <Plus size={14} />
                                    </span>
                                    <span className="text-xs font-semibold text-neutral-700">
                                      Choose a song
                                    </span>
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {/* Highlights — automatic leaders ranked by play count */}
                    {standoutsSubTab === "highlights" && (
                      <div
                        role="tabpanel"
                        id="standouts-tabpanel-highlights"
                        aria-labelledby="standouts-tab-highlights"
                      >
                        <h2 className="section-title">Your highlights</h2>

                        {highlightsLoading ? (
                          <div className="mt-4">
                            <PageSkeleton />
                          </div>
                        ) : (
                          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {highlights.map((item) => {
                              const feedback =
                                shareFeedback?.key === `highlight-${item.key}`
                                  ? shareFeedback.message
                                  : "";
                              return (
                                <div
                                  key={item.key}
                                  className={`flex flex-col rounded-2xl border p-3.5 shadow-sm ${
                                    item.song
                                      ? "border-neutral-200 bg-white"
                                      : "border-dashed border-neutral-200 bg-neutral-50/40"
                                  }`}
                                >
                                  <div className="flex min-w-0 items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <h3 className="text-sm font-bold tracking-tight text-neutral-900">
                                        {item.heading}
                                      </h3>
                                      <p className="mt-0.5 text-xs font-medium text-neutral-500">
                                        {item.range}
                                      </p>
                                    </div>
                                    {item.song && (
                                      <span className="shrink-0 rounded-full bg-accent/[0.06] px-2 py-0.5 text-xs font-bold text-accent">
                                        {item.plays} {item.plays === 1 ? "play" : "plays"}
                                      </span>
                                    )}
                                  </div>

                                  {item.song ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setActiveSong(item.song, highlightQueue)
                                        }
                                        className="mt-3 flex min-w-0 items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50/60 p-2 text-left transition hover:border-neutral-200 hover:bg-neutral-50"
                                      >
                                        <SongAvatar
                                          title={item.song.title}
                                          size="row"
                                          variant="mono"
                                        />
                                        <span className="min-w-0 flex-1">
                                          <span
                                            title={item.song.title}
                                            className="block truncate text-sm font-semibold tracking-tight text-neutral-900"
                                          >
                                            {item.song.title}
                                          </span>
                                          <span className="mt-0.5 block truncate text-xs font-medium text-neutral-400">
                                            {item.song.author}
                                          </span>
                                        </span>
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white transition hover:bg-accent/90">
                                          <Play size={12} fill="currentColor" className="ml-0.5" />
                                        </span>
                                      </button>
                                      <div className="mt-2.5 flex justify-end">
                                        <ActionMenu
                                          label={`More actions for ${item.heading} highlight`}
                                          triggerTitle="More highlight options"
                                        >
                                          {({ close }) => (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                close();
                                                handleShare(
                                                  "highlight",
                                                  item.key,
                                                  item.song,
                                                  item.heading
                                                );
                                              }}
                                              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                                            >
                                              <Share2 size={15} aria-hidden="true" />
                                              {feedback || "Share highlight"}
                                            </button>
                                          )}
                                        </ActionMenu>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="mt-3 flex flex-1 flex-col items-center justify-center py-6 text-center">
                                      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-400">
                                        <Award size={18} />
                                      </span>
                                      <p className="mt-2 text-xs font-semibold text-neutral-700">
                                        {item.empty}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {highlightsFallback && !highlightsLoading && (
                          <p className="mt-3 text-xs font-medium text-neutral-400">
                            Play history is unavailable.
                          </p>
                        )}
                      </div>
                    )}
                    </div>
                  )}

                  {/* Playlists */}
                  {activeTab === "playlists" && (
                    <div>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div className="min-w-0">
                          <h2 className="section-title">Playlists</h2>
                          {playlists.length > 0 && (
                            <p className="mt-0.5 text-xs font-medium text-neutral-500">
                              {playlists.length} {playlists.length === 1 ? "collection" : "collections"}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowCreate(!showCreate)}
                          className="btn-primary min-h-9 shrink-0 px-3.5 py-1.5 text-xs"
                        >
                          <Plus size={13} />
                          New Playlist
                        </button>
                      </div>

                      {showCreate && (
                        <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center">
                          <input
                            type="text"
                            placeholder="Playlist name..."
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && createPlaylist()}
                            className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm font-medium outline-none transition placeholder:text-neutral-400 focus:border-accent/40 focus:bg-white"
                            autoFocus
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={createPlaylist}
                              disabled={!newName.trim()}
                              className="btn-primary min-h-9 flex-1 px-4 py-2 text-xs sm:flex-none"
                            >
                              Create
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowCreate(false);
                                setNewName("");
                              }}
                              className="btn-tertiary min-h-9 px-3 py-2 text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {playlists.length === 0 ? (
                        <EmptyState icon={ListMusic} title="No playlists yet" />
                      ) : (
                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {playlists.map((pl) => {
                            const trackCount = playlistCounts[pl.id] ?? 0;
                            const created = pl.created_at
                              ? new Date(pl.created_at).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                })
                              : null;
                            return (
                              <div
                                key={pl.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => router.push(`/playlists/${pl.id}`)}
                                onKeyDown={(event) => {
                                  if (event.target !== event.currentTarget) return;
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    router.push(`/playlists/${pl.id}`);
                                  }
                                }}
                                className="group relative flex cursor-pointer items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-3.5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md"
                              >
                                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-accent/10 bg-accent/[0.06] text-accent">
                                  <ListMusic size={20} />
                                  <span className="absolute bottom-0 right-0 rounded-tl-lg bg-white/95 px-1.5 py-0.5 text-xs font-bold tabular-nums text-neutral-600 shadow-sm">
                                    {trackCount}
                                  </span>
                                </div>
                                <div className="min-w-0 flex-1 pt-0.5">
                                  <h3 className="truncate text-sm font-semibold tracking-tight text-neutral-900">
                                    {pl.name}
                                  </h3>
                                  <p className="mt-0.5 truncate text-xs font-medium text-neutral-500">
                                    {trackCount === 1 ? "1 song" : `${trackCount} songs`}
                                    {created && <span aria-hidden="true"> · Created {created}</span>}
                                  </p>
                                </div>
                                <ActionMenu
                                  label={`More options for ${pl.name}`}
                                  triggerTitle="More playlist options"
                                  className="shrink-0"
                                >
                                  {({ close }) => (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          close();
                                          router.push(`/playlists/${pl.id}`);
                                        }}
                                        className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                                      >
                                        <ExternalLink size={15} className="text-neutral-400" />
                                        Open playlist
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          close();
                                          setRenamingPlaylist(pl);
                                        }}
                                        className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                                      >
                                        <Pencil size={15} className="text-neutral-400" />
                                        Rename playlist
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          close();
                                          setDeletingPlaylist(pl);
                                        }}
                                        className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-red-600 transition hover:bg-red-50"
                                      >
                                        <Trash2 size={15} />
                                        Delete playlist
                                      </button>
                                    </>
                                  )}
                                </ActionMenu>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <PickSongDialog
          key={pickerPeriod || "pick-closed"}
          open={Boolean(pickerPeriod)}
          heading={
            PICK_PERIODS.find((period) => period.key === pickerPeriod)?.heading ||
            "Choose a song"
          }
          songs={allSongs}
          saving={pickSaving}
          selectedSongId={picksByPeriod[pickerPeriod]?.song_id}
          onSelect={savePick}
          onClose={() => setPickerPeriod(null)}
        />

        <PlaylistNameDialog
          key={renamingPlaylist?.id || "rename-closed"}
          isOpen={Boolean(renamingPlaylist)}
          title="Rename playlist"
          initialValue={renamingPlaylist?.name || ""}
          confirmLabel="Save name"
          busy={playlistBusy}
          onConfirm={renamePlaylist}
          onClose={() => setRenamingPlaylist(null)}
        />

        <ConfirmModal
          isOpen={Boolean(deletingPlaylist)}
          title={`Delete “${deletingPlaylist?.name || "playlist"}”?`}
          message="This removes the playlist and its song list. Your liked songs and downloads stay."
          details={{
            removed: [
              `The playlist${deletingPlaylist ? ` (${playlistCounts[deletingPlaylist.id] ?? 0} songs)` : ""}`,
            ],
            kept: ["Liked songs", "Downloads", "Standouts picks and history"],
          }}
          confirmLabel="Delete playlist"
          busy={playlistBusy}
          onConfirm={confirmDeletePlaylist}
          onClose={() => setDeletingPlaylist(null)}
        />

        {undoToast && (
          <UndoToast
            key={undoToast.id}
            expiresAt={undoToast.expiresAt}
            message={undoToast.message}
            onAction={applyUndo}
            onDismiss={dismissUndo}
          />
        )}
      </div>
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[90vh] bg-white px-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3 sm:px-6 md:px-8 md:pt-5">
          <div className="mx-auto max-w-5xl"><PageSkeleton /></div>
        </div>
      }
    >
      <LibraryContent />
    </Suspense>
  );
}
