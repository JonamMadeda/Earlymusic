import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/requestIp";
import { db } from "@/lib/neon";
import { LEGAL_PRIVACY_VERSION } from "@/lib/legal";

/**
 * Records a consent choice server-side. The analytics choice still lives in
 * localStorage (so the app can honour it without a round trip), but this
 * append-only row is the evidence trail the Privacy Policy describes.
 */
export async function POST(request: NextRequest) {
  const limited = await checkRateLimit(request, {
    name: "consent-log",
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const body = await request.json().catch(() => ({}));
    const kind = body.kind === "analytics" ? "analytics" : null;
    if (!kind) {
      return NextResponse.json(
        { error: "Unsupported consent kind." },
        { status: 400 }
      );
    }
    if (typeof body.granted !== "boolean") {
      return NextResponse.json(
        { error: "A granted boolean is required." },
        { status: 400 }
      );
    }

    const user = await getUserFromRequest(request).catch(() => null);
    const policyVersion =
      typeof body.policy_version === "string" && body.policy_version.trim()
        ? body.policy_version.trim().slice(0, 40)
        : LEGAL_PRIVACY_VERSION;

    try {
      await db.query(
        `INSERT INTO public.consent_log
           (user_id, kind, granted, policy_version, ip, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          user?.id || null,
          kind,
          body.granted,
          policyVersion,
          getClientIp(request),
          request.headers.get("user-agent") || null,
        ]
      );
    } catch (logError) {
      // The local choice is still authoritative for this device; do not make
      // the consent UI fail just because the audit table is unavailable.
      console.error("Unable to write consent log:", logError);
      return NextResponse.json({ ok: true, recorded: false });
    }

    return NextResponse.json({ ok: true, recorded: true });
  } catch (error) {
    console.error("Consent logging failed:", error);
    return NextResponse.json(
      { error: "Unable to record consent." },
      { status: 500 }
    );
  }
}
