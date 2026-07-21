"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Heart,
  Info,
  ListPlus,
  ListMusic,
  Plus,
  MoreHorizontal,
  Play,
} from "lucide-react";
import SongAvatar from "@/app/components/SongAvatar";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/app/context/AuthContext";

const SongItem = ({ song, onClick }) => {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const rowRef = useRef(null);
  const normalizedCategory = (song.category || "Worship").trim();
  const isNew =
    song.created_at &&
    Date.now() - new Date(song.created_at).getTime() <
      14 * 24 * 60 * 60 * 1000;
  const [isSaved, setIsSaved] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [newPlaylistName, setNewPlaylistName] = useState("");

  useEffect(() => {
    if (!showMenu && !showInfo && !showPlaylists) return;

    const handleClickOutside = (e) => {
      if (rowRef.current && !rowRef.current.contains(e.target)) {
        setShowMenu(false);
        setShowInfo(false);
        setShowPlaylists(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu, showInfo, showPlaylists]);
  useEffect(() => {
    if (!user) {
      setIsSaved(false);
      return;
    }

    supabase
      .from("saved_songs")
      .select("id")
      .eq("user_id", user.id)
      .eq("song_id", song.id)
      .maybeSingle()
      .then(({ data }) => setIsSaved(!!data));
  }, [user, song.id]);

  useEffect(() => {
    if (showPlaylists && user) {
      supabase
        .from("playlists")
        .select("id, name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .then(({ data }) => setPlaylists(data || []));
    }
  }, [showPlaylists, user]);

  const addToPlaylist = async (e, playlistId) => {
    e.stopPropagation();
    await supabase
      .from("playlist_songs")
      .insert({ playlist_id: playlistId, song_id: song.id });
  };

  const createAndAdd = async (e) => {
    e.stopPropagation();
    const name = newPlaylistName.trim();
    if (!name || !user) return;

    const { data: pl } = await supabase
      .from("playlists")
      .insert({ name, user_id: user.id })
      .select()
      .single();

    if (pl) {
      await supabase
        .from("playlist_songs")
        .insert({ playlist_id: pl.id, song_id: song.id });
      setNewPlaylistName("");
      setShowPlaylists(false);
    }
  };

  return (
    <div
      ref={rowRef}
      onClick={onClick}
      className="group relative flex cursor-pointer items-center gap-3.5 rounded-2xl bg-neutral-50/60 p-3.5 text-left transition-all duration-300 hover:bg-neutral-100/80 hover:shadow-sm backdrop-blur-2xl"
    >
      <div className="relative shrink-0">
        <SongAvatar title={song.title} size="md" />
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/30 opacity-0 transition-all duration-300 group-hover:opacity-100">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white shadow-md shadow-accent/20">
            <Play size={13} fill="currentColor" className="ml-0.5" />
          </div>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold tracking-tight text-neutral-900">
            {song.title}
          </p>
          {isNew && (
            <span className="rounded bg-neutral-900/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-neutral-800">
              New
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <p className="truncate text-[11px] font-medium text-neutral-400">
            {song.author}
          </p>
          <span className="h-1 w-1 rounded-full bg-neutral-300" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
            {normalizedCategory}
          </span>
          {song.duration === "Short" && (
            <span className="rounded bg-neutral-900/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-neutral-500">
              Short
            </span>
          )}
        </div>
      </div>

      <div className="relative flex items-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 transition-all duration-300 hover:bg-accent hover:text-white"
          title="More"
        >
          <MoreHorizontal size={14} />
        </button>

        {showMenu && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 z-50 mt-12 min-w-[210px] rounded-2xl border border-neutral-100 bg-white p-2 shadow-lg"
          >
            <button
              onClick={() => {
                setShowInfo(true);
                setShowMenu(false);
                setShowPlaylists(false);
              }}
              className="flex w-full items-center gap-x-3 rounded-2xl px-3 py-3 text-left text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
            >
              <Info size={16} className="text-neutral-400" />
              <span className="text-[13px] font-semibold">Compilation Details</span>
            </button>
            <button
              onClick={() => {
                if (!user) {
                  router.push(`/auth?redirectTo=${encodeURIComponent(pathname)}`);
                  return;
                }
                setShowPlaylists(true);
                setShowInfo(false);
                setShowMenu(false);
              }}
              className="flex w-full items-center gap-x-3 rounded-2xl px-3 py-3 text-left text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
            >
              <ListPlus size={16} className="text-neutral-400" />
              <span className="text-[13px] font-semibold">Add to Playlist</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!user) {
                  router.push(`/auth?redirectTo=${encodeURIComponent(pathname)}`);
                  return;
                }

                (async () => {
                  if (isSaved) {
                    await supabase
                      .from("saved_songs")
                      .delete()
                      .eq("user_id", user.id)
                      .eq("song_id", song.id);
                    setIsSaved(false);
                  } else {
                    await supabase
                      .from("saved_songs")
                      .insert({ user_id: user.id, song_id: song.id });
                    setIsSaved(true);
                  }
                })();
                setShowMenu(false);
              }}
              className="flex w-full items-center gap-x-3 rounded-2xl px-3 py-3 text-left text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
            >
              <Heart
                size={16}
                className={isSaved ? "text-neutral-900 fill-neutral-900" : "text-neutral-400"}
              />
              <span className="text-[13px] font-semibold">
                {isSaved ? "Remove from Library" : "Add to Library"}
              </span>
            </button>
          </div>
        )}
      </div>

      {showInfo && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-0 z-50 mt-12 min-w-[260px] rounded-2xl border border-neutral-100 bg-white p-5 shadow-lg"
        >
          <div className="flex flex-col gap-y-4">
            <div className="flex items-center justify-between border-b border-neutral-50 pb-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Compilation Details
              </h4>
              <button
                onClick={() => setShowInfo(false)}
                className="text-neutral-300 transition hover:text-neutral-900"
              >
                <Info size={14} />
              </button>
            </div>

            <div className="custom-scrollbar flex max-h-[250px] flex-col gap-y-4 overflow-y-auto pr-1">
              {song.original_songs && song.original_songs.length > 0 ? (
                song.original_songs.map((entry, i) => (
                  <div key={i} className="group/entry flex flex-col gap-y-1">
                    <p className="text-[14px] font-bold leading-tight text-neutral-900">
                      {entry.title || "Unknown Title"}
                    </p>
                    <p className="text-[12px] font-medium text-neutral-500">
                      Original Artist:{" "}
                      <span className="text-neutral-900">
                        {entry.artist || "Unknown"}
                      </span>
                    </p>
                  </div>
                ))
              ) : (
                <p className="py-2 text-[12px] italic text-neutral-400">
                  No original song details available.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {showPlaylists && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-0 z-50 mt-12 min-w-[240px] rounded-2xl border border-neutral-100 bg-white p-4 shadow-lg"
        >
          <div className="mb-3 flex items-center justify-between border-b border-neutral-50 pb-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Add to Playlist
            </h4>
            <button
              onClick={() => setShowPlaylists(false)}
              className="text-neutral-300 transition hover:text-neutral-900"
            >
              <Info size={14} />
            </button>
          </div>

          <div className="custom-scrollbar flex max-h-[200px] flex-col gap-y-1 overflow-y-auto">
            {playlists.length === 0 ? (
              <p className="py-2 text-center text-[12px] italic text-neutral-400">
                No playlists yet
              </p>
            ) : (
              playlists.map((pl) => (
                <button
                  key={pl.id}
                  onClick={(e) => addToPlaylist(e, pl.id)}
                  className="flex w-full items-center gap-x-3 rounded-2xl px-3 py-3 text-left text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
                >
                  <ListMusic size={16} className="text-neutral-400" />
                  <span className="flex-1 truncate text-[13px] font-semibold">
                    {pl.name}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="mt-2 border-t border-neutral-50 pt-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="New playlist..."
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createAndAdd(e)}
                className="flex-1 rounded-full border border-neutral-200/80 bg-neutral-50/60 px-3.5 py-2.5 text-[12px] font-medium outline-none transition placeholder:text-neutral-300 focus:border-neutral-300 focus:bg-white"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={createAndAdd}
                disabled={!newPlaylistName.trim()}
                className="flex-shrink-0 rounded-full bg-accent p-2.5 text-white transition hover:bg-accent/90 disabled:opacity-50"
                title="Create & Add"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SongItem;
