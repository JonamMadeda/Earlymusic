import { supabase } from "./supabaseClient";

const CACHE_NAME = "earlymusic-audio-cache-v1";

const getCache = async () => {
  if (typeof caches === "undefined") return null;
  return caches.open(CACHE_NAME);
};

/**
 * Gets a cached audio URL (blob URL) if it exists in the cache.
 * @param {string} url - The public URL of the audio file.
 * @returns {Promise<string|null>} - A blob URL or null if not cached.
 */
export const getCachedAudioUrl = async (url) => {
    if (!url) return null;
    try {
        const cache = await getCache();
        if (!cache) return null;
        const response = await cache.match(url);
        if (response) {
            const blob = await response.blob();
            return URL.createObjectURL(blob);
        }
    } catch (error) {
        console.error("Cache match error:", error);
    }
    return null;
};

/**
 * Caches an audio file using authenticated Supabase download.
 * @param {string} publicUrl - The public URL of the audio file.
 * @param {string} songPath - The song path for authenticated download.
 */
export const cacheAudioFile = async (publicUrl, songPath) => {
    if (!publicUrl || !songPath) return;
    try {
        const cache = await getCache();
        if (!cache) return;
        const existing = await cache.match(publicUrl);
        if (!existing) {
            const { data: blob, error } = await supabase.storage
                .from("songs")
                .download(songPath);
            if (error || !blob) {
                console.error("Cache audio download error:", error);
                return;
            }
            const headers = new Headers();
            headers.set("Content-Type", blob.type || "audio/mpeg");
            const response = new Response(blob, { headers });
            await cache.put(publicUrl, response);
        }
    } catch (error) {
        console.error("Cache put error:", error);
    }
};
