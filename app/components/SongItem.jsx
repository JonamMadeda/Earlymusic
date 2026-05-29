"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Play, Music, Heart, Info, ListPlus, ListMusic, Plus, MoreHorizontal } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/app/context/AuthContext";

const SongItem = ({ song, onClick }) => {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isPraise = song.category?.toLowerCase() === "praise";
  const isNew = song.created_at && (Date.now() - new Date(song.created_at).getTime()) < 14 * 24 * 60 * 60 * 1000;
  const [isSaved, setIsSaved] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (!user) { setIsSaved(false); return; }
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
      onClick={onClick}
      className="group relative flex items-center justify-between p-1.5 md:p-2 hover:bg-neutral-50 rounded-2xl transition-all cursor-pointer border border-transparent hover:border-neutral-100"
    >
      <div className="flex items-center gap-x-4 md:gap-x-6 flex-1 min-w-0">
        <div className="w-4 flex items-center justify-center">
          <Play
            className="text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
            size={16}
            fill="currentColor"
          />
        </div>

        <div className="h-10 w-10 md:h-11 md:w-11 rounded-xl flex items-center justify-center transition-all border border-transparent group-hover:bg-white group-hover:shadow-sm bg-neutral-100 group-hover:border-neutral-100">
          <Music className="text-neutral-400" size={18} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-x-2 mb-0.5">
            <p className="font-semibold text-neutral-900 text-[15px] leading-tight tracking-tight truncate">
              {song.title}
            </p>
            {isNew && (
              <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider flex-shrink-0">
                NEW
              </span>
            )}
          </div>
          <p className="text-[13px] text-neutral-500 font-medium tracking-normal truncate">
            {song.author}
            <span className="text-neutral-300 mx-1">·</span>
            <span className="text-[11px] text-neutral-400 font-normal">{song.category || "Worship"}</span>
          </p>
        </div>
      </div>

      <div className="relative flex items-center pr-2 md:pr-4">
        <div className={`transition-all ${isSaved ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"}`}>
          <Heart size={18} className="text-red-600 fill-red-600" />
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          className="p-1.5 text-neutral-300 hover:text-red-600 transition-colors"
          title="More"
        >
          <MoreHorizontal size={20} />
        </button>

        {showMenu && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 mt-8 z-50 bg-white border border-neutral-100 shadow-xl rounded-2xl p-1.5 min-w-[190px] animate-in fade-in zoom-in-95 duration-200"
          >
            <button
              onClick={() => { setShowInfo(true); setShowMenu(false); setShowPlaylists(false); }}
              className="flex items-center gap-x-3 w-full p-2.5 rounded-xl text-left transition hover:bg-neutral-50 text-neutral-700 hover:text-neutral-900"
            >
              <Info size={16} className="text-neutral-400" />
              <span className="text-[13px] font-semibold">Song Details</span>
            </button>
            <button
              onClick={() => {
                if (!user) { router.push(`/auth?redirectTo=${encodeURIComponent(pathname)}`); return; }
                setShowPlaylists(true); setShowInfo(false); setShowMenu(false);
              }}
              className="flex items-center gap-x-3 w-full p-2.5 rounded-xl text-left transition hover:bg-neutral-50 text-neutral-700 hover:text-neutral-900"
            >
              <ListPlus size={16} className="text-neutral-400" />
              <span className="text-[13px] font-semibold">Add to Playlist</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!user) { router.push(`/auth?redirectTo=${encodeURIComponent(pathname)}`); return; }
                (async () => {
                  if (isSaved) {
                    await supabase.from("saved_songs").delete().eq("user_id", user.id).eq("song_id", song.id);
                    setIsSaved(false);
                  } else {
                    await supabase.from("saved_songs").insert({ user_id: user.id, song_id: song.id });
                    setIsSaved(true);
                  }
                })();
                setShowMenu(false);
              }}
              className="flex items-center gap-x-3 w-full p-2.5 rounded-xl text-left transition hover:bg-neutral-50 text-neutral-700 hover:text-neutral-900"
            >
              <Heart
                size={16}
                className={isSaved ? "text-red-600 fill-red-600" : "text-neutral-400"}
              />
              <span className="text-[13px] font-semibold">{isSaved ? "Remove from Library" : "Add to Library"}</span>
            </button>
          </div>
        )}
      </div>

      {showInfo && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-0 mt-8 z-50 bg-white border border-neutral-100 shadow-xl rounded-2xl p-5 min-w-[240px] animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="flex flex-col gap-y-4">
            <div className="flex items-center justify-between border-b border-neutral-50 pb-2">
              <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Compilation Details</h4>
              <button onClick={() => setShowInfo(false)} className="text-neutral-300 hover:text-red-600 transition">
                <Info size={14} />
              </button>
            </div>

            <div className="flex flex-col gap-y-4 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
              {song.original_songs && song.original_songs.length > 0 ? (
                song.original_songs.map((entry, i) => (
                  <div key={i} className="flex flex-col gap-y-1 group/entry">
                    <p className="text-[14px] font-bold text-neutral-900 group-hover/entry:text-red-600 transition-colors leading-tight">
                      {entry.title || "Unknown Title"}
                    </p>
                    <p className="text-[12px] font-medium text-neutral-500">
                      Original Artist: <span className="text-neutral-900">{entry.artist || "Unknown"}</span>
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-[12px] text-neutral-400 italic py-2">No original song details available.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {showPlaylists && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-0 mt-8 z-50 bg-white border border-neutral-100 shadow-xl rounded-2xl p-4 min-w-[220px] animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="flex items-center justify-between border-b border-neutral-50 pb-2 mb-3">
            <h4 className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Add to Playlist</h4>
            <button onClick={() => setShowPlaylists(false)} className="text-neutral-300 hover:text-red-600 transition">
              <Info size={14} />
            </button>
          </div>

          <div className="flex flex-col gap-y-1 max-h-[200px] overflow-y-auto custom-scrollbar">
            {playlists.length === 0 ? (
              <p className="text-[12px] text-neutral-400 italic py-2 text-center">
                No playlists yet
              </p>
            ) : (
              playlists.map((pl) => (
                <button
                  key={pl.id}
                  onClick={(e) => addToPlaylist(e, pl.id)}
                  className="flex items-center gap-x-3 p-2.5 rounded-xl text-left transition w-full hover:bg-neutral-50 text-neutral-700 hover:text-neutral-900"
                >
                  <ListMusic size={16} className="text-red-600" />
                  <span className="text-[13px] font-semibold truncate flex-1">{pl.name}</span>
                </button>
              ))
            )}
          </div>

          <div className="border-t border-neutral-50 pt-3 mt-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="New playlist..."
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createAndAdd(e)}
                className="flex-1 p-2 bg-neutral-50 border border-neutral-200 rounded-lg outline-none focus:border-red-600 text-[12px] font-medium transition"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={createAndAdd}
                disabled={!newPlaylistName.trim()}
                className="p-2 bg-red-600 text-white rounded-lg hover:bg-neutral-900 transition disabled:opacity-50 flex-shrink-0"
                title="Create & Add"
              >
                <Plus size={14} strokeWidth={3} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SongItem;
