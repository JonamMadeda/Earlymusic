const CACHE_NAME = "earlymusic-audio-cache-v1";

/**
 * Gets a cached audio URL (blob URL) if it exists in the cache.
 * @param {string} url - The public URL of the audio file.
 * @returns {Promise<string|null>} - A blob URL or null if not cached.
 */
export const getCachedAudioUrl = async (url) => {
    if (!url) return null;
    try {
        const cache = await caches.open(CACHE_NAME);
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
 * Caches an audio file by fetching it and storing it in the Cache API.
 * @param {string} url - The public URL of the audio file.
 */
export const cacheAudioFile = async (url) => {
    if (!url) return;
    try {
        const cache = await caches.open(CACHE_NAME);
        const response = await cache.match(url);
        if (!response) {
            // Fetch and cache the file
            const fetchResponse = await fetch(url);
            if (fetchResponse.ok) {
                await cache.put(url, fetchResponse.clone());
                console.log("Cached audio:", url);
            }
        }
    } catch (error) {
        console.error("Cache put error:", error);
    }
};
