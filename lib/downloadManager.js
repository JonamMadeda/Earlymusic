import { supabase } from "./supabaseClient";

const CACHE_NAME = "earlymusic-audio-cache-v1";
const STORAGE_KEY = "earlymusic_downloaded_songs";

const getPublicUrl = (songPath) => {
  const { data } = supabase.storage.from("songs").getPublicUrl(songPath);
  return data.publicUrl;
};

const getCache = async () => {
  if (typeof caches === "undefined") return null;
  return caches.open(CACHE_NAME);
};

const getStored = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const setStored = (songs) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
};

export const getStorageEstimate = async () => {
  if (!navigator.storage || !navigator.storage.estimate) {
    return null;
  }
  const { usage, quota } = await navigator.storage.estimate();
  return { usage, quota, available: quota - usage };
};

export const downloadSong = async (song) => {
  const cache = await getCache();
  if (!cache) return;

  const estimate = await getStorageEstimate();
  if (estimate && estimate.available < 1_048_576) {
    throw new Error("Storage is full");
  }

  const url = getPublicUrl(song.song_path);

  const existing = await cache.match(url);
  if (!existing) {
    const { data: blob, error } = await supabase.storage
      .from("songs")
      .download(song.song_path);

    if (error || !blob) throw new Error(error?.message || "Download failed");

    const headers = new Headers();
    headers.set("Content-Type", blob.type || "audio/mpeg");
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
      await cache.delete(getPublicUrl(song.song_path));
    }
    setStored(stored.filter((s) => s.id !== songId));
  }
};

export const getDownloadedSongs = () => getStored();

export const isSongDownloaded = (songId) => {
  return !!getStored().find((s) => s.id === songId);
};

export const getDownloadCount = () => getStored().length;

export const getLocalAudioUrl = async (songPath) => {
  const cache = await getCache();
  if (!cache) return null;

  const response = await cache.match(getPublicUrl(songPath));
  if (!response) return null;

  const blob = await response.blob();
  return URL.createObjectURL(blob);
};
