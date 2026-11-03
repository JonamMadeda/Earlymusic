import { NextRequest, NextResponse } from "next/server";
import { db } from "./neon";
import { getClientIp } from "./requestIp";

type Options = {
  name: string;
  limit: number;
  windowMs: number;
  /**
   * Optional bucket key. Omit for a per-IP bucket (e.g. login-by-IP);
   * pass a normalised email or user id for a per-account bucket.
   */
  key?: string;
};

/**
 * Durable rate limiter shared by every server instance.
 *
 * The previous implementation kept counters in a process-local Map, so
 * serverless instances each had their own quota and a deploy reset every
 * counter. Counters now live in public.auth_rate_limits.
 *
 * A database failure fails open (auth still works) but is logged loudly;
 * the edge/WAF should remain the hard backstop.
 */
export const checkRateLimit = async (
  request: NextRequest,
  opts: Options
): Promise<NextResponse | null> => {
  const bucket = opts.key ?? getClientIp(request);
  const key = `${opts.name}:${bucket}`;
  const windowSeconds = opts.windowMs / 1000;

  try {
    const { rows } = await db.query(
      `INSERT INTO public.auth_rate_limits AS rl (key, count, reset_at)
       VALUES ($1, 1, now() + make_interval(secs => $2::double precision))
       ON CONFLICT (key) DO UPDATE SET
         count = CASE WHEN rl.reset_at <= now() THEN 1 ELSE rl.count + 1 END,
         reset_at = CASE
           WHEN rl.reset_at <= now()
           THEN now() + make_interval(secs => $2::double precision)
           ELSE rl.reset_at
         END
       RETURNING rl.count, rl.reset_at`,
      [key, windowSeconds]
    );

    // Opportunistic cleanup so the table cannot grow without bound.
    if (Math.random() < 0.02) {
      void db
        .query(
          "DELETE FROM public.auth_rate_limits WHERE reset_at < now() - interval '1 day'"
        )
        .catch(() => {});
    }

    const row = rows?.[0];
    if (!row || row.count <= opts.limit) return null;

    const retryAfter = Math.max(
      1,
      Math.ceil((new Date(row.reset_at).getTime() - Date.now()) / 1000)
    );
    return NextResponse.json(
      {
        error: `Too many attempts. Try again in ${retryAfter} second${
          retryAfter === 1 ? "" : "s"
        }.`,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Rate limiter unavailable:", error);
    return null;
  }
};
