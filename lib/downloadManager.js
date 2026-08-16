import { supabase } from "./supabaseClient";
import { getAudioPublicUrl } from "./audioUrl";

const CACHE_NAME = "earlymusic-audio-cache-v1";
const STORAGE_KEY = "earlymusic_downloaded_songs";

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

const setStored = (songs) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
  } catch (error) {
    console.error("Unable to persist downloads:", error);
  }
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

  const url = getAudioPublicUrl(song.song_path);

  const existing = await cache.match(url);
  if (!existing) {
    const downloadResponse = await fetch(url);
    if (!downloadResponse.ok) throw new Error("Download failed");
    const blob = await downloadResponse.blob();

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
