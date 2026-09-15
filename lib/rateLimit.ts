import { NextRequest, NextResponse } from "next/server";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const getClientIp = (request: NextRequest) => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
};

/**
 * Best-effort in-memory rate limiter for admin API routes.
 *
 * NOTE: counts live per server instance, so on multi-instance hosting this
 * slows abuse rather than strictly capping it. For hard limits, enforce at
 * the edge (host firewall / WAF) as well.
 *
 * Returns null when allowed, or a 429 JSON response when the quota is spent.
 */
export const checkRateLimit = (
  request: NextRequest,
  opts: { name: string; limit: number; windowMs: number }
): NextResponse | null => {
  const now = Date.now();
  const key = `${opts.name}:${getClientIp(request)}`;

  // Opportunistic cleanup so the map can't grow without bound.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
  }

  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return null;
  }
  if (current.count < opts.limit) {
    current.count += 1;
    return null;
  }

  const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  return NextResponse.json(
    { error: "Too many requests. Please slow down and try again." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
};
