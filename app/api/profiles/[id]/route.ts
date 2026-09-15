import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/neon";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await db.query(
      "SELECT first_name, last_name FROM public.profiles WHERE id = $1",
      [id]
    );
    if (!result.rows?.length) {
      return NextResponse.json({ first_name: null, last_name: null });
    }
    return NextResponse.json(result.rows[0]);
  } catch {
    return NextResponse.json({ first_name: null, last_name: null });
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

    const { first_name, last_name } = await request.json();
    await db.query(
      `INSERT INTO public.profiles (id, first_name, last_name, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (id) DO UPDATE SET first_name = $2, last_name = $3, updated_at = now()`,
      [id, first_name || null, last_name || null]
    );
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unable to update profile." }, { status: 500 });
  }
}
