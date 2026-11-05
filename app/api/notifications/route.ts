import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { db } from "@/lib/neon";
import { MAX_NOTIFICATIONS } from "@/lib/notifications";

// Announcements are readable without a session on purpose: the point is to
// reach listeners who have not signed up yet, so there is no admin guard here
// and no per-user filtering below it. Writes stay behind /api/admin.
export async function GET(request: NextRequest) {
  const limited = await checkRateLimit(request, {
    name: "notifications",
    limit: 240,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const { rows } = await db.query(
      `SELECT id, kind, title, body, url, created_at
         FROM public.notifications
        ORDER BY created_at DESC, id DESC
        LIMIT $1`,
      [MAX_NOTIFICATIONS]
    );

    return NextResponse.json(
      { notifications: rows || [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (isMissingNotificationsTable(error)) {
      // lib/migration-notifications.sql has not been run yet. The bell and the
      // sidebar link read this on every page, so an empty feed beats an error
      // the listener cannot act on.
      return NextResponse.json(
        { notifications: [] },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
    console.error("Unable to read notifications:", error);
    return NextResponse.json(
      { error: "Unable to load announcements right now." },
      { status: 500 }
    );
  }
}

const isMissingNotificationsTable = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /notifications/i.test(message) && /does not exist|relation.*not found/i.test(message);
};
