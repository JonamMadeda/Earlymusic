/**
 * Audio health verification for admin tooling.
 *
 * result.error classes:
 * - "http"    — storage answered with a failing status (definitive: broken)
 * - "network" — the browser couldn't reach storage at all (CORS/offline);
 *               NOT proof the file is broken, reported separately as unknown
 * - "missing" — the song has no file path stored
 */

export const verifyAudioUrl = async (url) => {
  if (!url) return { ok: false, status: null, error: "missing" };

  const attempt = async (init) => {
    const res = await fetch(url, init);
    // Drain the body so connections can't leak.
    await res.arrayBuffer().catch(() => {});
    return res;
  };

  try {
    let res;
    try {
      res = await attempt({ method: "HEAD" });
    } catch {
      // Some hosts reject HEAD — fall back to a 1-byte range read.
      res = await attempt({ headers: { Range: "bytes=0-0" } });
    }
    if (res.ok) return { ok: true, status: res.status, error: null };
    return { ok: false, status: res.status, error: "http" };
  } catch {
    return { ok: false, status: null, error: "network" };
  }
};

/** Summarise a results map ({ [songId]: verifyAudioUrl result }). */
export const summarizeHealth = (results = {}) => {
  const entries = Object.values(results);
  return {
    checked: entries.length,
    healthy: entries.filter((r) => r.ok).length,
    broken: entries.filter((r) => !r.ok && r.error === "http").length,
    unknown: entries.filter((r) => !r.ok && r.error !== "http").length,
  };
};
