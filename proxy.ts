import { NextResponse, type NextRequest } from "next/server";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF guard for cookie-authenticated API requests.
 *
 * Session cookies are SameSite=Lax, which already blocks cross-site
 * POSTs, but SameSite is not a complete defence (older browsers, some
 * same-site subdomain attacks). Reject mutating API calls whose Origin
 * is not this host, and cross-site fetch metadata.
 */
export function proxy(request: NextRequest) {
  if (MUTATING_METHODS.has(request.method)) {
    if (request.headers.get("sec-fetch-site") === "cross-site") {
      return NextResponse.json(
        { error: "Cross-origin request rejected." },
        { status: 403 }
      );
    }

    const origin = request.headers.get("origin");
    if (origin) {
      const forwardedProto = request.headers.get("x-forwarded-proto");
      const protocol =
        forwardedProto || request.nextUrl.protocol.replace(":", "");
      const host = request.headers.get("host");
      const allowed = new Set<string>([request.nextUrl.origin]);
      if (host) allowed.add(`${protocol}://${host}`);
      if (!allowed.has(origin)) {
        return NextResponse.json(
          { error: "Cross-origin request rejected." },
          { status: 403 }
        );
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
