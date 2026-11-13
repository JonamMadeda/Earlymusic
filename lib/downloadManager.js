import { getAudioPublicUrl } from "./audioUrl";

const CACHE_NAME = "lumbo-audio-cache-v1";
const STORAGE_KEY = "lumbo_downloaded_songs";
const PENDING_CLEAR_PREFIX = "lumbo_download_clear:";
export const DOWNLOAD_UNDO_MS = 8000;

const getCache = async () => {
  if (typeof caches === "undefined") return null;
  return caches.open(CACHE_NAME);
};

const getStored = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const notifyChanged = () => {
  try {
    window.dispatchEvent(new CustomEvent("downloads:changed"));
  } catch {}
};

const setStored = (songs) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
  } catch (error) {
    console.error("Unable to persist downloads:", error);
  }
  notifyChanged();
};

/**
 * Badges and offline lists live in several components at once. Subscribe so a
 * download or removal anywhere (including another tab) updates all of them.
 * Returns an unsubscribe function.
 */
export const onDownloadsChanged = (listener) => {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener("downloads:changed", listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("downloads:changed", listener);
    window.removeEventListener("storage", onStorage);
  };
};

export const getStorageEstimate = async () => {
  if (!navigator.storage || !navigator.storage.estimate) {
    return null;
  }
  const { usage, quota } = await navigator.storage.estimate();
  return { usage, quota, available: quota - usage };
};

export const downloadSong = async (song) => {
  if (song?.download_allowed === false) {
    throw new Error("This track is licensed for streaming only.");
  }
  const cache = await getCache();
  if (!cache) throw new Error("Offline downloads are not supported in this browser.");

  const estimate = await getStorageEstimate();
  if (estimate && estimate.available < 1_048_576) {
    throw new Error("Storage is full");
  }

  const url = getAudioPublicUrl(song.song_path);

  const existing = await cache.match(url);
  // A streamed copy may already sit in this cache. Re-store it with the offline
  // marker so the service worker's trimming can't evict a track the listener
  // explicitly asked to keep.
  if (!existing || !existing.headers.get("x-luumbo-download")) {
    let blob;
    if (existing) {
      blob = await existing.blob();
    } else {
      const downloadResponse = await fetch(url);
      if (!downloadResponse.ok) throw new Error("Download failed");
      blob = await downloadResponse.blob();
    }
    if (!blob.size) throw new Error("Download failed");

    const headers = new Headers();
    headers.set("Content-Type", blob.type || "audio/mpeg");
    headers.set("x-luumbo-download", "1");
    const response = new Response(blob, { headers });

    try {
      await cache.put(url, response);
    } catch (err) {
      if (err.name === "QuotaExceededError") {
        throw new Error("Storage is full");
      }
      throw err;
    }
  }

  const stored = getStored();
  if (!stored.find((s) => s.id === song.id)) {
    stored.push({
      id: song.id,
      title: song.title,
      author: song.author,
      song_path: song.song_path,
      downloadedAt: new Date().toISOString(),
    });
    setStored(stored);
  }
};

export const removeDownload = async (songId) => {
  const stored = getStored();
  const song = stored.find((s) => s.id === songId);
  if (song) {
    const cache = await getCache();
    if (cache) {
      await cache.delete(getAudioPublicUrl(song.song_path));
    }
    setStored(stored.filter((s) => s.id !== songId));
  }
};

export const getDownloadedSongs = () => getStored();

export const isSongDownloaded = (songId) => {
  return !!getStored().find((s) => s.id === songId);
};

export const getDownloadCount = () => getStored().length;

// Cache keys are absolute URLs while stored song paths may be relative, so
// comparisons normalize both against the current origin.
const absoluteUrl = (url) => {
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return url;
  }
};

const pendingClearKeys = () =>
  Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
    .filter((key) => key?.startsWith(PENDING_CLEAR_PREFIX));

const readPendingClear = (id) => {
  try {
    const pending = JSON.parse(localStorage.getItem(id) || "null");
    return pending && Number.isFinite(pending.expiresAt) && Array.isArray(pending.urls)
      ? pending
      : null;
  } catch {
    return null;
  }
};

const protectedDownloadUrls = () => {
  const urls = new Set(getStored().map((song) => absoluteUrl(getAudioPublicUrl(song.song_path))));
  for (const key of pendingClearKeys()) {
    const pending = readPendingClear(key);
    if (pending?.expiresAt > Date.now()) {
      for (const url of pending.urls) urls.add(url);
    } else {
      localStorage.removeItem(key);
    }
  }
  return urls;
};

export const clearPendingDownloadClears = () => {
  for (const key of pendingClearKeys()) localStorage.removeItem(key);
};

export const stageClearDownloads = () => {
  const snapshot = {
    id: `${PENDING_CLEAR_PREFIX}${crypto.randomUUID()}`,
    expiresAt: Date.now() + DOWNLOAD_UNDO_MS,
    songs: getStored(),
  };
  // Publish protection before hiding the list so another tab cannot prune it.
  localStorage.setItem(snapshot.id, JSON.stringify({
    expiresAt: snapshot.expiresAt,
    urls: snapshot.songs.map((song) => absoluteUrl(getAudioPublicUrl(song.song_path))),
  }));
  setStored([]);
  return snapshot;
};

export const undoClearDownloads = (snapshot) => {
  const pending = readPendingClear(snapshot.id);
  if (!pending || pending.expiresAt <= Date.now()) return false;
  const merged = [...getStored()];
  for (const song of snapshot.songs) {
    if (!merged.find((s) => s.id === song.id)) merged.push(song);
  }
  setStored(merged);
  localStorage.removeItem(snapshot.id);
  return true;
};

export const commitClearDownloads = async (snapshot) => {
  // Sign-out invalidation removes the marker; a stale commit must not delete
  // audio the next account downloaded since.
  if (!localStorage.getItem(snapshot.id)) return;
  localStorage.removeItem(snapshot.id);
  const cache = await getCache();
  if (!cache) return;
  for (const song of snapshot.songs) {
    const url = absoluteUrl(getAudioPublicUrl(song.song_path));
    if (!protectedDownloadUrls().has(url)) await cache.delete(url);
  }
};

export const pruneOrphanedDownloads = async () => {
  const cache = await getCache();
  if (!cache) return;
  const requests = await cache.keys();
  for (const request of requests) {
    const response = await cache.match(request);
    if (response?.headers.get("x-luumbo-download") && !protectedDownloadUrls().has(request.url)) {
      await cache.delete(request);
    }
  }
};
