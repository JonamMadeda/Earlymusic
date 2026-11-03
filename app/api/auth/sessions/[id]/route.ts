import { NextRequest, NextResponse } from "next/server";
import {
  getUserFromRequest,
  revokeSession,
  clearSessionCookie,
} from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { logAuthEvent } from "@/lib/authAudit";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await checkRateLimit(request, {
    name: "auth-session-revoke",
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid session." }, { status: 400 });
    }

    const isCurrent = id === user.session_id;
    await revokeSession(id, user.id);
    await logAuthEvent(request, "session_revoked", {
      userId: user.id,
      email: user.email,
      detail: { sessionId: id, current: isCurrent },
    });

    const response = NextResponse.json({ success: true, current: isCurrent });
    if (isCurrent) clearSessionCookie(response);
    return response;
  } catch (error) {
    console.error("Unable to revoke session:", error);
    return NextResponse.json(
      { error: "Unable to revoke session." },
      { status: 500 }
    );
  }
}
