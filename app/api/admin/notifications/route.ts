import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/adminAudit";
import { postAnnouncement } from "@/lib/announcement";
import { db } from "@/lib/neon";
import {
  BODY_MAX_LENGTH,
  MAX_NOTIFICATIONS,
  NOTIFICATION_KINDS,
  TITLE_MAX_LENGTH,
  normalizeNotificationUrl,
  type NotificationKind,
} from "@/lib/notifications";

const SELECT = `SELECT id, kind, title, body, url, created_at
                  FROM public.notifications
                 ORDER BY created_at DESC, id DESC
                 LIMIT ${MAX_NOTIFICATIONS}`;

export async function GET(request: NextRequest) {
  const limited = await checkRateLimit(request, {
    name: "admin-notifications",
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json(
        { error: "Administrator access is required." },
        { status: 403 }
      );
    }

    const { rows } = await db.query(SELECT);
    return NextResponse.json({ notifications: rows || [] });
  } catch (error) {
    console.error("Unable to read announcements:", error);
    return NextResponse.json(
      { error: "Unable to load announcements." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const limited = await checkRateLimit(request, {
    name: "admin-notifications-create",
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json(
        { error: "Administrator access is required." },
        { status: 403 }
      );
    }

    const payload = await request.json().catch(() => ({}));
    const kind = typeof payload?.kind === "string" ? payload.kind.trim() : "";
    const title = typeof payload?.title === "string" ? payload.title.trim() : "";
    const body = typeof payload?.body === "string" ? payload.body.trim() : "";

    if (!(NOTIFICATION_KINDS as readonly string[]).includes(kind)) {
      return NextResponse.json(
        { error: `Pick one of: ${NOTIFICATION_KINDS.join(", ")}.` },
        { status: 400 }
      );
    }
    if (!title) {
      return NextResponse.json({ error: "A headline is required." }, { status: 400 });
    }
    if (title.length > TITLE_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Keep the headline under ${TITLE_MAX_LENGTH} characters.` },
        { status: 400 }
      );
    }
    if (body.length > BODY_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Keep the message under ${BODY_MAX_LENGTH} characters.` },
        { status: 400 }
      );
    }

    const rawUrl = typeof payload?.url === "string" ? payload.url.trim() : "";
    const url = normalizeNotificationUrl(rawUrl);
    if (rawUrl && !url) {
      return NextResponse.json(
        { error: "Link must start with / or https://." },
        { status: 400 }
      );
    }

    // Insert plus cap enforcement lives in one place so every announcement,
    // hand-written or auto-posted by a song upload, is trimmed the same way.
    const posted = await postAnnouncement({
      kind: kind as NotificationKind,
      title,
      body,
      url,
    });
    if (!posted) {
      return NextResponse.json(
        { error: "Unable to post the announcement." },
        { status: 500 }
      );
    }
    const created = posted.announcement;

    await logAdminAction({
      actorId: admin.user.id,
      action: "notification.create",
      target: String(created.id),
      detail: { kind, title, evicted: posted.evicted },
    });

    return NextResponse.json(
      { notification: created, evicted: posted.evicted, max: MAX_NOTIFICATIONS },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unable to post announcement:", error);
    return NextResponse.json(
      { error: "Unable to post the announcement." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const limited = await checkRateLimit(request, {
    name: "admin-notifications-delete",
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json(
        { error: "Administrator access is required." },
        { status: 403 }
      );
    }

    const payload = await request.json().catch(() => ({}));
    const rawId = typeof payload?.id === "string" || typeof payload?.id === "number"
      ? String(payload.id)
      : "";
    // Digits only: Number.parseInt("1 OR 1=1") is 1, which would silently
    // delete a real row instead of refusing the request.
    if (!/^\d+$/.test(rawId)) {
      return NextResponse.json({ error: "A valid announcement id is required." }, { status: 400 });
    }
    const id = Number.parseInt(rawId, 10);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return NextResponse.json({ error: "A valid announcement id is required." }, { status: 400 });
    }

    const { rows } = await db.query(
      "DELETE FROM public.notifications WHERE id = $1 RETURNING id, title",
      [id]
    );
    if (!rows?.length) {
      return NextResponse.json({ error: "That announcement is already gone." }, { status: 404 });
    }

    await logAdminAction({
      actorId: admin.user.id,
      action: "notification.delete",
      target: String(id),
      detail: { title: rows[0].title },
    });

    return NextResponse.json({ deleted: id });
  } catch (error) {
    console.error("Unable to delete announcement:", error);
    return NextResponse.json(
      { error: "Unable to delete the announcement." },
      { status: 500 }
    );
  }
}
