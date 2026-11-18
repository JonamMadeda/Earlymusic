/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.r2.dev",
      },
    ],
  },
  async headers() {
    // NOTE: script-src keeps 'unsafe-inline' because Next.js emits inline
    // bootstrap scripts — a nonce-based policy needs framework plumbing
    // (see the old comment below). This still blocks the dangerous parts:
    // foreign scripts, plugins, framing, and non-audio/media exfiltration.
    // Dev adds 'unsafe-eval' for webpack HMR; production omits it.
    const scriptSrc =
      process.env.NODE_ENV === "production"
        ? "'self' 'unsafe-inline' https://va.vercel-scripts.com"
        : "'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com";
    const csp = [
      "default-src 'self'",
      `script-src ${scriptSrc}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.r2.dev",
      // Audio streams from R2/public hosts + offline blob playback.
      "media-src 'self' blob: https://*.r2.dev",
      // API calls, R2 presigned PUTs, analytics beacons. Keep this narrow:
      // a wildcard https: lets injected script exfiltrate session data.
      // The presigned PUT targets the S3 API host, not the r2.dev public host,
      // so both have to be listed or the browser blocks the upload as a
      // "Failed to fetch".
      "connect-src 'self' blob: https://*.r2.dev https://*.r2.cloudflarestorage.com https://va.vercel-scripts.com https://vitals.vercel-insights.com",
      "font-src 'self' data:",
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
      {
        // Authenticated responses must never be stored by the browser,
        // a proxy, or the service worker.
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "Pragma", value: "no-cache" },
          { key: "Vary", value: "Authorization, Cookie" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/playlists",
        destination: "/library",
        permanent: true,
      },
      {
        source: "/downloads",
        destination: "/library",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
