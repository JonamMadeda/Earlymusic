import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth";
import { logAdminAction } from "@/lib/adminAudit";
import { checkRateLimit } from "@/lib/rateLimit";
import { db } from "@/lib/neon";

export async function POST(request: NextRequest) {
  const limited = checkRateLimit(request, { name: "admin-grant", limit: 15, windowMs: 60_000 });
  if (limited) return limited;
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    }

    const { email } = await request.json();
    if (typeof email !== "string" || !email.trim()) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const { rows: users } = await db.query(
      "SELECT id, email FROM public.users WHERE email = $1",
      [normalizedEmail]
    );
    const user = users?.[0];
    if (!user) {
      return NextResponse.json({ error: "No account exists for that email address." }, { status: 404 });
    }

    await db.query(
      `INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'admin') ON CONFLICT DO NOTHING`,
      [user.id]
    );

    await logAdminAction({
      actorId: admin.user.id,
      action: "admin.grant",
      target: user.email || null,
      detail: { granted_user_id: user.id },
    });

    return NextResponse.json({ email: user.email, message: "Administrator access granted." });
  } catch (error) {
    console.error("Unable to grant administrator access:", error);
    return NextResponse.json({ error: "Unable to grant administrator access." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const limited = checkRateLimit(request, { name: "admin-list", limit: 120, windowMs: 60_000 });
  if (limited) return limited;
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    }

    const { rows: roles } = await db.query(
      `SELECT ur.user_id, ur.created_at, u.email
       FROM public.user_roles ur
       JOIN public.users u ON u.id = ur.user_id
       WHERE ur.role = 'admin'
       ORDER BY ur.created_at ASC`
    );

    return NextResponse.json({
      admins: (roles || []).map((r: any) => ({
        user_id: r.user_id,
        email: r.email || "Unknown account",
        created_at: r.created_at,
      })),
    });
  } catch (error) {
    console.error("Unable to list administrators:", error);
    return NextResponse.json({ error: "Unable to list administrators." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const limited = checkRateLimit(request, { name: "admin-revoke", limit: 15, windowMs: 60_000 });
  if (limited) return limited;
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    }

    let userId: unknown;
    try {
      ({ user_id: userId } = await request.json());
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    if (typeof userId !== "string" || !userId) {
      return NextResponse.json({ error: "An administrator id is required." }, { status: 400 });
    }
    if (userId === admin.user.id) {
      return NextResponse.json({ error: "You cannot revoke your own administrator access." }, { status: 400 });
    }

    const { rows: roles } = await db.query(
      "SELECT user_id FROM public.user_roles WHERE role = 'admin'"
    );
    if ((roles || []).length <= 1) {
      return NextResponse.json({ error: "Cannot remove the last administrator." }, { status: 400 });
    }

    // NOTE: the Neon HTTP driver returns only rows (no rowCount), so a
    // bare DELETE yields no usable count — RETURNING makes the check real.
    const { rows: deleted } = await db.query(
      "DELETE FROM public.user_roles WHERE user_id = $1 AND role = 'admin' RETURNING user_id",
      [userId]
    );
    if (!deleted?.length) {
      return NextResponse.json({ error: "Administrator not found." }, { status: 404 });
    }

    await logAdminAction({
      actorId: admin.user.id,
      action: "admin.revoke",
      target: userId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unable to revoke administrator access:", error);
    return NextResponse.json({ error: "Unable to revoke administrator access." }, { status: 500 });
  }
}
