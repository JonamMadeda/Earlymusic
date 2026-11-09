"use client";

import { useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, ListPlus, ListX, X } from "lucide-react";
import SongAvatar from "./SongAvatar";
import { formatTime, sumDurations, toSeconds } from "@/lib/timeFormat";

/**
 * The now-playing queue. Rows stay tappable to jump to a track; the trailing
 * actions edit what plays next without disturbing the current song.
 */
const PlayerQueue = ({
  songs,
  currentSongId,
  isPlaying,
  editable,
  onSelect,
  onPlayNext,
  onRemove,
  onMove,
  onClear,
}) => {
  const listRef = useRef(null);
  const { seconds, known, total } = sumDurations(songs);

  // Opening the queue used to land at the top of the library while the playing
  // track sat hundreds of rows down.
  useEffect(() => {
    const current = listRef.current?.querySelector('[data-current="true"]');
    current?.scrollIntoView({ block: "center", behavior: "auto" });
  }, [currentSongId]);

  const actionClass =
    "flex h-8 w-8 items-center justify-center rounded-full text-neutral-300 transition hover:bg-neutral-100 hover:text-neutral-700";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-neutral-200 pb-2.5">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-700">
            Queue ({total})
          </p>
          {known > 0 && (
            <p className="mt-0.5 truncate text-[11px] text-neutral-500">
              {formatTime(seconds)}
              {known < total ? ` of ${total} tracks timed` : " total"}
            </p>
          )}
        </div>
        {editable && total > 1 && (
          <button
            type="button"
            onClick={onClear}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5 text-[11px] font-semibold text-neutral-600 transition hover:bg-neutral-200"
          >
            <ListX size={13} />
            Clear
          </button>
        )}
      </div>

      {total === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-16 text-neutral-300">
          <ListX size={26} strokeWidth={1.5} />
          <p className="mt-3 text-[13px] font-medium text-neutral-400">
            Nothing queued. Pick a song to start.
          </p>
        </div>
      ) : (
        <div
          ref={listRef}
          className="custom-scrollbar flex-1 space-y-1.5 overflow-y-auto pr-1 pt-2"
        >
          {songs.map((item, index) => {
            const isCurrent = item.id === currentSongId;
            const secondsValue = toSeconds(item.duration);
            return (
              <div
                key={item.id ?? index}
                data-current={isCurrent ? "true" : undefined}
                className={`flex items-center gap-1 rounded-xl p-1 transition ${
                  isCurrent
                    ? "border border-neutral-200 bg-neutral-100 shadow-sm"
                    : "border border-transparent hover:bg-neutral-50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  aria-current={isCurrent ? "true" : undefined}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  <span className="w-5 shrink-0 text-center text-xs text-neutral-500">
                    {index + 1}
                  </span>
                  <SongAvatar title={item.title} size="sm" variant="mono" />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-xs ${
                        isCurrent ? "font-bold text-neutral-900" : "font-semibold text-neutral-900"
                      }`}
                    >
                      {item.title}
                    </span>
                    <span className="block truncate text-[11px] text-neutral-500">
                      {item.author}
                      {secondsValue != null && ` · ${formatTime(secondsValue)}`}
                    </span>
                  </span>
                  {isCurrent && isPlaying && (
                    <span className="waveform flex h-3.5 items-center text-accent" aria-hidden="true">
                      <span /><span /><span /><span />
                    </span>
                  )}
                </button>

                {editable && (
                  <span className="flex shrink-0 items-center">
                    <button
                      type="button"
                      aria-label={`Move ${item.title} up`}
                      disabled={index === 0}
                      onClick={() => onMove(index, index - 1)}
                      className={`${actionClass} disabled:opacity-30 disabled:hover:bg-transparent`}
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${item.title} down`}
                      disabled={index === songs.length - 1}
                      onClick={() => onMove(index, index + 1)}
                      className={`${actionClass} disabled:opacity-30 disabled:hover:bg-transparent`}
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Play ${item.title} next`}
                      onClick={() => onPlayNext(item)}
                      className={actionClass}
                    >
                      <ListPlus size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${item.title} from the queue`}
                      disabled={isCurrent}
                      onClick={() => onRemove(item.id)}
                      className={`${actionClass} disabled:opacity-30 disabled:hover:bg-transparent`}
                    >
                      <X size={14} />
                    </button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PlayerQueue;