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
 * Caches an audio file from its public URL.
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
            const downloadResponse = await fetch(publicUrl);
            if (!downloadResponse.ok) {
                console.error("Cache audio download error:", downloadResponse.statusText);
                return;
            }
            const blob = await downloadResponse.blob();
            // Never cache empty or non-audio payloads — a poisoned cache entry
            // would make the player fail the same song on every retry.
            if (!blob.size) {
                console.error("Cache audio download error: empty payload");
                return;
            }
            if (blob.type && !blob.type.startsWith("audio")) {
                console.error("Cache audio download error: unexpected type", blob.type);
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
        if (cache) await cache.delete(publicUrl);
    } catch (error) {
        console.error("Cache evict error:", error);
    }
};
