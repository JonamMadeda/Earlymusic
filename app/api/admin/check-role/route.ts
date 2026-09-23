import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/neon";

export async function GET(request: NextRequest) {
  try {
    // Authenticated endpoint: callers may only query their own status,
    // unless they are themselves an administrator.
    const caller = await getUserFromRequest(request);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const userId = request.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }
    if (userId !== caller.id) {
      const callerAdmin = await db.query(
        "SELECT role FROM public.user_roles WHERE user_id = $1 AND role = 'admin'",
        [caller.id]
      );
      if (!callerAdmin.rows?.length) {
        return NextResponse.json({ error: "Not authorized." }, { status: 403 });
      }
    }

    const result = await db.query(
      "SELECT role FROM public.user_roles WHERE user_id = $1 AND role = 'admin'",
      [userId]
    );
    return NextResponse.json({ admin: result.rows?.length > 0 });
  } catch {
    return NextResponse.json({ admin: false });
  }
}
