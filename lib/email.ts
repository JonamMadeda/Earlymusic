type SendEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

const RESEND_API_URL = "https://api.resend.com/emails";
const REQUEST_TIMEOUT_MS = 10_000;

export const isEmailConfigured = (): boolean =>
  Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

/**
 * Outbound email via the Resend HTTP API — no SDK dependency.
 *
 * Without RESEND_API_KEY there is nothing to send through, so in
 * development the message is logged instead and reported as delivered;
 * that keeps the reset flow testable locally. Production fails loudly
 * rather than silently dropping a link a user is waiting on.
 */
export const sendEmail = async ({
  to,
  subject,
  text,
  html,
}: SendEmail): Promise<boolean> => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "Email is not configured: RESEND_API_KEY and EMAIL_FROM are required."
      );
      return false;
    }
    console.info(
      [
        "[email] RESEND_API_KEY/EMAIL_FROM not set — not sent.",
        `  to:      ${to}`,
        `  subject: ${subject}`,
        `  body:    ${text.split("\n").join("\n            ")}`,
      ].join("\n")
    );
    return true;
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, text, html }),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(
        "Resend rejected the message:",
        response.status,
        (await response.text()).slice(0, 500)
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error("Unable to send email:", error);
    return false;
  }
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * The reset link is rendered into both the href and the anchor text, so it
 * is escaped; the token itself is URL-safe but nothing here should depend
 * on that.
 */
export const passwordResetEmail = ({
  to,
  name,
  link,
  minutes = 30,
}: {
  to: string;
  name: string | null;
  link: string;
  minutes?: number;
}): SendEmail => {
  const greeting = name ? `Hi ${name},` : "Hi,";
  const safeLink = escapeHtml(link);

  return {
    to,
    subject: "Reset your Luumbo password",
    text: [
      `${greeting}`,
      "",
      "Someone asked to reset the password for your Luumbo account.",
      "",
      `Open this link within ${minutes} minutes to choose a new password:`,
      link,
      "",
      "If you did not ask for this, you can ignore this email — your",
      "password stays unchanged.",
    ].join("\n"),
    html: [
      `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#171717">`,
      `<h2 style="margin:0 0 16px;font-size:18px">Luumbo password reset</h2>`,
      `<p style="margin:0 0 16px;font-size:14px;line-height:1.6">${escapeHtml(greeting)}</p>`,
      `<p style="margin:0 0 20px;font-size:14px;line-height:1.6">Someone asked to reset the password for your Luumbo account.</p>`,
      `<p style="margin:0 0 12px;font-size:14px">This link expires in ${minutes} minutes and works once.</p>`,
      `<p style="margin:0 0 24px">`,
      `<a href="${safeLink}" style="display:inline-block;background:#171717;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-size:14px;font-weight:700">Reset password</a>`,
      `</p>`,
      `<p style="margin:0 0 8px;font-size:12px;color:#737373;word-break:break-all">Or paste this link into your browser:<br><a href="${safeLink}" style="color:#737373">${safeLink}</a></p>`,
      `<p style="margin:20px 0 0;font-size:12px;color:#737373;line-height:1.6">If you did not ask for this, you can ignore this email — your password stays unchanged.</p>`,
      `</div>`,
    ].join(""),
  };
};
