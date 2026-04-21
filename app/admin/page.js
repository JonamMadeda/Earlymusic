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

export default function AdminDashboard() {
  const { allSongs, setAllSongs } = usePlayer();

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Edit State
  const [editModalSong, setEditModalSong] = useState(null);

  const router = useRouter();
  const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;

  // Manual Logout: Only happens when the user clicks the button
  const handleLogout = () => {
    setIsAuthorized(false);
    router.replace("/");
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkAuth = () => {
      // If already authorized in this session, don't prompt again
      if (isAuthorized) return;

      const password = prompt("Admin Access Required:");

      if (password === ADMIN_PASSWORD && ADMIN_PASSWORD) {
        setIsAuthorized(true);
        fetchSongs();
      } else {
        router.replace("/");
      }
      setLoading(false);
    };

    checkAuth();
    // Removed all auto-logout timers and listeners
  }, [router, ADMIN_PASSWORD, isAuthorized]);

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
      await supabase.storage.from("songs").remove([path]);
      const { error: dbError } = await supabase
        .from("songs")
        .delete()
        .eq("id", id);

      if (dbError) throw dbError;

      // Update local state without redirecting
      setAllSongs((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error(err);
      alert("Deletion failed.");
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

  if (loading || !isAuthorized) return null;

  return (
    <main className="min-h-[90vh] bg-white px-6 py-8 pb-40 relative">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col gap-y-10 mb-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <button
                onClick={handleLogout}
                className="text-neutral-400 hover:text-red-600 flex items-center gap-2 mb-4 transition font-semibold text-[12px] uppercase tracking-wider"
              >
                <ArrowLeft size={14} /> Lock Vault
              </button>
              <div className="flex items-center gap-x-4">
                <h1 className="text-4xl font-black text-neutral-900 tracking-tighter uppercase">
                  Vault
                </h1>
                <div className="h-8 w-8 bg-black rounded-lg flex items-center justify-center text-white shadow-lg">
                  <ShieldCheck size={18} />
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-red-600 text-white px-8 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-neutral-900 transition-all shadow-xl shadow-red-100 active:scale-95 text-sm uppercase tracking-tight"
            >
              <Upload size={18} strokeWidth={2.5} /> Upload Track
            </button>
          </div>

          <div className="relative group">
            <Search
              className="absolute left-6 top-1/2 -translate-y-1/2 text-neutral-300 group-focus-within:text-red-600 transition-colors"
              size={18}
            />
            <input
              type="text"
              placeholder="Search tracks or artists in vault..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-100 rounded-2xl py-4.5 pl-16 pr-8 outline-none focus:border-red-600 focus:bg-white transition-all font-medium text-neutral-900 text-[15px] placeholder:text-neutral-300"
            />
          </div>
        </header>

        <div className="flex flex-col gap-y-6">
          {alphabet.length === 0 ? (
            <div className="py-32 flex flex-col items-center justify-center border border-dashed border-neutral-100 rounded-[2rem] text-neutral-200">
              <Music size={48} strokeWidth={1.5} className="mb-4 opacity-20" />
              <p className="font-medium text-[13px] text-neutral-400">
                No matching tracks found
              </p>
            </div>
          ) : (
            alphabet.map((letter) => (
              <div key={letter} className="flex flex-col gap-y-2">
                <div className="flex items-center gap-x-4 border-b border-neutral-50 pb-2 px-2">
                  <h2 className="text-3xl font-semibold text-neutral-900 tracking-tight">
                    {letter}
                  </h2>
                </div>

                <div className="flex flex-col gap-y-1">
                  {groupedSongs[letter].map((song) => (
                      <div
                        key={song.id}
                        className="bg-white p-1.5 md:p-2 rounded-2xl flex items-center justify-between group hover:bg-neutral-50 border border-transparent hover:border-neutral-100 transition-all duration-300"
                      >
                          <div className="flex items-center gap-x-4 md:gap-x-6 flex-1 min-w-0">
                            <div className="h-10 w-10 md:h-11 md:w-11 bg-neutral-100 rounded-xl flex items-center justify-center text-neutral-400 group-hover:bg-white group-hover:shadow-sm transition-all border border-transparent group-hover:border-neutral-100 flex-shrink-0">
                              <Music size={18} />
                            </div>
                            <div className="flex-1 min-w-0 flex items-center">
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-neutral-900 text-[15px] leading-tight mb-0.5 tracking-tight truncate">
                                  {song.title}
                                </p>
                                <p className="text-[13px] text-neutral-500 font-medium tracking-normal truncate">
                                  {song.author}
                                </p>
                              </div>
                              <div className="flex-shrink-0 ml-2">
                                {(song.category || "Worship") && (
                                  <span
                                    className={`
                                      px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider
                                      ${song.category === "Praise"
                                        ? "bg-red-50 text-red-600"
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
                              className="w-10 h-10 flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
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
