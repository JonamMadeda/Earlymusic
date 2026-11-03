import type { NextRequest } from "next/server";

/**
 * Best-effort client IP for rate limiting.
 *
 * We only trust headers that a hosting platform is known to overwrite:
 *  - x-vercel-forwarded-for (Vercel)
 *  - cf-connecting-ip (Cloudflare)
 *  - x-real-ip (common reverse proxies)
 *
 * A raw x-forwarded-for is client-controlled at the first hop, so we use
 * the *last* entry (the one added by the nearest proxy) instead of the
 * first. This is still spoofable on a directly exposed server, which is
 * why auth also has per-account buckets and a durable store.
 */
export const getClientIp = (request: NextRequest): string => {
  const vercel = request.headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0].trim();

  const cloudflare = request.headers.get("cf-connecting-ip");
  if (cloudflare) return cloudflare.trim();

  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }

  return "unknown";
};
