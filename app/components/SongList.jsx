"use client";

import SongItem from "./SongItem";
import { Disc } from "lucide-react";

const SongList = ({ songs = [], onSongSelect }) => {
  if (songs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mb-4">
          <Disc className="text-neutral-200" size={32} />
        </div>
        <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">
          No music found
        </h3>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-y-1">
      {songs.map((song) => (
        <SongItem
          key={song.id}
          song={song}
          // Removed index/numbering here to keep the list clean
          onClick={() => onSongSelect(song)}
        />
      ))}
    </div>
  );
};

export default SongList;
