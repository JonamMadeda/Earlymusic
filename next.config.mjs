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
      "img-src 'self' data: blob: https:",
      // Audio streams from R2/public hosts + offline blob playback.
      "media-src 'self' blob: https:",
      // API calls, R2 presigned PUTs, analytics beacons.
      "connect-src 'self' blob: https:",
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
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
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
