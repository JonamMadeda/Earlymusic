"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import {
  Trash2,
  Upload,
  ArrowLeft,
  ShieldCheck,
  Music2,
  Search,
  Edit3,
  Check,
  Plus,
  X,
} from "lucide-react";
import UploadModal from "../components/UploadModal";
import { usePlayer } from "../context/PlayerContext";

export default function AdminDashboard() {
  const { allSongs, setAllSongs } = usePlayer();

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Edit State
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAuthor, setEditAuthor] = useState("");
  const [editOriginalSongs, setEditOriginalSongs] = useState([]);
  const [editCategory, setEditCategory] = useState("Worship");

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
    setEditingId(song.id);
    setEditTitle(song.title);
    setEditAuthor(song.author);
    setEditOriginalSongs(song.original_songs || [{ title: "", artist: "" }]);
    const normalizedCat = (song.category || "Worship").trim();
    setEditCategory(normalizedCat.charAt(0).toUpperCase() + normalizedCat.slice(1).toLowerCase());
  };

  const addEditOriginal = () => {
    setEditOriginalSongs([...editOriginalSongs, { title: "", artist: "" }]);
  };

  const removeEditOriginal = (index) => {
    setEditOriginalSongs(editOriginalSongs.filter((_, i) => i !== index));
  };

  const handleEditOriginalChange = (index, field, value) => {
    const updated = [...editOriginalSongs];
    updated[index][field] = value;
    setEditOriginalSongs(updated);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditAuthor("");
    setEditOriginalSongs([]);
    setEditCategory("Worship");
  };

  const handleUpdate = async (id) => {
    try {
      const { data, error } = await supabase
        .from("songs")
        .update({
          title: editTitle,
          author: editAuthor,
          original_songs: editOriginalSongs.filter(s => s.title || s.artist),
          category: editCategory.trim(),
        })
        .eq("id", id)
        .select();

      if (error) throw error;
      
      setAllSongs((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
              ...s,
              title: editTitle,
              author: editAuthor,
              original_songs: editOriginalSongs.filter(s => s.title || s.artist),
              category: editCategory.trim(),
            }
            : s
        )
      );
      // Clear cache so other pages see the update
      localStorage.removeItem("earlymusic_songs_cache");
      cancelEdit();
    } catch (err) {
      console.error("Update Error:", err);
      alert(`Update failed: ${err.message || "Unknown error"}`);
    }
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
    <main className="min-h-[90vh] bg-white p-6 md:p-10 pb-40">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col gap-y-10 mb-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <button
                onClick={handleLogout}
                className="text-neutral-400 hover:text-red-600 flex items-center gap-2 mb-4 transition font-semibold text-[13px]"
              >
                <ArrowLeft size={14} /> Lock Vault
              </button>
              <div className="flex items-center gap-x-4">
                <h1 className="text-6xl font-semibold text-neutral-900 tracking-tight">
                  Vault
                </h1>
                <ShieldCheck size={28} className="text-red-600" />
              </div>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-red-600 text-white px-10 py-4 rounded-2xl font-semibold flex items-center justify-center gap-3 hover:bg-neutral-900 transition-all shadow-xl shadow-red-100 active:scale-95 text-sm"
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
              className="w-full bg-neutral-50 border border-neutral-100 rounded-2xl py-5 pl-16 pr-8 outline-none focus:border-red-600 focus:bg-white transition-all font-medium text-neutral-900 text-[15px]"
            />
          </div>
        </header>

        <div className="flex flex-col gap-y-12">
          {alphabet.length === 0 ? (
            <div className="py-32 flex flex-col items-center justify-center border border-dashed border-neutral-100 rounded-[2rem] text-neutral-200">
              <Music2 size={48} strokeWidth={1.5} className="mb-4 opacity-20" />
              <p className="font-medium text-[13px] text-neutral-400">
                No matching tracks found
              </p>
            </div>
          ) : (
            alphabet.map((letter) => (
              <div key={letter} className="flex flex-col gap-y-4">
                <div className="flex items-center gap-x-4 px-2">
                  <h2 className="text-3xl font-semibold text-red-600 tracking-tight">
                    {letter}
                  </h2>
                  <div className="h-[1px] flex-1 bg-neutral-50" />
                </div>

                <div className="flex flex-col gap-y-1">
                  {groupedSongs[letter].map((song) => (
                    <div
                      key={song.id}
                      className="bg-white p-4 rounded-2xl flex items-center justify-between group hover:bg-neutral-50 border border-transparent hover:border-neutral-100 transition-all duration-300"
                    >
                      {editingId === song.id ? (
                        <div className="flex-1 flex flex-col md:flex-row items-center gap-3 pr-4 animate-in fade-in slide-in-from-left-2">
                          <input
                            autoFocus
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full md:flex-1 bg-neutral-100 border-none rounded-xl px-4 py-2 text-[15px] font-semibold outline-none focus:ring-2 ring-red-600/20"
                          />
                          <input
                            value={editAuthor}
                            onChange={(e) => setEditAuthor(e.target.value)}
                            className="w-full md:flex-1 bg-neutral-100 border-none rounded-xl px-4 py-2 text-[13px] font-medium outline-none focus:ring-2 ring-red-600/20"
                          />
                          <div className="flex-1 flex flex-col gap-y-2 max-w-md">
                            <div className="flex items-center justify-between px-1">
                              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Compilations</span>
                              <button
                                type="button"
                                onClick={addEditOriginal}
                                className="text-red-600 hover:text-neutral-900 transition flex items-center gap-1 text-[10px] font-bold"
                              >
                                <Plus size={12} /> Add
                              </button>
                            </div>
                            <div className="flex flex-col gap-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                              {editOriginalSongs.map((s, idx) => (
                                <div key={idx} className="flex items-center gap-2 group/edit-item">
                                  <input
                                    value={s.title}
                                    onChange={(e) => handleEditOriginalChange(idx, "title", e.target.value)}
                                    placeholder="Title"
                                    className="flex-1 bg-neutral-100 border-none rounded-lg px-3 py-1.5 text-[11px] font-medium outline-none focus:ring-1 ring-red-600/20"
                                  />
                                  <input
                                    value={s.artist}
                                    onChange={(e) => handleEditOriginalChange(idx, "artist", e.target.value)}
                                    placeholder="Artist"
                                    className="flex-1 bg-neutral-100 border-none rounded-lg px-3 py-1.5 text-[11px] font-medium outline-none focus:ring-1 ring-red-600/20"
                                  />
                                  {editOriginalSongs.length > 1 && (
                                    <button
                                      onClick={() => removeEditOriginal(idx)}
                                      className="text-neutral-300 hover:text-red-600 transition opacity-0 group-hover/edit-item:opacity-100"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            className="bg-neutral-100 border-none rounded-xl px-4 py-2 text-[13px] font-semibold outline-none focus:ring-2 ring-red-600/20 appearance-none"
                          >
                            <option value="Worship">Worship</option>
                            <option value="Praise">Praise</option>
                          </select>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleUpdate(song.id)}
                              className="p-2 bg-red-600 text-white rounded-xl hover:bg-neutral-900 transition"
                            >
                              <Check size={18} />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-2 bg-neutral-200 text-neutral-600 rounded-xl hover:bg-neutral-300 transition"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-x-6">
                            <div className="h-10 w-10 bg-neutral-50 rounded-lg flex items-center justify-center text-neutral-300">
                              <Music2 size={16} />
                            </div>
                            <div>
                              <p className="font-semibold text-neutral-900 text-[15px] leading-tight">
                                {song.title}
                              </p>
                              <p className="text-[13px] text-neutral-500 font-medium">
                                {song.author}
                              </p>
                            </div>
                            {(song.category || "Worship") && (
                              <span
                                className={`
                                  ml-2 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider
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
                        </>
                      )}
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
    </main>
  );
}
