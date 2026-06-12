const CACHE_NAME = "earlymusic-app-v1";
const AUDIO_CACHE = "earlymusic-audio-cache-v1";

const STATIC_ASSETS = [
  "/",
  "/songs",
  "/library",
  "/playlists",
  "/account",
  "/auth",
  "/downloads",
  "/admin",
];

const ASSET_RE = /(href|src)=["']([^"']+)["']/g;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(STATIC_ASSETS).catch(() => {});

      const pageUrls = [];
      for (const path of STATIC_ASSETS) {
        const req = new Request(path);
        const res = await cache.match(req);
        if (!res) continue;
        const html = await res.text();
        let match;
        while ((match = ASSET_RE.exec(html)) !== null) {
          const url = match[2];
          if (
            url.startsWith("/_next/static/") ||
            url.startsWith("/icons/") ||
            url.startsWith("/favicon")
          ) {
            pageUrls.push(url);
          }
        }
      }

      await Promise.allSettled(
        [...new Set(pageUrls)].map((url) =>
          fetch(url).then((r) => {
            if (r.ok) cache.put(url, r);
          })
        )
      );
    })()
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== AUDIO_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

const cacheFirst = async (request) => {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const fallback = await caches.match("/");
    return fallback || new Response("Offline", { status: 503 });
  }
};

const networkFirst = async (request) => {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || caches.match("/") || new Response("Offline", { status: 503 });
  }
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  if (
    url.origin === "https://nrwjnbpypbchxrcyqbca.supabase.co" &&
    url.pathname.includes("/songs/")
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});
