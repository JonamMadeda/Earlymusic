/**
 * Helpers for building + distributing per-song share links.
 *
 * Canonical share URL: `${origin}/share/<songId>`
 * Anyone opening the link lands in the app on a dedicated page for that
 * song where they can listen immediately (no login required).
 */

export function getSongShareUrl(songOrId) {
  const id =
    typeof songOrId === "string" || typeof songOrId === "number"
      ? songOrId
      : songOrId?.id;
  if (!id) return "";
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "";
  return `${origin}/share/${id}`;
}

export function getSongShareText(song) {
  if (!song) return "Listen on Luumbo";
  const title = song.title || "A song";
  const author = song.author ? ` by ${song.author}` : "";
  return `Listen to "${title}"${author} on Luumbo`;
}

export async function copyTextToClipboard(text) {
  if (!text) return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to textarea fallback
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "absolute";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}

/**
 * Share a song via the native share sheet when available,
 * otherwise copy the link to the clipboard.
 * Returns "shared" | "copied" | "failed".
 */
export async function shareSong(song) {
  const url = getSongShareUrl(song);
  if (!url) return "failed";
  const text = getSongShareText(song);
  try {
    if (navigator?.share) {
      await navigator.share({ title: text, text, url });
      return "shared";
    }
  } catch (err) {
    // User dismissing the sheet throws AbortError — not a failure.
    if (err?.name === "AbortError") return "shared";
  }
  const ok = await copyTextToClipboard(url);
  return ok ? "copied" : "failed";
}
