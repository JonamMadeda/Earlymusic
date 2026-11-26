import Link from "next/link";
import {
  SONG_RIGHTS_ARCHIVE_NOTICE,
  SONG_RIGHTS_LABELS,
  getSongRightsStatus,
} from "@/lib/songRights";

const clearanceDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function SongRightsTag({ song, dark = false }) {
  const status = getSongRightsStatus(song?.rights_status);

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-normal leading-4 ${
        dark ? "bg-white/10 text-white/70" : "bg-neutral-100 text-neutral-600"
      }`}
    >
      {SONG_RIGHTS_LABELS[status]}
    </span>
  );
}

export default function SongRightsNotice({
  song,
  dark = false,
  compact = false,
  headingLevel = "h4",
  className = "",
  onPolicyClick = undefined,
}) {
  const Heading = headingLevel;
  const status = getSongRightsStatus(song?.rights_status);
  const licenseUrl =
    typeof song?.license_url === "string" && /^https?:\/\//i.test(song.license_url)
      ? song.license_url
      : null;
  const textClass = dark ? "text-white/60" : "text-neutral-500";
  const headingClass = dark ? "text-white/80" : "text-neutral-700";
  const borderClass = dark ? "border-white/10" : "border-neutral-100";

  return (
    <section
      aria-label="Rights and archive use"
      className={`${compact ? "px-3 py-3" : "p-3"} ${dark ? "bg-white/[0.04]" : "bg-neutral-50/80"} rounded-xl ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <SongRightsTag song={song} dark={dark} />
        <Heading className={`text-xs font-bold ${headingClass}`}>
          Rights &amp; archive use
        </Heading>
      </div>
      <p className={`mt-2 text-xs leading-relaxed ${textClass}`}>
        {SONG_RIGHTS_ARCHIVE_NOTICE}
      </p>
      {song?.rights_note && (
        <p className={`mt-2 text-xs leading-relaxed ${headingClass}`}>{song.rights_note}</p>
      )}
      {(song?.copyright_holder || song?.license_type || licenseUrl || song?.rights_clearance_date) && (
        <dl className={`mt-2 space-y-1 border-t ${borderClass} pt-2 text-xs ${textClass}`}>
          {song.copyright_holder && (
            <div>
              <dt className="inline font-semibold">Copyright: </dt>
              <dd className="inline">{song.copyright_holder}</dd>
            </div>
          )}
          {(song.license_type || licenseUrl) && (
            <div>
              <dt className="inline font-semibold">Licence: </dt>
              <dd className="inline">
                {licenseUrl ? (
                  <a
                    href={licenseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline transition hover:opacity-80"
                  >
                    {song.license_type || "View licence"}
                  </a>
                ) : (
                  song.license_type
                )}
              </dd>
            </div>
          )}
          {song.rights_clearance_date && (
            <div>
              <dt className="inline font-semibold">Cleared: </dt>
              <dd className="inline">
                {clearanceDateFormatter.format(new Date(song.rights_clearance_date))}
              </dd>
            </div>
          )}
        </dl>
      )}
      <Link
        href="/terms#content"
        onClick={onPolicyClick}
        className={`mt-2 inline-block text-xs font-semibold underline ${dark ? "text-white/75" : "text-accent"}`}
      >
        Music rights policy
      </Link>
    </section>
  );
}
