import { hashStr, initialLetter } from "@/app/components/SongAvatar";

// Lock-screen and OS media controls need a real image URL. Tracks have no
// uploaded cover art, so the same generated identity the app shows in lists is
// drawn once to a canvas and handed to MediaSession as a PNG data URL.
const NAVY_HUES = [215, 222, 230, 240, 260, 280];
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

    const hue = NAVY_HUES[hashStr(key || "default") % NAVY_HUES.length];
    const gradient = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    gradient.addColorStop(0, `hsl(${hue}, 50%, 18%)`);
    gradient.addColorStop(1, `hsl(${hue + 20}, 45%, 28%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, SIZE, SIZE);

    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 2;
    for (const radius of [150, 190, 230]) {
      ctx.beginPath();
      ctx.arc(SIZE / 2, SIZE / 2, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = "#ffffff";
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