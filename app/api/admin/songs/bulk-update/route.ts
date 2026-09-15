import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { db } from "@/lib/neon";

export async function PATCH(request: NextRequest) {
  const limited = checkRateLimit(request, { name: "songs-bulk-update", limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    }

    const { ids, patch } = await request.json();
    if (!Array.isArray(ids) || !ids.length || !patch || typeof patch !== "object") {
      return NextResponse.json({ error: "ids array and patch object required." }, { status: 400 });
    }

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    for (const [key, val] of Object.entries(patch)) {
      if (["category", "duration", "title", "author"].includes(key)) {
        fields.push(`${key} = $${idx}`);
        values.push(val);
        idx++;
      }
    }
    if (!fields.length) {
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
    }

    values.push(ids);
    const { rowCount } = await db.query(
      `UPDATE public.songs SET ${fields.join(", ")} WHERE id = ANY($${idx})`,
      values
    );

    return NextResponse.json({ updated: rowCount });
  } catch (error) {
    console.error("Unable to bulk update songs:", error);
    return NextResponse.json({ error: "Unable to update songs." }, { status: 500 });
  }
}
