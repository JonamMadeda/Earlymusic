import { NextRequest, NextResponse } from "next/server";
import { hashPassword, getUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/neon";
import { checkRateLimit } from "@/lib/rateLimit";

export async function PATCH(request: NextRequest) {
  const limited = checkRateLimit(request, { name: "auth-update-pw", limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { password } = await request.json();
    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    await db.query("UPDATE public.users SET password_hash = $1 WHERE id = $2", [passwordHash, user.id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Password update error:", error);
    return NextResponse.json({ error: "Unable to update password." }, { status: 500 });
  }
}
