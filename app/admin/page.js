"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import {
  Trash2,
  Upload,
  ArrowLeft,
  ShieldCheck,
  Music,
  Search,
  Edit3,
  ChevronDown,
} from "lucide-react";
import UploadModal from "../components/UploadModal";
import EditModal from "../components/EditModal";
import { usePlayer } from "../context/PlayerContext";
import { useAuth } from "../context/AuthContext";
import SongAvatar from "@/app/components/SongAvatar";

export default function AdminDashboard() {
  const { allSongs, setAllSongs } = usePlayer();
  const { user, loading: authLoading, isAdmin, roleLoading } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [isGrantingAdmin, setIsGrantingAdmin] = useState(false);
  const [adminMessage, setAdminMessage] = useState("");

  // Edit State
  const [editModalSong, setEditModalSong] = useState(null);

  const router = useRouter();
  const handleLogout = () => {
    supabase.auth.signOut().finally(() => router.replace("/"));
  };

  useEffect(() => {
    if (!authLoading && !roleLoading && isAdmin) fetchSongs();
  }, [authLoading, roleLoading, isAdmin]);

  const fetchSongs = async () => {
    const { data } = await supabase
      .from("songs")
      .select("*")
      .order("title", { ascending: true });

    if (data) setAllSongs(data);
  };

  const handleEditClick = (song) => {
    setEditModalSong(song);
  };

  const handleDelete = async (id, path) => {
    const isConfirmed = confirm("Permanently delete this track?");
    if (!isConfirmed) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Sign in again before deleting songs.");

      const response = await fetch(`/api/admin/songs/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ songPath: path }),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "Deletion failed.");
      }

      // Update local state without redirecting
      setAllSongs((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error(err);
      alert("Deletion failed.");
    }
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
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to grant administrator access.");

      setAdminMessage(`${body.email} is now an administrator.`);
      setAdminEmail("");
    } catch (error) {
      setAdminMessage(error.message || "Unable to grant administrator access.");
    } finally {
      setIsGrantingAdmin(false);
    }
  };

  const groupedSongs = useMemo(() => {
    const filtered = (allSongs || []).filter(
      (s) =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.author.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return filtered.reduce((groups, song) => {
      const letter = song.title[0]?.toUpperCase() || "#";
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(song);
      return groups;
    }, {});
  }, [allSongs, searchQuery]);

  const alphabet = Object.keys(groupedSongs).sort();

  // Compute stats — placed before early returns to keep hook order consistent
  const stats = useMemo(() => {
    const songs = allSongs || [];
    const artists = new Set(songs.map((s) => s.author?.toLowerCase().trim()).filter(Boolean));
    const categories = new Set(songs.map((s) => s.category || "Worship"));
    const recent = songs.filter((s) => s.created_at && Date.now() - new Date(s.created_at).getTime() < 30 * 24 * 60 * 60 * 1000);
    return { total: songs.length, artists: artists.size, categories: categories.size, recent: recent.length };
  }, [allSongs]);

  if (authLoading || roleLoading) {
    return <main className="flex min-h-[90vh] items-center justify-center">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </main>;
  }

  if (!user || !isAdmin) {
    return (
      <main className="flex min-h-[90vh] items-center justify-center px-6">
        <section className="max-w-md rounded-2xl bg-neutral-50/60 backdrop-blur-2xl p-8 text-center shadow-sm">
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
    <main className="min-h-[90vh] bg-transparent px-3 pb-36 pt-2 md:px-8 md:pt-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-neutral-900 md:text-2xl">Vault</h1>
              <span className="hidden md:inline-flex items-center gap-2 rounded-full border border-neutral-200/60 bg-white/60 px-3 py-1 text-[11px] font-medium text-neutral-400 backdrop-blur-sm">
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
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-accent/90 active:scale-95"
            >
              <Upload size={15} strokeWidth={2.5} /> Upload
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-neutral-50/60 p-4 backdrop-blur-2xl">
            <p className="text-2xl font-bold tracking-tight text-neutral-900">{stats.total}</p>
            <p className="text-[11px] font-medium text-neutral-400">Tracks</p>
          </div>
          <div className="rounded-2xl bg-neutral-50/60 p-4 backdrop-blur-2xl">
            <p className="text-2xl font-bold tracking-tight text-neutral-900">{stats.artists}</p>
            <p className="text-[11px] font-medium text-neutral-400">Artists</p>
          </div>
          <div className="rounded-2xl bg-neutral-50/60 p-4 backdrop-blur-2xl">
            <p className="text-2xl font-bold tracking-tight text-neutral-900">{stats.categories}</p>
            <p className="text-[11px] font-medium text-neutral-400">Categories</p>
          </div>
          <div className="rounded-2xl bg-neutral-50/60 p-4 backdrop-blur-2xl">
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
              className="w-full rounded-xl border border-neutral-200/80 bg-neutral-50/60 py-2.5 pl-9 pr-3 text-sm font-medium text-neutral-900 outline-none transition placeholder:text-neutral-300 focus:border-neutral-300 focus:bg-white"
            />
          </div>
        </div>

        {/* Admin access — collapsible */}
        <details className="group mb-6">
          <summary className="flex cursor-pointer items-center gap-2 rounded-xl bg-neutral-50/60 px-4 py-2.5 text-xs font-semibold text-neutral-500 transition hover:text-neutral-900 backdrop-blur-2xl list-none [&::-webkit-details-marker]:hidden">
            <ShieldCheck size={14} className="text-accent" />
            <span>Administrator access</span>
            <ChevronDown size={12} className="ml-auto transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2 rounded-xl bg-neutral-50/60 p-4 backdrop-blur-2xl">
            <p className="mb-3 text-xs leading-relaxed text-neutral-500">Grant dashboard access to an account that has already signed up.</p>
            <form onSubmit={handleGrantAdmin} className="flex w-full gap-2">
              <input
                type="email"
                value={adminEmail}
                onChange={(event) => setAdminEmail(event.target.value)}
                placeholder="user@example.com"
                required
                disabled={isGrantingAdmin}
                className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-accent"
              />
              <button
                type="submit"
                disabled={isGrantingAdmin}
                className="shrink-0 rounded-full bg-accent px-4 py-2.5 text-xs font-bold text-white transition hover:bg-accent/90 disabled:opacity-50"
              >
                {isGrantingAdmin ? "Granting…" : "Grant"}
              </button>
            </form>
            {adminMessage && <p role="status" className="mt-2 text-xs font-medium text-neutral-600">{adminMessage}</p>}
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
            <div className="flex flex-col items-center justify-center rounded-2xl bg-neutral-50/60 py-32 backdrop-blur-2xl text-neutral-200">
              <Music size={48} strokeWidth={1.5} className="mb-4 opacity-20" />
              <p className="text-[13px] font-medium text-neutral-400">No matching tracks found</p>
            </div>
          ) : (
            alphabet.map((letter) => (
              <div key={letter} className="mb-2">
                <div className="sticky top-0 z-10 pb-1 pt-3">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-accent/10 text-[10px] font-bold text-accent">{letter}</span>
                </div>
                <div className="flex flex-col">
                  {groupedSongs[letter].map((song, idx) => (
                    <div
                      key={song.id}
                      className="group grid grid-cols-[1fr_auto] md:grid-cols-[1fr_180px_120px_96px] gap-4 items-center rounded-xl px-2.5 py-2 transition hover:bg-neutral-100/70 md:px-4"
                    >
                      {/* Track */}
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="hidden md:inline text-[12px] font-mono text-neutral-300 w-5 text-right shrink-0">{idx + 1}</span>
                        <SongAvatar title={song.title} size="xs" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-neutral-900 leading-tight">{song.title}</p>
                          <p className="truncate text-[12px] font-medium text-neutral-400 md:hidden">{song.author}</p>
                        </div>
                      </div>

                      {/* Artist — desktop only */}
                      <span className="hidden md:block truncate text-[13px] font-medium text-neutral-500">{song.author}</span>

                      {/* Category + duration */}
                      <div className="flex items-center gap-1.5">
                        {song.duration && (
                          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${song.duration === "Short" ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"}`}>
                            {song.duration}
                          </span>
                        )}
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${song.category === "Praise" ? "bg-accent/10 text-accent" : "bg-neutral-100 text-neutral-400"}`}>
                          {song.category || "Worship"}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEditClick(song)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-accent/10 hover:text-accent"
                          title="Edit"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(song.id, song.song_path)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <UploadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          fetchSongs();
          // NO handleLogout() here - stay in the vault after upload
        }}
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
    </main>
  );
}
