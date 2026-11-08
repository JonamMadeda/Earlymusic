/**
 * Single source of truth for the legal pages and the footer.
 *
 * The contact address is deployment configuration, not a hard-coded string:
 * set NEXT_PUBLIC_LEGAL_EMAIL in the environment (Vercel project settings or
 * .env.local) to the inbox that actually receives DMCA notices and privacy
 * requests. The fallback is the project's production domain so the pages never
 * render a reserved `.example` address that silently swallows mail.
 */
export const LEGAL_EMAIL =
  process.env.NEXT_PUBLIC_LEGAL_EMAIL || "legal@luumbo.vercel.app";

export const LEGAL_MAILTO = `mailto:${LEGAL_EMAIL}`;

/** First version of the published policies. */
export const LEGAL_EFFECTIVE_DATE = "November 7, 2026";

/**
 * Bump this whenever the wording changes materially. Both pages render it so a
 * reader can tell whether they have already seen the current version.
 */
export const LEGAL_LAST_UPDATED = "November 9, 2026";
