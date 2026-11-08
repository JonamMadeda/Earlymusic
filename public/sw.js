const CACHE_NAME = "lumbo-app-v7";
const AUDIO_CACHE = "lumbo-audio-cache-v1";

self.addEventListener("install", (event) => {
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

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data === "CLEAR_PRIVATE_CACHES") {
    event.waitUntil(clearPrivateCaches());
  }
});

// Remove every cached API response (auth state, library, playlists,
// profiles) so signing out cannot leave another account's data behind.
const clearPrivateCaches = async () => {
  // The audio cache holds the account's downloaded tracks. Drop it with the
  // API responses so a shared device cannot show the previous listener's
  // downloads after sign-out.
  try {
    await caches.delete(AUDIO_CACHE);
  } catch {}
  const names = await caches.keys();
  await Promise.all(
    names.map(async (name) => {
      const cache = await caches.open(name);
      const requests = await cache.keys();
      await Promise.all(
        requests
          .filter((request) => new URL(request.url).pathname.startsWith("/api/"))
          .map((request) => cache.delete(request))
      );
    })
  );
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return;
  }

  // Never cache API responses. They are authenticated (cookie or bearer)
  // and Cache Storage is plaintext, origin-readable, and survives logout.
  if (url.pathname.startsWith("/api/")) return;
  if (request.headers.has("authorization")) return;

  if (url.pathname.includes("/audio/")) {
    // A Range response is only a slice of the file. Caching it under the
    // track's URL would serve that slice as the whole song on the next play,
    // so partial requests always go to the network. Matching on the path
    // rather than the bucket hostname keeps this working when audio moves
    // to a custom domain.
    if (request.headers.has("range")) return;
    event.respondWith(
      fromCache(request, AUDIO_CACHE).then((res) => res || fetch(request).catch(() => new Response("", { status: 503 })))
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      fromCache(request).then((res) => res || offlinePage())
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fromNetwork(request).then((res) => res || offlinePage())
    );
    return;
  }

  event.respondWith(
    fromNetwork(request).then((res) => res || offlinePage())
  );
});

const fromCache = async (request, cacheName = CACHE_NAME) => {
  try {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
    
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return null;
  }
};

const fromNetwork = async (request) => {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    return cached || null;
  }
};

const offlinePage = async () => {
  try {
    const cache = await caches.open(CACHE_NAME);
    const root = await cache.match("/");
    if (root) return root;
  } catch {}
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fafafa;color:#1a1a1a}div{text-align:center;padding:2rem}h1{font-size:1.25rem;margin:0 0 0.5rem}p{font-size:0.875rem;color:#666;margin:0}</style></head><body><div><h1>You're offline</h1><p>Connect to the internet and try again.</p></div></body></html>`,
    { status: 503, headers: { "Content-Type": "text/html" } }
  );
};
