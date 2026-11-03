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

// The display name lives in neon_auth.user.name; the account screen still
// edits it as a first/last pair.
const splitName = (name: string | null, email?: string | null) => {
  const trimmed = (name || "").trim();
  if (!trimmed) return { first_name: null, last_name: null };
  // Accounts registered before the sign-up form asked for a name were given
  // the email's local part as their display name. That is not a name to
  // greet someone with, so it reads back as "no name yet".
  const localPart = (email || "").split("@")[0].trim();
  if (
    localPart &&
    !trimmed.includes(" ") &&
    trimmed.toLowerCase() === localPart.toLowerCase()
  ) {
    return { first_name: null, last_name: null };
  }
  const separator = trimmed.indexOf(" ");
  if (separator === -1) return { first_name: trimmed, last_name: null };
  return {
    first_name: trimmed.slice(0, separator),
    last_name: trimmed.slice(separator + 1).trim() || null,
  };
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
      "SELECT name, email FROM neon_auth.user WHERE id = $1",
      [id]
    );
    if (!result.rows?.length) {
      return NextResponse.json({ first_name: null, last_name: null });
    }
    return NextResponse.json(
      splitName(result.rows[0].name, result.rows[0].email)
    );
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
    const name = [first_name, last_name].filter(Boolean).join(" ");

    await db.query(
      `UPDATE neon_auth.user
       SET name = $2, "updatedAt" = now()
       WHERE id = $1`,
      [id, name]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unable to update profile:", error);
    return NextResponse.json(
      { error: "Unable to update profile." },
      { status: 500 }
    );
  }
}
