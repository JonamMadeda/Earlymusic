import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/neon";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
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
