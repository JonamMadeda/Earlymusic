import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/requestIp";
import { db } from "@/lib/neon";
import { LEGAL_PRIVACY_VERSION, LEGAL_TERMS_VERSION } from "@/lib/legal";

/**
 * Re-consent endpoint for signed-in users after a material policy change.
 * Stores the accepted versions and writes an audit row for each document.
 */
export async function POST(request: NextRequest) {
  const limited = await checkRateLimit(request, {
    name: "auth-accept-policies",
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { rows } = await db.query(
      `UPDATE neon_auth."user"
          SET tos_accepted_at = now(),
              privacy_accepted_at = now(),
              terms_version = $2,
              privacy_version = $3
        WHERE id = $1
        RETURNING tos_accepted_at, privacy_accepted_at, terms_version, privacy_version`,
      [user.id, LEGAL_TERMS_VERSION, LEGAL_PRIVACY_VERSION]
    );

    const ip = getClientIp(request);
    const userAgent = request.headers.get("user-agent") || null;
    try {
      await db.query(
        `INSERT INTO public.consent_log
           (user_id, kind, granted, policy_version, ip, user_agent)
         VALUES ($1, 'terms', TRUE, $2, $3, $4),
                ($1, 'privacy', TRUE, $5, $3, $4)`,
        [user.id, LEGAL_TERMS_VERSION, ip, userAgent, LEGAL_PRIVACY_VERSION]
      );
    } catch (logError) {
      console.error("Unable to write policy consent log:", logError);
    }

    return NextResponse.json({
      user: rows?.[0] || {
        tos_accepted_at: new Date().toISOString(),
        privacy_accepted_at: new Date().toISOString(),
        terms_version: LEGAL_TERMS_VERSION,
        privacy_version: LEGAL_PRIVACY_VERSION,
      },
    });
  } catch (error) {
    console.error("Unable to accept policies:", error);
    return NextResponse.json(
      { error: "Unable to record your acceptance." },
      { status: 500 }
    );
  }
}
