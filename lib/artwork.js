import { initialLetter } from "@/app/components/SongAvatar";

// Lock-screen and OS media controls need a real image URL. Tracks have no
// uploaded cover art, so the app draws its white/accent avatar treatment once
// to a canvas and hands it to MediaSession as a PNG data URL.
const SIZE = 512;
const MAX_CACHE_ENTRIES = 24;
const cache = new Map();

export const getSongArtwork = (title) => {
  if (typeof document === "undefined") return null;
  const key = String(title || "");
  if (cache.has(key)) return cache.get(key);

  try {
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, SIZE, SIZE);

    ctx.strokeStyle = "rgba(15,23,42,0.08)";
    ctx.lineWidth = 2;
    for (const radius of [150, 190, 230]) {
      ctx.beginPath();
      ctx.arc(SIZE / 2, SIZE / 2, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 240px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initialLetter(key), SIZE / 2, SIZE / 2 + 12);

    const url = canvas.toDataURL("image/png");
    // Each entry is a base64 PNG, so the map is bounded rather than growing
    // for every track a long listening session touches.
    if (cache.size >= MAX_CACHE_ENTRIES) cache.clear();
    cache.set(key, url);
    return url;
  } catch {
    return null;
  }
};