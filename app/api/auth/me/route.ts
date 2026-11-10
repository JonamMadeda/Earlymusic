import { NextRequest, NextResponse } from "next/server";
import { getSessionValue, getUserFromRequest, setSessionCookie } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at,
        tos_accepted_at: user.tos_accepted_at,
        privacy_accepted_at: user.privacy_accepted_at,
        terms_version: user.terms_version,
        privacy_version: user.privacy_version,
        age_attested_at: user.age_attested_at,
      },
      session: { expiresAt: user.expires_at },
    });

    // The session in Neon Auth slides forward as it is used; refresh the
    // browser cookie so it expires with the session, not before it.
    const sessionValue = getSessionValue(request);
    if (sessionValue) {
      setSessionCookie(response, sessionValue, user.expires_at);
    }

    return response;
  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json(
      { error: "Unable to verify session." },
      { status: 500 }
    );
  }
}
