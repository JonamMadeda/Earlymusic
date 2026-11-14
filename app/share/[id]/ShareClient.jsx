"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Play, Share2, Copy, Check, ListMusic, ArrowLeft } from "lucide-react";
import { usePlayer } from "@/app/context/PlayerContext";
import { apiFetch } from "@/lib/apiFetch";
import { getSongShareUrl, shareSong, copyTextToClipboard } from "@/lib/share";
import { VinylArtwork } from "@/app/components/SongAvatar";

export default function ShareClient({ song }) {
  const { activeSong, setActiveSong, allSongs, setAllSongs } = usePlayer();
  const [queue, setQueue] = useState([song]);
  const [copied, setCopied] = useState(false);
  const [shareState, setShareState] = useState("");

  // Ensure the global song list is populated so next/previous + the
  // persistent player keep working after opening a shared link directly.
  useEffect(() => {
    let cancelled = false;
    if (allSongs && allSongs.length > 0) {
      setQueue((prev) => {
        const has = allSongs.some((s) => s.id === song.id);
        return has ? allSongs : [song, ...allSongs];
      });
      return;
    }
    apiFetch("/api/data/songs?order=title&ascending=true")
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return;
        setAllSongs(data);
        const has = data.some((s) => s.id === song.id);
        setQueue(has ? data : [song, ...data]);
      })
      .catch(() => {
        if (!cancelled) setQueue([song]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.id]);

  const isCurrent = activeSong?.id === song.id;

  const handlePlay = () => {
    setActiveSong(song, queue.length > 0 ? queue : [song]);
  };

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(getSongShareUrl(song));
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    const result = await shareSong(song);
    if (result === "copied") {
      setShareState("Link copied to clipboard");
    } else if (result === "failed") {
      setShareState("Could not share — copy the link manually");
    } else {
      setShareState("");
    }
    if (result !== "shared") setTimeout(() => setShareState(""), 2500);
  };

  return (
    <main className="min-h-[90vh] bg-white px-3 sm:px-6 md:px-8 pb-12 pt-3 md:pt-5">
      <div className="mx-auto max-w-xl space-y-5">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-neutral-500 transition hover:text-neutral-900"
        >
          <ArrowLeft size={13} />
          Back to home
        </Link>

        <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xs">
          {/* Dark showcase header */}
          <div
            className="relative flex flex-col items-center px-6 pt-8 pb-6 text-center text-white"
            style={{ backgroundColor: "#0f172a" }}
          >
            <span className="mb-4 rounded border border-white/20 bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
              Shared song
            </span>
            <VinylArtwork title={song.title} isPlaying={isCurrent} />
            <h1 className="mt-5 text-lg font-bold tracking-tight text-white">
              {song.title}
            </h1>
            <p className="mt-1 truncate text-sm text-neutral-300">
              {song.author || "Unknown artist"}
            </p>
            {song.category && (
              <span className="mt-2.5 rounded border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-300">
                {song.category}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3 p-4 sm:p-5">
            {isCurrent ? (
              <div className="flex items-center justify-center gap-2 rounded-lg bg-accent/8 px-4 py-2.5 text-xs font-bold text-accent">
                <span className="waveform flex h-3.5 items-end">
                  <span />
                  <span />
                  <span />
                  <span />
                </span>
                Now playing — use the player bar below to control playback
              </div>
            ) : (
              <button
                type="button"
                onClick={handlePlay}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-2xs transition hover:bg-accent/90 active:scale-[0.99]"
              >
                <Play size={15} fill="currentColor" />
                Play this song
              </button>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                <Share2 size={13} />
                Share
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                {copied ? (
                  <Check size={13} className="text-accent" />
                ) : (
                  <Copy size={13} />
                )}
                {copied ? "Copied!" : "Copy link"}
              </button>
              <Link
                href="/songs"
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                <ListMusic size={13} />
                All songs
              </Link>
            </div>

            {shareState && (
              <p className="text-center text-[11px] font-medium text-neutral-500">
                {shareState}
              </p>
            )}

            {song.original_songs && song.original_songs.length > 0 && (
              <div className="rounded-lg bg-neutral-50 p-3 text-left">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  Compilation details
                </p>
                <div className="flex flex-col gap-1.5">
                  {song.original_songs.map((entry, i) => (
                    <div key={i}>
                      <p className="text-xs font-bold text-neutral-900">
                        {entry.title || "Unknown title"}
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        Original artist: {entry.artist || "Unknown"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <p className="text-center text-[11px] text-neutral-400">
          Shared links always open right here in the app — no account needed to
          listen.
        </p>
      </div>
    </main>
  );
}
