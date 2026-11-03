import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/neon";
import { getUserFromRequest } from "@/lib/auth";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const cleanName = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 80);
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ first_name: null, last_name: null });
    }
    // A profile is private to its owner. The previous version let any
    // signed-in user read any name by UUID (an IDOR).
    if (user.id !== id) {
      return NextResponse.json(
        { error: "Cannot read another user's profile." },
        { status: 403 }
      );
    }

    const result = await db.query(
      "SELECT first_name, last_name FROM public.profiles WHERE id = $1",
      [id]
    );
    if (!result.rows?.length) {
      return NextResponse.json({ first_name: null, last_name: null });
    }
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("Unable to read profile:", error);
    return NextResponse.json(
      { error: "Unable to read profile." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { id } = await params;
    if (user.id !== id) {
      return NextResponse.json({ error: "Cannot update another user's profile." }, { status: 403 });
    }

    const body = await request.json();
    const first_name = cleanName(body?.first_name);
    const last_name = cleanName(body?.last_name);
    await db.query(
      `INSERT INTO public.profiles (id, first_name, last_name, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (id) DO UPDATE SET first_name = $2, last_name = $3, updated_at = now()`,
      [id, first_name, last_name]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unable to update profile:", error);
    return NextResponse.json({ error: "Unable to update profile." }, { status: 500 });
  }
}
