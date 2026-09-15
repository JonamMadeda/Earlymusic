"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getAudioPublicUrl } from "@/lib/audioUrl";
import { verifyAudioUrl, summarizeHealth } from "@/lib/audioHealth";
import { useRouter } from "next/navigation";
import {
  Trash2,
  Upload,
  ArrowLeft,
  ShieldCheck,
  Music,
  Search,
  Edit3,
  FileUp,
  ChevronDown,
  Activity,
  Play,
  HardDrive,
  X,
} from "lucide-react";
import EditModal from "../components/EditModal";
import ReplaceAudioModal from "../components/ReplaceAudioModal";
import ConfirmModal from "../components/ConfirmModal";

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
};
import { usePlayer } from "../context/PlayerContext";
import { useAuth } from "../context/AuthContext";
import SongAvatar from "@/app/components/SongAvatar";

export default function AdminDashboard() {
  const { allSongs, setAllSongs, activeSong, setActiveSong } = usePlayer();
  const { user, loading: authLoading, isAdmin, roleLoading } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [isGrantingAdmin, setIsGrantingAdmin] = useState(false);
  const [adminMessage, setAdminMessage] = useState("");
  const [health, setHealth] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkDuration, setBulkDuration] = useState("");
  const [bulkOp, setBulkOp] = useState(null);
  const [bulkMessage, setBulkMessage] = useState("");
  const [adminCategory, setAdminCategory] = useState("All");
  const [adminSort, setAdminSort] = useState("title-az");
  const [confirmState, setConfirmState] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [storage, setStorage] = useState(null);
  const [cleaning, setCleaning] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const toastTimerRef = useRef(null);
  const verifyRunningRef = useRef(false);
  const verifyCancelRef = useRef(false);
  const bulkCancelRef = useRef(false);

  // Edit State
  const [editModalSong, setEditModalSong] = useState(null);
  const [replaceSong, setReplaceSong] = useState(null);

  const router = useRouter();
  const handleLogout = () => {
    supabase.auth.signOut().finally(() => router.replace("/"));
  };

  useEffect(() => {
    if (!authLoading && !roleLoading && isAdmin) {
      fetchSongs();
      fetchAdmins();
    }
  }, [authLoading, roleLoading, isAdmin]);

  const fetchAdmins = async () => {
    try {
      setAdminsLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) return;
      const response = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error("Unable to list administrators.");
      const body = await response.json();
      setAdmins(body.admins || []);
    } catch (error) {
      console.error("Unable to list administrators:", error);
    } finally {
      setAdminsLoading(false);
    }
  };

  const requestRevoke = (entry) => {
    setConfirmState({
      title: "Revoke administrator?",
      message: `${entry.email} will immediately lose access to the Vault, uploads, and admin tools.`,
      confirmLabel: "Revoke",
      run: async () => {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData.session?.access_token;
          if (!accessToken) throw new Error("Sign in again before changing administrator access.");
          const response = await fetch("/api/admin/users", {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ user_id: entry.user_id }),
          });
          let body = {};
          try {
            body = await response.json();
          } catch {}
          if (!response.ok) throw new Error(body.error || "Unable to revoke administrator access.");
          showToast(`Revoked access for ${entry.email}.`);
          fetchAdmins();
        } catch (error) {
          showToast(error.message || "Unable to revoke administrator access.", "error");
        }
      },
    });
  };

  const fetchSongs = async () => {
    try {
      const { data, error } = await supabase
        .from("songs")
        .select("*")
        .order("title", { ascending: true });
      if (error) throw error;
      if (data) {
        setAllSongs(data);
        // Fresh list invalidates any previous verification results.
        setHealth(null);
      }
    } catch (error) {
      console.error("Unable to load songs:", error);
    }
  };

  const handleEditClick = (song) => {
    setEditModalSong(song);
  };

  const showToast = (message, tone = "dark") => {
    clearTimeout(toastTimerRef.current);
    setToast({ message, tone, key: Date.now() });
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  };

  const runConfirmed = async () => {
    const action = confirmState;
    if (!action || confirmBusy) return;
    setConfirmBusy(true);
    setConfirmState(null);
    try {
      await action.run();
    } finally {
      setConfirmBusy(false);
    }
  };

  const requestDelete = (song) => {
    setConfirmState({
      title: "Delete this track?",
      message: `“${song.title}” will be permanently removed from the library and its audio file deleted.`,
      confirmLabel: "Delete",
      run: async () => {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData.session?.access_token;
          if (!accessToken) throw new Error("Sign in again before deleting songs.");

          const response = await fetch(`/api/admin/songs/${song.id}`, {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ songPath: song.song_path }),
          });
          if (!response.ok) {
            let message = "Deletion failed.";
            try {
              const body = await response.json();
              message = body.error || message;
            } catch {}
            throw new Error(message);
          }

          // Update local state without redirecting
          setAllSongs((prev) => prev.filter((s) => s.id !== song.id));
          setSelectedIds((prev) => prev.filter((sid) => sid !== song.id));
          setHealth(null);
          showToast(`Deleted “${song.title}”.`);
        } catch (err) {
          console.error(err);
          showToast(err.message || "Deletion failed.", "error");
        }
      },
    });
  };

  const handleGrantAdmin = async (event) => {
    event.preventDefault();
    setAdminMessage("");
    setIsGrantingAdmin(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Sign in again before changing administrator access.");

const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ email: adminEmail }),
      });
      let body = {};
      try {
        body = await response.json();
      } catch {}
      if (!response.ok) throw new Error(body.error || "Unable to grant administrator access.");

      setAdminMessage(`${body.email} is now an administrator.`);
      setAdminEmail("");
      fetchAdmins();
    } catch (error) {
      setAdminMessage(error.message || "Unable to grant administrator access.");
    } finally {
      setIsGrantingAdmin(false);
    }
  };

  // One-click audio health check: HEAD/1-byte-range each track's file with a
  // small worker pool, reporting progress. Results are keyed by song id.
  // "Broken" = storage answered with a failing status (definitive).
  // "Unreachable" = this browser couldn't reach storage (network/CORS) —
  // not proof the file is bad.
  const verifyAllAudio = async () => {
    const list = allSongs || [];
    if (list.length === 0 || verifyRunningRef.current) return;
    verifyRunningRef.current = true;
    verifyCancelRef.current = false;

    const results = {};
    setHealth({ checking: true, done: 0, total: list.length, results });

    let next = 0;
    const checkOne = async (song) => {
      try {
        const url = getAudioPublicUrl(song.song_path);
        return await verifyAudioUrl(url);
      } catch {
        return { ok: false, status: null, error: "network" };
      }
    };
    const worker = async () => {
      while (next < list.length && !verifyCancelRef.current) {
        const song = list[next++];
        results[song.id] = await checkOne(song);
        setHealth({ checking: true, done: Object.keys(results).length, total: list.length, results: { ...results } });
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));

    verifyRunningRef.current = false;
    setHealth((prev) => (prev ? { ...prev, checking: false } : prev));
  };

  const fetchStorage = async () => {
    try {
      setStorage((prev) => ({ ...(prev || {}), loading: true }));
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Sign in again to view storage.");
      const response = await fetch("/api/admin/storage/stats", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      let body = {};
      try {
        body = await response.json();
      } catch {}
      if (!response.ok) throw new Error(body.error || "Unable to read storage stats.");
      setStorage({ loading: false, ...body });
    } catch (error) {
      console.error(error);
      setStorage((prev) => ({ ...(prev || {}), loading: false }));
      showToast(error.message || "Unable to read storage stats.", "error");
    }
  };

  const requestCleanOrphans = () => {
    const count = storage?.orphans?.length || 0;
    if (count === 0 || cleaning) return;
    setConfirmState({
      title: `Delete ${count} orphaned file${count === 1 ? "" : "s"}?`,
      message: "These audio files are stored on R2 but linked to no track. This cannot be undone.",
      confirmLabel: "Delete files",
      run: async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) {
          showToast("Sign in again before cleaning storage.", "error");
          return;
        }
        const urls = [...(storage.orphans || [])];
        let removed = 0;
        for (let i = 0; i < urls.length; i++) {
          setCleaning({ done: i, total: urls.length });
          try {
            const response = await fetch("/api/admin/storage", {
              method: "DELETE",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({ publicStorageUrl: urls[i] }),
            });
            if (response.ok) removed += 1;
          } catch (err) {
            console.error(err);
          }
        }
        setCleaning(null);
        showToast(`Removed ${removed} of ${urls.length} orphaned files.`);
        fetchStorage();
      },
    });
  };

  const toggleSelect = (id) => {
    setBulkMessage("");
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const requestBulkDelete = () => {
    if (selectedIds.length === 0 || bulkOp) return;
    const count = selectedIds.length;
    setConfirmState({
      title: `Delete ${count} track${count === 1 ? "" : "s"}?`,
      message: "Selected tracks will be permanently removed from the library and their audio files deleted.",
      confirmLabel: "Delete all",
      run: runBulkDelete,
    });
  };

  const runBulkDelete = async () => {

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setBulkMessage("Sign in again before deleting songs.");
      return;
    }

    const byId = new Map((allSongs || []).map((s) => [s.id, s]));
    const ids = [...selectedIds];
    const failed = [];
    const deleted = [];
    bulkCancelRef.current = false;

    for (let i = 0; i < ids.length; i++) {
      if (bulkCancelRef.current) break;
      setBulkOp({ action: "Deleting", done: i, total: ids.length });
      const song = byId.get(ids[i]);
      try {
        const response = await fetch(`/api/admin/songs/${ids[i]}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ songPath: song?.song_path }),
        });
        if (!response.ok) throw new Error("Deletion failed.");
        deleted.push(ids[i]);
      } catch (err) {
        console.error(err);
        failed.push(song?.title || `ID ${ids[i]}`);
      }
    }

    setBulkOp(null);
    if (deleted.length > 0) {
      setAllSongs((prev) => prev.filter((s) => !deleted.includes(s.id)));
      setHealth(null);
    }
    setSelectedIds((prev) => prev.filter((id) => !deleted.includes(id)));
    if (bulkCancelRef.current) {
      setBulkMessage(`Stopped. Deleted ${deleted.length} of ${ids.length}.`);
    } else if (failed.length === 0) {
      setBulkMessage(`Deleted ${deleted.length} track${deleted.length === 1 ? "" : "s"}.`);
    } else {
      setBulkMessage(
        `Deleted ${deleted.length}, failed ${failed.length}: ${failed.slice(0, 3).join(", ")}${failed.length > 3 ? "…" : ""}`
      );
    }
  };

  const bulkApply = async () => {
    if (selectedIds.length === 0 || bulkOp) return;
    const patch = {};
    if (bulkCategory) patch.category = bulkCategory;
    if (bulkDuration) patch.duration = bulkDuration;
    if (Object.keys(patch).length === 0) {
      setBulkMessage("Choose a category or duration to apply.");
      return;
    }

    setBulkOp({ action: "Updating", done: 0, total: selectedIds.length });
    try {
      const { error } = await supabase.from("songs").update(patch).in("id", selectedIds);
      if (error) throw error;
      setAllSongs((prev) =>
        prev.map((s) => (selectedIds.includes(s.id) ? { ...s, ...patch } : s))
      );
      localStorage.removeItem("lumbo_songs_cache");
      setBulkMessage(`Updated ${selectedIds.length} track${selectedIds.length === 1 ? "" : "s"}.`);
      setSelectedIds([]);
      setBulkCategory("");
      setBulkDuration("");
    } catch (err) {
      console.error(err);
      setBulkMessage("Bulk update failed.");
    } finally {
      setBulkOp(null);
    }
  };

  const groupedSongs = useMemo(() => {
    const filtered = (allSongs || [])
      .filter(
        (s) =>
          (s.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.author || "").toLowerCase().includes(searchQuery.toLowerCase())
      )
      .filter((s) =>
        adminCategory === "All" ? true : (s.category || "Worship") === adminCategory
      );

    const sorted = [...filtered].sort((a, b) => {
      if (adminSort === "author-az") {
        return (a.author || "").localeCompare(b.author || "");
      }
      if (adminSort === "newest") {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }
      if (adminSort === "title-za") {
        return (b.title || "").localeCompare(a.title || "");
      }
      return (a.title || "").localeCompare(b.title || "");
    });

    return sorted.reduce((groups, song) => {
      const letter = song.title?.[0]?.toUpperCase() || "#";
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(song);
      return groups;
    }, {});
  }, [allSongs, searchQuery, adminCategory, adminSort]);

  const alphabet = Object.keys(groupedSongs).sort();

  const visibleIds = useMemo(
    () => Object.values(groupedSongs).flat().map((s) => s.id),
    [groupedSongs]
  );

  // Compute stats — placed before early returns to keep hook order consistent
  const stats = useMemo(() => {
    const songs = allSongs || [];
    const artists = new Set(songs.map((s) => s.author?.toLowerCase().trim()).filter(Boolean));
    const categories = new Set(songs.map((s) => s.category || "Worship"));
    const recent = songs.filter((s) => s.created_at && Date.now() - new Date(s.created_at).getTime() < 30 * 24 * 60 * 60 * 1000);
    return { total: songs.length, artists: artists.size, categories: categories.size, recent: recent.length };
  }, [allSongs]);

  const healthSummary = useMemo(() => summarizeHealth(health?.results), [health]);

  if (authLoading || roleLoading) {
    return <main className="flex min-h-[90vh] items-center justify-center bg-neutral-50/60">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </main>;
  }

  if (!user || !isAdmin) {
    return (
      <main className="flex min-h-[90vh] items-center justify-center bg-neutral-50/60 px-6">
        <section className="max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <ShieldCheck className="mx-auto mb-4 text-neutral-400" size={32} />
          <h1 className="text-xl font-bold text-neutral-900">Administrator access required</h1>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500">Sign in with an account assigned the administrator role to manage the music library.</p>
          <button onClick={() => router.push(user ? "/" : "/auth?redirectTo=/admin")} className="mt-6 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accent/90">
            {user ? "Return home" : "Sign in"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-[90vh] bg-neutral-50/60 px-3 pb-36 pt-2 md:px-8 md:pt-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-neutral-900 md:text-2xl">Vault</h1>
              <span className="hidden md:inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[11px] font-medium text-neutral-400">
                {stats.total} tracks
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-neutral-200/80 bg-white px-3.5 py-2 text-[11px] font-semibold text-neutral-500 transition hover:bg-neutral-50"
            >
              <ArrowLeft size={12} /> Sign Out
            </button>
            <button
              onClick={() => router.push("/upload")}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-accent/90 active:scale-95"
            >
              <Upload size={15} strokeWidth={2.5} /> Upload
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold tracking-tight text-neutral-900">{stats.total}</p>
            <p className="text-[11px] font-medium text-neutral-400">Tracks</p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold tracking-tight text-neutral-900">{stats.artists}</p>
            <p className="text-[11px] font-medium text-neutral-400">Artists</p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold tracking-tight text-neutral-900">{stats.categories}</p>
            <p className="text-[11px] font-medium text-neutral-400">Categories</p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold tracking-tight text-neutral-900">{stats.recent}</p>
            <p className="text-[11px] font-medium text-neutral-400">Added (30d)</p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-300" size={15} />
            <input
              type="text"
              placeholder="Search tracks or artists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-9 pr-3 text-sm font-medium text-neutral-900 outline-none transition placeholder:text-neutral-300 focus:border-accent"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setBulkMessage("");
              setSelectedIds(selectedIds.length > 0 ? [] : visibleIds);
            }}
            disabled={(allSongs || []).length === 0 || !!bulkOp}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-xs font-bold text-neutral-600 shadow-sm transition hover:border-neutral-300 hover:text-neutral-900 disabled:opacity-50"
          >
            <span>{selectedIds.length > 0 ? `Clear (${selectedIds.length})` : "Select"}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (health?.checking) {
                verifyCancelRef.current = true;
              } else {
                verifyAllAudio();
              }
            }}
            disabled={(allSongs || []).length === 0}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-xs font-bold text-neutral-600 shadow-sm transition hover:border-neutral-300 hover:text-neutral-900 disabled:opacity-50"
            title="Check every track's audio file is reachable"
          >
            <Activity size={14} className={health?.checking ? "animate-pulse text-accent" : "text-accent"} />
            <span>
              {health?.checking ? `Checking ${health.done}/${health.total}…` : "Verify audio"}
            </span>
          </button>
        </div>

        {/* Category + sort */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {["All", "Worship", "Praise"].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setAdminCategory(cat)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                adminCategory === cat
                  ? "border-accent bg-accent text-white shadow-sm"
                  : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
              }`}
            >
              {cat}
            </button>
          ))}
          <select
            value={adminSort}
            onChange={(e) => setAdminSort(e.target.value)}
            aria-label="Sort tracks"
            className="ml-auto rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 outline-none transition focus:border-accent"
          >
            <option value="title-az">Title A–Z</option>
            <option value="title-za">Title Z–A</option>
            <option value="author-az">Artist A–Z</option>
            <option value="newest">Newest first</option>
          </select>
        </div>

        {/* Verification summary */}
        {health && (
          <div className={`mb-6 rounded-xl border p-4 shadow-sm ${healthSummary.broken > 0 ? "border-red-200 bg-red-50/60" : "border-neutral-200 bg-white"}`}>
            {health.checking ? (
              <div className="space-y-2">
                <p className="text-xs font-bold text-neutral-700">
                  Checking audio files… {health.done}/{health.total}
                </p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className="h-full bg-accent transition-all duration-200"
                    style={{ width: `${health.total > 0 ? (health.done / health.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs font-bold text-neutral-800">
                  Audio check complete: {healthSummary.healthy} healthy
                  {healthSummary.broken > 0 && <span className="text-red-600"> · {healthSummary.broken} broken</span>}
                  {healthSummary.unknown > 0 && <span className="text-amber-600"> · {healthSummary.unknown} unreachable</span>}
                </p>
                {healthSummary.broken > 0 && (
                  <p className="mt-1 text-xs text-neutral-500">
                    Broken tracks are flagged inline below with their HTTP status — replace or re-upload those files.
                  </p>
                )}
                {healthSummary.unknown > 0 && (
                  <p className="mt-1 text-xs text-neutral-500">
                    Unreachable means this browser couldn&apos;t contact storage (network or ad-blocker), not that the files are broken. Re-run on a stable connection if unsure.
                  </p>
                )}
                {healthSummary.broken === 0 && healthSummary.unknown === 0 && (
                  <p className="mt-1 text-xs text-neutral-500">Every track&apos;s audio file answered successfully.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bulk result message (visible after the selection clears) */}
        {bulkMessage && selectedIds.length === 0 && !bulkOp && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-xs font-semibold text-neutral-600 shadow-sm">
            <span className="flex-1">{bulkMessage}</span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setBulkMessage("")}
              className="rounded-lg p-1 text-neutral-400 transition hover:text-neutral-900"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Admin access — collapsible */}
        <details className="group mb-6">
          <summary className="flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-xs font-semibold text-neutral-500 shadow-sm transition hover:text-neutral-900 hover:border-neutral-300 list-none [&::-webkit-details-marker]:hidden">
            <ShieldCheck size={14} className="text-accent" />
            <span>Administrator access</span>
            <ChevronDown size={12} className="ml-auto transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs leading-relaxed text-neutral-500">Grant dashboard access to an account that has already signed up.</p>
            <form onSubmit={handleGrantAdmin} className="flex w-full gap-2">
              <input
                type="email"
                value={adminEmail}
                onChange={(event) => setAdminEmail(event.target.value)}
                placeholder="user@example.com"
                required
                disabled={isGrantingAdmin}
                className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:bg-white"
              />
              <button
                type="submit"
                disabled={isGrantingAdmin}
                className="shrink-0 rounded-full bg-accent px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-accent/90 disabled:opacity-50"
              >
                {isGrantingAdmin ? "Granting…" : "Grant"}
              </button>
            </form>
            {adminMessage && <p role="status" className="mt-2 text-xs font-medium text-neutral-600">{adminMessage}</p>}

            <div className="mt-4 border-t border-neutral-100 pt-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Current administrators
              </p>
              {adminsLoading ? (
                <p className="py-2 text-xs text-neutral-400">Loading administrators…</p>
              ) : admins.length === 0 ? (
                <p className="py-2 text-xs text-neutral-400">No administrators found.</p>
              ) : (
                admins.map((entry) => {
                  const isSelf = entry.user_id === user?.id;
                  return (
                    <div key={entry.user_id} className="flex items-center gap-2 border-b border-neutral-50 py-2 last:border-0">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-xs font-bold text-neutral-800">
                          <span className="truncate">{entry.email}</span>
                          {isSelf && (
                            <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-neutral-500">
                              You
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-neutral-400">
                          Since {entry.created_at ? new Date(entry.created_at).toLocaleDateString() : "—"}
                        </p>
                      </div>
                      {!isSelf && (
                        <button
                          type="button"
                          onClick={() => requestRevoke(entry)}
                          className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </details>

        {/* Storage — collapsible */}
        <details className="group mb-6" onToggle={(e) => { if (e.currentTarget.open && !storage && !cleaning) fetchStorage(); }}>
          <summary className="flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-xs font-semibold text-neutral-500 shadow-sm transition hover:text-neutral-900 hover:border-neutral-300 list-none [&::-webkit-details-marker]:hidden">
            <HardDrive size={14} className="text-accent" />
            <span>Storage</span>
            {storage && !storage.loading && typeof storage.totalBytes === "number" && (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-bold text-neutral-500">
                {formatBytes(storage.totalBytes)} · {storage.fileCount} files
              </span>
            )}
            <ChevronDown size={12} className="ml-auto transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            {storage?.loading ? (
              <p className="py-2 text-xs text-neutral-400">Reading storage…</p>
            ) : storage && typeof storage.totalBytes === "number" ? (
              <div className="space-y-2">
                <p className="text-xs leading-relaxed text-neutral-600">
                  <span className="font-bold text-neutral-900">{formatBytes(storage.totalBytes)}</span> across{" "}
                  <span className="font-bold text-neutral-900">{storage.fileCount}</span> files ·{" "}
                  {storage.trackCount} tracks in the library
                  {storage.legacyCount > 0 && <span> · {storage.legacyCount} legacy (non-R2) paths</span>}
                </p>
                {(storage.orphanCount || 0) > 0 ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5">
                    <p className="flex-1 text-xs font-medium text-amber-800">
                      {storage.orphanCount} orphaned file{storage.orphanCount === 1 ? "" : "s"} stored but linked to no track.
                    </p>
                    <button
                      type="button"
                      onClick={requestCleanOrphans}
                      disabled={!!cleaning}
                      className="shrink-0 rounded-full bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-amber-500 disabled:opacity-50"
                    >
                      {cleaning ? `Removing ${cleaning.done + 1}/${cleaning.total}…` : "Delete orphans"}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-neutral-400">No orphaned files — every stored file is linked to a track.</p>
                )}
                <button
                  type="button"
                  onClick={fetchStorage}
                  className="text-xs font-bold text-neutral-400 transition hover:text-neutral-900"
                >
                  Refresh
                </button>
              </div>
            ) : (
              <div>
                <p className="mb-3 text-xs leading-relaxed text-neutral-500">See R2 usage and find files no track uses.</p>
                <button
                  type="button"
                  onClick={fetchStorage}
                  className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-neutral-700"
                >
                  Load storage stats
                </button>
              </div>
            )}
          </div>
        </details>

        {/* Song list */}
        <div className="flex flex-col">
          {/* Column headers — desktop only */}
          <div className="hidden md:grid md:grid-cols-[1fr_180px_120px_96px] gap-4 px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-neutral-300">
            <span>Track</span>
            <span>Artist</span>
            <span>Category</span>
            <span className="text-right">Actions</span>
          </div>

          {alphabet.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-white py-32 shadow-sm text-neutral-200">
              <Music size={48} strokeWidth={1.5} className="mb-4 opacity-20" />
              <p className="text-[13px] font-medium text-neutral-400">No matching tracks found</p>
            </div>
          ) : (
            alphabet.map((letter) => (
              <div key={letter} className="mb-2">
                <div className="sticky top-0 z-10 bg-neutral-50/60 backdrop-blur-sm pb-1 pt-3">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-accent/10 bg-accent/[0.06] text-[10px] font-bold text-accent">{letter}</span>
                </div>
                <div className="flex flex-col gap-y-1">
                  {groupedSongs[letter].map((song, idx) => {
                    const audioResult = health?.results?.[song.id];
                    const audioBad = !!audioResult && !audioResult.ok;
                    return (
                    <div
                      key={song.id}
                      className={`group grid grid-cols-[1fr_auto] md:grid-cols-[1fr_180px_120px_96px] gap-4 items-center rounded-xl border px-2.5 py-2 shadow-sm transition hover:shadow-sm md:px-4 ${
                        selectedIds.includes(song.id)
                          ? "border-accent/50 bg-accent/[0.04] hover:border-accent/60"
                          : audioBad
                            ? "border-red-200 bg-red-50/50 hover:border-red-300"
                            : "border-transparent bg-white hover:border-neutral-200"
                      }`}
                    >
                      {/* Track */}
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(song.id)}
                          onChange={() => toggleSelect(song.id)}
                          aria-label={`Select ${song.title}`}
                          className="h-4 w-4 shrink-0 cursor-pointer accent-accent"
                        />
                        <span className="hidden md:inline text-[12px] font-mono text-neutral-300 w-5 text-right shrink-0">{idx + 1}</span>
                        <SongAvatar title={song.title} size="xs" variant="mono" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-neutral-900 leading-tight">{song.title}</p>
                          <p className="truncate text-[12px] font-medium text-neutral-400 md:hidden">{song.author}</p>
                          {audioBad && (
                            <p className="mt-0.5 inline-block rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                              {audioResult.error === "http"
                                ? `Audio broken (${audioResult.status})`
                                : audioResult.error === "missing"
                                  ? "Audio file missing"
                                  : "Audio unreachable"}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Artist — desktop only */}
                      <span className="hidden md:block truncate text-[13px] font-medium text-neutral-500">{song.author}</span>

                      {/* Category + duration */}
                      <div className="flex items-center gap-1.5">
                        {song.duration && (
                          <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${song.duration === "Short" ? "bg-neutral-900 text-white border-neutral-900" : "bg-white text-neutral-700 border-neutral-300"}`}>
                            {song.duration}
                          </span>
                        )}
                        <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${song.category === "Praise" ? "bg-neutral-800 text-white border-neutral-800" : "bg-neutral-900 text-white border-neutral-900"}`}>
                          {song.category || "Worship"}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setActiveSong(song, allSongs)}
                          className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                            activeSong?.id === song.id
                              ? "bg-accent/10 text-accent"
                              : "text-neutral-400 hover:bg-accent/10 hover:text-accent"
                          }`}
                          title={activeSong?.id === song.id ? "Now playing" : "Preview"}
                        >
                          <Play size={15} fill="currentColor" />
                        </button>
                        <button
                          onClick={() => handleEditClick(song)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-accent/10 hover:text-accent"
                          title="Edit details"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => setReplaceSong(song)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-accent/10 hover:text-accent"
                          title="Replace audio file"
                        >
                          <FileUp size={15} />
                        </button>
                        <button
                          onClick={() => requestDelete(song)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Floating bulk action bar */}
        {selectedIds.length > 0 && (
          <div className="pointer-events-none fixed inset-x-3 bottom-24 z-40 flex justify-center md:bottom-8">
            <div className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-neutral-800 bg-neutral-900 p-3 text-white shadow-xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-1 text-xs font-bold">
                  {selectedIds.length} selected
                </span>
                {bulkOp ? (
                  <>
                    <span className="flex-1 text-xs font-medium text-white/70">
                      {bulkOp.action} {bulkOp.done + 1}/{bulkOp.total}…
                    </span>
                    {bulkOp.action === "Deleting" && (
                      <button
                        type="button"
                        onClick={() => { bulkCancelRef.current = true; }}
                        className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/20"
                      >
                        Stop
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <select
                      value={bulkCategory}
                      onChange={(e) => setBulkCategory(e.target.value)}
                      aria-label="Bulk category"
                      className="rounded-lg border border-white/15 bg-white/10 px-2 py-2 text-xs font-semibold text-white outline-none transition focus:border-white/40 [&>option]:text-neutral-900"
                    >
                      <option value="">Category…</option>
                      <option value="Worship">Worship</option>
                      <option value="Praise">Praise</option>
                    </select>
                    <select
                      value={bulkDuration}
                      onChange={(e) => setBulkDuration(e.target.value)}
                      aria-label="Bulk duration"
                      className="rounded-lg border border-white/15 bg-white/10 px-2 py-2 text-xs font-semibold text-white outline-none transition focus:border-white/40 [&>option]:text-neutral-900"
                    >
                      <option value="">Duration…</option>
                      <option value="Long">Long</option>
                      <option value="Short">Short</option>
                    </select>
                    <button
                      type="button"
                      onClick={bulkApply}
                      className="rounded-lg bg-white px-3.5 py-2 text-xs font-bold text-neutral-900 transition hover:bg-neutral-100 active:scale-95"
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      onClick={requestBulkDelete}
                      className="rounded-lg bg-red-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-red-500 active:scale-95"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      aria-label="Clear selection"
                      onClick={() => { setSelectedIds([]); setBulkMessage(""); }}
                      className="rounded-lg p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  </>
                )}
              </div>
              {bulkOp && (
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full bg-white transition-all duration-200"
                    style={{ width: `${bulkOp.total > 0 ? (bulkOp.done / bulkOp.total) * 100 : 0}%` }}
                  />
                </div>
              )}
              {bulkMessage && !bulkOp && (
                <p className="mt-2 text-xs font-medium text-white/70">{bulkMessage}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div key={toast.key} className="fixed left-1/2 top-4 z-[1100] -translate-x-1/2 animate-fade-in">
          <div className={`rounded-full px-4 py-2.5 text-xs font-semibold text-white shadow-xl ${toast.tone === "error" ? "bg-red-600" : "bg-neutral-900"}`}>
            {toast.message}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmState}
        title={confirmState?.title}
        message={confirmState?.message}
        confirmLabel={confirmState?.confirmLabel}
        busy={confirmBusy}
        onConfirm={runConfirmed}
        onClose={() => { if (!confirmBusy) setConfirmState(null); }}
      />

      <EditModal 
        isOpen={!!editModalSong}
        onClose={() => setEditModalSong(null)}
        song={editModalSong}
        onSuccess={(updatedSong) => {
          setAllSongs((prev) => 
            prev.map(s => s.id === updatedSong.id ? updatedSong : s)
          );
        }}
      />

      <ReplaceAudioModal
        isOpen={!!replaceSong}
        onClose={() => setReplaceSong(null)}
        song={replaceSong}
        onSuccess={(updatedSong) => {
          setAllSongs((prev) =>
            prev.map((s) => s.id === updatedSong.id ? updatedSong : s)
          );
          setHealth(null);
        }}
      />
    </main>
  );
}
