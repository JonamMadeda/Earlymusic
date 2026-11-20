import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { db } from "@/lib/neon";
import { normalizeNotificationIds } from "@/lib/notifications";

// Announcements stay public; the *state* of what a listener has read is not.
// The client keeps a local cache for signed-out listeners and syncs this row
// once authenticated. A missing migration must not break the feed, so reads
// fall back to empty state and writes report success without persisting.

const EMPTY_STATE = {
  seenAt: null,
  dismissedIds: [],
  readIds: [],
  nudge: {},
  preferences: {},
};

// Announcement ids are bigserial, so Neon returns them as strings. Keeping the
// same normalisation as the client stops the server from silently dropping
// every read/dismissal id on its way to Postgres.
const asIdList = (value: unknown): (number | string)[] => normalizeNotificationIds(value);

const asBlob = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  try {
    const text = JSON.stringify(value);
    // A stale tab must not be able to write an unbounded object to Postgres.
    if (text.length > 4000) return {};
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
};

const asTime = (value: unknown): string | null =>
  typeof value === "string" && value.length <= 40 && !Number.isNaN(Date.parse(value))
    ? value
    : null;

const missingTable = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /notification_state/i.test(message) && /does not exist|relation.*not found/i.test(message);
};

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const { rows } = await db.query(
      `SELECT seen_at, dismissed_ids, read_ids, nudge, preferences
         FROM public.notification_state WHERE user_id = $1`,
      [user.id]
    );
    const row = rows?.[0];
    return NextResponse.json({
      state: row
        ? {
            seenAt: row.seen_at || null,
            dismissedIds: asIdList(row.dismissed_ids),
            readIds: asIdList(row.read_ids),
            nudge: asBlob(row.nudge),
            preferences: asBlob(row.preferences),
          }
        : EMPTY_STATE,
    });
  } catch (error) {
    if (missingTable(error)) return NextResponse.json({ state: EMPTY_STATE });
    console.error("Unable to read notification state:", error);
    return NextResponse.json({ error: "Unable to read notification state." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const limited = await checkRateLimit(request, {
    name: "notification-state-save",
    limit: 60,
    windowMs: 60_000,
    key: user.id,
  });
  if (limited) return limited;

  const payload = await request.json().catch(() => ({}));
  const state = {
    seenAt: asTime(payload?.seenAt),
    dismissedIds: asIdList(payload?.dismissedIds),
    readIds: asIdList(payload?.readIds),
    nudge: asBlob(payload?.nudge),
    preferences: asBlob(payload?.preferences),
  };

  try {
    await db.query(
      `INSERT INTO public.notification_state
         (user_id, seen_at, dismissed_ids, read_ids, nudge, preferences, updated_at)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         seen_at = EXCLUDED.seen_at,
         dismissed_ids = EXCLUDED.dismissed_ids,
         read_ids = EXCLUDED.read_ids,
         nudge = EXCLUDED.nudge,
         preferences = EXCLUDED.preferences,
         updated_at = NOW()`,
      [
        user.id,
        state.seenAt,
        JSON.stringify(state.dismissedIds),
        JSON.stringify(state.readIds),
        JSON.stringify(state.nudge),
        JSON.stringify(state.preferences),
      ]
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (missingTable(error)) return NextResponse.json({ ok: true, persisted: false });
    console.error("Unable to save notification state:", error);
    return NextResponse.json({ error: "Unable to save notification state." }, { status: 500 });
  }
}
