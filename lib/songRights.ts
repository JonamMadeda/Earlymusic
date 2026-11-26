export const SONG_RIGHTS_STATUSES = [
  "church_original",
  "third_party",
  "public_domain",
  "unknown",
] as const;

export type SongRightsStatus = (typeof SONG_RIGHTS_STATUSES)[number];

export const SONG_RIGHTS_LABELS: Record<SongRightsStatus, string> = {
  church_original: "Luumbo Original",
  third_party: "Third-party song",
  public_domain: "Public-domain hymn",
  unknown: "Archive recording",
};

export const SONG_RIGHTS_ARCHIVE_NOTICE =
  "Luumbo archives live worship recordings so church members and followers can revisit the service. Luumbo does not claim ownership of third-party songs; those rights remain with their respective rights holders. These recordings are not sold or offered for commercial redistribution by Luumbo.";

export const normalizeSongRightsStatus = (value: unknown): SongRightsStatus | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return SONG_RIGHTS_STATUSES.includes(normalized as SongRightsStatus)
    ? (normalized as SongRightsStatus)
    : null;
};

export const getSongRightsStatus = (value: unknown): SongRightsStatus =>
  normalizeSongRightsStatus(value) || "unknown";

export const getSongRightsLabel = (value: unknown): string =>
  SONG_RIGHTS_LABELS[getSongRightsStatus(value)];
