"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ListMusic, Plus, Music, Trash2, LogIn } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/app/context/AuthContext";
import Link from "next/link";

export default function PlaylistsPage() {
  const { user, loading: authLoading } = useAuth();
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }

    supabase
      .from("playlists")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setPlaylists(data);
      })
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  const createPlaylist = async () => {
    const name = newName.trim();
    if (!name) return;

    const { data } = await supabase
      .from("playlists")
      .insert({ name, user_id: user.id })
      .select()
      .single();

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

  if (authLoading || loading) {
    return (
      <main className="min-h-[90vh] bg-white px-6 py-8 pb-40 relative">
        <div className="max-w-5xl mx-auto flex items-center justify-center py-32">
          <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-[90vh] bg-white px-6 py-8 pb-40 relative">
        <div className="max-w-5xl mx-auto flex flex-col items-center justify-center py-32 text-center">
          <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mb-4">
            <ListMusic className="text-neutral-200" size={32} />
          </div>
          <p className="text-[15px] font-medium text-neutral-900 mb-2">Sign in to manage playlists</p>
          <Link
            href="/auth"
            className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-neutral-900 transition-all flex items-center gap-2 shadow-lg shadow-red-100"
          >
            <LogIn size={16} />
            Sign In
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[90vh] bg-white px-6 py-8 pb-40 relative">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-12 px-2">
          <div className="flex items-center gap-x-3">
            <ListMusic className="text-red-600" size={24} />
            <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">
              Playlists
            </h1>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-neutral-900 transition-all flex items-center gap-2 shadow-lg shadow-red-100"
          >
            <Plus size={16} strokeWidth={3} />
            New
          </button>
        </div>

        {showCreate && (
          <div className="mb-8 flex items-center gap-3 bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
            <input
              type="text"
              placeholder="Playlist name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createPlaylist()}
              className="flex-1 p-3 bg-white border border-neutral-200 rounded-xl outline-none focus:border-red-600 text-sm font-medium transition"
              autoFocus
            />
            <button
              onClick={createPlaylist}
              disabled={!newName.trim()}
              className="bg-red-600 text-white px-5 py-3 rounded-xl font-bold text-sm hover:bg-neutral-900 transition-all disabled:opacity-50"
            >
              Create
            </button>
          </div>
        )}

        {playlists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mb-4">
              <ListMusic className="text-neutral-200" size={32} />
            </div>
            <p className="text-[15px] font-medium text-neutral-900">
              No playlists yet
            </p>
            <p className="text-[13px] text-neutral-400 mt-1">
              Create your first playlist to organize your songs.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {playlists.map((pl) => (
              <div
                key={pl.id}
                onClick={() => router.push(`/playlists/${pl.id}`)}
                className="bg-neutral-50 border border-neutral-100 rounded-2xl p-5 hover:border-red-200 hover:shadow-md transition-all cursor-pointer group relative"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <ListMusic className="text-red-600" size={22} />
                  </div>
                  <button
                    onClick={(e) => deletePlaylist(e, pl.id)}
                    className="text-neutral-300 hover:text-red-600 transition opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <h3 className="font-bold text-neutral-900 text-[15px] mb-1 truncate">
                  {pl.name}
                </h3>
                <p className="text-[12px] text-neutral-400 font-medium">
                  {/* song count will be fetched on detail page */}
                  Playlist
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
