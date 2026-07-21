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
  Check,
  Plus,
  X,
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
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col gap-y-10 mb-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <button
                onClick={handleLogout}
                className="text-neutral-400 hover:text-accent flex items-center gap-2 mb-4 transition font-semibold text-[12px] uppercase tracking-wider"
              >
                <ArrowLeft size={14} /> Sign Out
              </button>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold tracking-tight text-neutral-900 md:text-2xl">Vault</h1>
              </div>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="rounded-full bg-accent text-white shadow-sm px-8 py-3.5 font-bold flex items-center justify-center gap-3 hover:bg-accent/90 transition-all active:scale-95 text-sm uppercase tracking-tight"
            >
              <Upload size={18} strokeWidth={2.5} /> Upload Track
            </button>
          </div>

          <div className="relative group">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-300 group-focus-within:text-accent transition-colors"
              size={16}
            />
            <input
              type="text"
              placeholder="Search tracks or artists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full border border-neutral-200/80 bg-neutral-50/60 px-10 py-3 text-sm font-medium text-neutral-900 outline-none transition placeholder:text-neutral-300 focus:border-neutral-300 focus:bg-white"
            />
          </div>

          <section className="rounded-2xl bg-neutral-50/60 backdrop-blur-2xl p-5 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-neutral-900">
                  <ShieldCheck size={18} className="text-accent" />
                  <h2 className="text-sm font-bold">Administrator access</h2>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500">Grant dashboard access to an account that has already signed up.</p>
              </div>
              <form onSubmit={handleGrantAdmin} className="flex w-full gap-2 md:w-auto">
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(event) => setAdminEmail(event.target.value)}
                  placeholder="user@example.com"
                  required
                  disabled={isGrantingAdmin}
                  className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-accent md:w-64"
                />
                <button
                  type="submit"
                  disabled={isGrantingAdmin}
                  className="shrink-0 rounded-full bg-accent px-4 py-2.5 text-xs font-bold text-white transition hover:bg-accent/90 disabled:opacity-50"
                >
                  {isGrantingAdmin ? "Granting…" : "Grant access"}
                </button>
              </form>
            </div>
            {adminMessage && <p role="status" className="mt-3 text-xs font-medium text-neutral-600">{adminMessage}</p>}
          </section>
        </header>

        <div className="flex flex-col gap-y-6">
          {alphabet.length === 0 ? (
            <div className="py-32 flex flex-col items-center justify-center rounded-2xl bg-neutral-50/60 backdrop-blur-2xl text-neutral-200">
              <Music size={48} strokeWidth={1.5} className="mb-4 opacity-20" />
              <p className="font-medium text-[13px] text-neutral-400">
                No matching tracks found
              </p>
            </div>
          ) : (
            alphabet.map((letter) => (
              <div key={letter} className="flex flex-col gap-y-2">
                <div className="flex items-center gap-3 border-b border-neutral-100 pb-2 px-1">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-accent/10 text-[10px] font-bold text-accent">{letter}</span>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">{letter}</h2>
                </div>

                <div className="flex flex-col gap-y-1">
                  {groupedSongs[letter].map((song) => (
                      <div
                        key={song.id}
                        className="bg-neutral-50/60 p-1.5 md:p-2 rounded-2xl flex items-center justify-between group hover:bg-neutral-100/80 hover:shadow-sm backdrop-blur-2xl border border-transparent transition-all duration-300"
                      >
                          <div className="flex items-center gap-x-4 md:gap-x-6 flex-1 min-w-0">
                            <SongAvatar title={song.title} size="sm" />
                            <div className="flex-1 min-w-0 flex items-center">
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-neutral-900 text-[15px] leading-tight mb-0.5 tracking-tight truncate">
                                  {song.title}
                                </p>
                                <p className="text-[13px] text-neutral-500 font-medium tracking-normal truncate">
                                  {song.author}
                                </p>
                              </div>
                              <div className="flex-shrink-0 ml-2 flex items-center gap-1.5">
                                {song.duration && (
                                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${song.duration === "Short" ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"}`}>
                                    {song.duration}
                                  </span>
                                )}
                                {(song.category || "Worship") && (
                                  <span
                                    className={`
                                      px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider
                                      ${song.category === "Praise"
                                        ? "bg-accent/10 text-accent"
                                        : "bg-neutral-100 text-neutral-400"
                                      }
                                    `}
                                  >
                                    {song.category || "Worship"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEditClick(song)}
                              className="w-10 h-10 flex items-center justify-center text-neutral-400 hover:text-accent hover:bg-accent/10 rounded-xl transition-all"
                            >
                              <Edit3 size={18} />
                            </button>
                            <button
                              onClick={() =>
                                handleDelete(song.id, song.song_path)
                              }
                              className="w-10 h-10 flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                            >
                              <Trash2 size={18} />
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
