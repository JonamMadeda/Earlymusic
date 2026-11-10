/**
 * Country detection for territory-limited tracks.
 *
 * Vercel sets `x-vercel-ip-country`; Cloudflare sets `cf-ipcountry`. When
 * neither is present (local development, a self-hosted deployment without a
 * geo proxy) the country is unknown and region checks fail open — a track is
 * not hidden from every listener just because the edge cannot tell us where
 * they are. Configure the proxy header before relying on territory licences.
 */
export function getCountryFromHeaders(headersLike) {
  if (!headersLike?.get) return null;
  const raw =
    headersLike.get("x-vercel-ip-country") ||
    headersLike.get("cf-ipcountry") ||
    "";
  const country = String(raw).trim().toUpperCase();
  return /^[A-Z]{2}$/.test(country) ? country : null;
}

export function isRegionAllowed(song, country) {
  if (!song?.region_restricted) return true;
  // No geo signal: fail open rather than making the library disappear.
  if (!country) return true;
  const allowed = Array.isArray(song.allowed_countries)
    ? song.allowed_countries
    : [];
  if (allowed.length === 0) return false;
  return allowed.some(
    (code) => String(code).trim().toUpperCase() === country
  );
}
