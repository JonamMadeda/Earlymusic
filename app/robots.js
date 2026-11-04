import { SITE_URL } from "@/lib/site";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/account",
        "/admin",
        "/api/",
        "/auth",
        "/downloads",
        "/library",
        "/playlists",
        "/settings",
        "/upload",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
