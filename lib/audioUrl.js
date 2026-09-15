export const getAudioPublicUrl = (songPath) => {
  if (!songPath) return "";
  if (/^https?:\/\//i.test(songPath)) return songPath;
  const publicBaseUrl = process.env.NEXT_PUBLIC_R2PUBLICURL || process.env.R2PUBLICURL || "";
  if (publicBaseUrl) return `${publicBaseUrl.replace(/\/$/, "")}/${songPath.replace(/^\//, "")}`;
  return songPath;
};
