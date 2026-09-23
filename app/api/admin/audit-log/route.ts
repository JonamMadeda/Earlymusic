import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { db } from "@/lib/neon";

export async function GET(request: NextRequest) {
  const limited = checkRateLimit(request, { name: "audit-log", limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    }

    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20", 10);
    const { rows } = await db.query(
      `SELECT a.*, a.target_id AS target, u.email as actor_email
       FROM public.admin_audit_log a
       LEFT JOIN public.users u ON u.id = a.actor_id
       ORDER BY a.created_at DESC
       LIMIT $1`,
      [Math.min(limit, 200)]
    );

    return NextResponse.json({ logs: rows || [] });
  } catch (error) {
    console.error("Unable to read audit log:", error);
    return NextResponse.json({ error: "Unable to read audit log." }, { status: 500 });
  }
}
