"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ListMusic, Plus, Trash2, LogIn, Disc } from "lucide-react";
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
      <main className="min-h-[90vh] bg-transparent px-4 pb-40 pt-2 md:px-8 md:pt-6">
        <div className="max-w-5xl mx-auto flex items-center justify-center py-32">
          <div className="w-8 h-8 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-[90vh] bg-transparent px-4 pb-40 pt-2 md:px-8 md:pt-6">
        <div className="max-w-5xl mx-auto flex flex-col items-center justify-center py-32 text-center">
          <Disc className="mb-4 text-neutral-300" size={32} />
          <p className="text-sm font-semibold text-neutral-900 mb-2">Sign in to manage playlists</p>
          <Link
            href="/auth"
            className="inline-flex items-center gap-2 rounded-full bg-accent px-4.5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-accent/90"
          >
            <LogIn size={14} />
            Sign In
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[90vh] bg-transparent px-4 pb-40 pt-2 md:px-8 md:pt-6">
      <div className="max-w-5xl mx-auto">
        <section className="mb-8">
          <div className="flex items-center gap-3">
            <div className="h-6 w-1 rounded-full bg-accent" />
            <h1 className="text-xl font-bold tracking-[0.15em] text-neutral-900 md:text-2xl uppercase">
              Playlists
            </h1>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-450 max-w-xl">
            Build listening sets and keep your favorite compilations grouped together.
          </p>
          <div className="mt-4 flex items-center gap-3.5 text-xs text-neutral-400">
            <span>{playlists.length} playlist{playlists.length !== 1 ? "s" : ""}</span>
          </div>
        </section>

        <div className="mb-8 flex flex-wrap items-center gap-2 border-b border-neutral-100 pb-6">
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-4.5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-accent/90"
          >
            <Plus size={13} />
            New Playlist
          </button>
        </div>

        {showCreate && (
          <div className="mb-8 -mt-4 flex items-center gap-3 bg-neutral-50/60 rounded-2xl p-3.5">
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
            <Disc className="mb-4 text-neutral-300" size={32} />
            <p className="text-sm font-semibold text-neutral-900">
              No playlists yet
            </p>
            <p className="mt-1 max-w-sm text-xs text-neutral-450">
              Create your first playlist to organize your songs.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {playlists.map((pl) => (
              <div
                key={pl.id}
                onClick={() => router.push(`/playlists/${pl.id}`)}
                className="group flex cursor-pointer flex-col gap-3 rounded-2xl bg-neutral-50/60 p-5 text-left transition-all duration-300 hover:bg-neutral-100/80"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-neutral-900/5 text-neutral-800">
                    <ListMusic size={22} />
                  </div>
                  <button
                    onClick={(e) => deletePlaylist(e, pl.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition-all duration-300 opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-white"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div>
                  <h3 className="truncate text-sm font-semibold tracking-tight text-neutral-900">
                    {pl.name}
                  </h3>
                  <p className="mt-0.5 text-[11px] font-medium text-neutral-400">
                    Playlist
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
