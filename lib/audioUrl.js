import { supabase } from "./supabaseClient";

export const getAudioPublicUrl = (songPath) => {
  if (/^https?:\/\//i.test(songPath)) return songPath;

  const { data } = supabase.storage.from("songs").getPublicUrl(songPath);
  return data.publicUrl;
};
