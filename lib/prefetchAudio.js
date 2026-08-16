import { getAudioPublicUrl } from "./audioUrl";

const prefetched = new Set();

export const prefetchSongAudio = (song) => {
  if (!song?.song_path || prefetched.has(song.id)) return;

  try {
    const url = getAudioPublicUrl(song.song_path);
    if (!url) return;

    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = url;
    link.as = "audio";
    link.onload = () => link.remove();
    link.onerror = () => link.remove();
    document.head.appendChild(link);

    prefetched.add(song.id);
  } catch {
    // silently ignore prefetch failures
  }
};