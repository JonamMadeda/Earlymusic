const CACHE_NAME = "lumbo-audio-cache-v1";

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
 * Removes a cached audio entry (e.g. after it proves unplayable) so the
 * player can fall back to streaming the network URL instead of failing
 * on the same bad copy on every retry.
 * @param {string} publicUrl - The public URL whose cache entry should go.
 */
export const evictCachedAudio = async (publicUrl) => {
    if (!publicUrl) return;
    try {
        const cache = await getCache();
        if (!cache) return;
        const existing = await cache.match(publicUrl);
        // Explicit downloads are tracked in localStorage; evicting one on a
        // transient error would leave the Downloads list claiming a missing file.
        if (existing?.headers.get("x-luumbo-download")) return;
        await cache.delete(publicUrl);
    } catch (error) {
        console.error("Cache evict error:", error);
    }
};
