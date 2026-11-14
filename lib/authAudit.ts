import type { NextRequest } from "next/server";
import { db } from "./neon";
import { getClientIp } from "./requestIp";

export type AuthEvent =
  | "login_success"
  | "login_failed"
  | "register_success"
  | "register_failed"
  | "register_exists"
  | "signout"
  | "signout_all"
  | "password_changed"
  | "password_change_failed"
  | "password_reset_requested"
  | "password_reset_completed"
  | "password_reset_failed"
  | "session_revoked"
  | "account_deleted";

/**
 * The trail answers "what happened this week", not "where has this person
 * signed in from, ever". Ninety days of IP addresses and user agents is
 * enough to investigate an incident without keeping a permanent record.
 */
export const AUTH_EVENTS_RETENTION_DAYS = 90;

const purgeExpiredEvents = async (): Promise<void> => {
  try {
    await db.query(
      `DELETE FROM public.auth_events WHERE created_at < now() - $1::interval`,
      [`${AUTH_EVENTS_RETENTION_DAYS} days`]
    );
  } catch (error) {
    console.error("Unable to purge old auth events:", error);
  }
};

/**
 * Append-only auth audit trail. Never store passwords or raw tokens here;
 * `detail` is for non-sensitive context only.
 *
 * Logging is best-effort: a failed insert must never block authentication.
 */
export const logAuthEvent = async (
  request: NextRequest,
  event: AuthEvent,
  options: {
    userId?: string | null;
    email?: string | null;
    detail?: Record<string, unknown> | null;
  } = {}
): Promise<void> => {
  try {
    await db.query(
      `INSERT INTO public.auth_events (user_id, email, event, ip, user_agent, detail)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        options.userId ?? null,
        options.email ?? null,
        event,
        getClientIp(request),
        request.headers.get("user-agent")?.slice(0, 512) ?? null,
        options.detail ? JSON.stringify(options.detail) : null,
      ]
    );
  } catch (error) {
    console.error("Unable to write auth audit event:", error);
  }

  // No scheduler needed: a small share of writes trims the old rows.
  if (Math.random() < 0.02) void purgeExpiredEvents();
};
