const CACHE_NAME = "lumbo-app-v8";
const SHELL_CACHE = `${CACHE_NAME}-offline`;
const OFFLINE_URL = "/library?tab=downloads";
const AUDIO_CACHE = "lumbo-audio-cache-v1";
const MAX_AUDIO_ENTRIES = 30;
const MAX_APP_ENTRIES = 120;
const OFFLINE_HEADER = "x-luumbo-download";

self.addEventListener("install", (event) => {
  event.waitUntil(prepareOfflineShell().then(() => self.skipWaiting()));
});

const prepareOfflineShell = async () => {
  const cache = await caches.open(SHELL_CACHE);
  const page = await fetch(OFFLINE_URL, { cache: "reload" });
  if (!page.ok || !page.headers.get("content-type")?.includes("text/html")) {
    throw new Error("Unable to prepare offline downloads");
  }
  const html = await page.clone().text();
  const assets = new Set();
  const addAsset = (value, base = self.location.origin) => {
    const url = new URL(value.replaceAll("&amp;", "&"), base);
    if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
      assets.add(url.href);
    }
  };
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) addAsset(match[1]);
  // The shell must retain its own build's chunks even when the browsing cache is trimmed.
  for (const url of assets) {
    const response = await fetch(url, { cache: "reload" });
    if (!response.ok) throw new Error("Unable to prepare offline assets");
    if (response.headers.get("content-type")?.includes("text/css")) {
      const css = await response.clone().text();
      for (const match of css.matchAll(/url\(["']?([^"'()]+)["']?\)/g)) addAsset(match[1], url);
    }
    await cache.put(url, response);
  }
  await cache.put(OFFLINE_URL, page);
};

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== AUDIO_CACHE && key !== SHELL_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
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

  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(fromCache(request).then((res) => res || Response.error()));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fromStartup(request));
    return;
  }

  // RSC and scripts must fail as requests, not receive a document they cannot parse.
  event.respondWith(fromNetwork(request).then((res) => res || Response.error()));
});

const fromCache = async (request, cacheName = CACHE_NAME) => {
  try {
    if (cacheName === CACHE_NAME) {
      const shell = await caches.open(SHELL_CACHE);
      const asset = await shell.match(request);
      if (asset) return asset;
    }
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok) {
      const stored = response.clone();
      cache
        .put(request, stored)
        .then(() => (cacheName === AUDIO_CACHE ? trimAudioCache(cache) : trimAppCache(cache)))
        .catch(() => {});
    }
    return response;
  } catch {
    return null;
  }
};

// Streams share the cache with explicit downloads, so trimming has to spare
// anything the listener asked to keep. Cache keys come back in insertion
// order, so the oldest stream is the one that goes.
const trimAudioCache = async (cache) => {
  const keys = await cache.keys();
  let excess = keys.length - MAX_AUDIO_ENTRIES;
  if (excess <= 0) return;
  for (const key of keys) {
    if (excess <= 0) break;
    const stored = await cache.match(key);
    if (stored?.headers.get(OFFLINE_HEADER)) continue;
    await cache.delete(key);
    excess -= 1;
  }
};

// The Android shell holds its splash screen until this response paints, so a
// known document is served straight from cache and refreshed behind it. Every
// page fetches its own data and the document's Vary list carries no Cookie, so
// a cached shell is not another listener's account — at worst it is last
// build's shell, whose chunks are still in the same cache.
const fromStartup = async (request) => {
  const cache = await caches.open(CACHE_NAME);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache
          .put(request, response.clone())
          .then(() => trimAppCache(cache))
          .catch(() => {});
      }
      return response;
    })
    .catch(() => null);
  const cached = await cache.match(request);
  if (cached) return cached;
  return (await network) || offlineNavigation(request);
};

const fromNetwork = async (request) => {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      // Not awaited: the response is already streaming to the page, and a
      // quota rejection must not fail the navigation. fromCache chains this
      // same put; leaving it bare logged an unhandled rejection every time.
      cache
        .put(request, response.clone())
        .then(() => trimAppCache(cache))
        .catch(() => {});
    }
    return response;
  } catch {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    return cached || null;
  }
};

// Only the audio cache had a ceiling, so this one grew until the browser
// evicted the whole origin — which also took the offline downloads with it.
// Keys come back in insertion order, so the oldest cached page is what goes.
const trimAppCache = async (cache) => {
  const keys = await cache.keys();
  const excess = keys.length - MAX_APP_ENTRIES;
  if (excess <= 0) return;
  await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)));
};

const offlineNavigation = async (request) => {
  const cache = await caches.open(SHELL_CACHE);
  const page = await cache.match(OFFLINE_URL);
  if (!page) return Response.error();
  const destination = new URL(OFFLINE_URL, self.location.origin);
  if (request.url !== destination.href) return Response.redirect(destination.href, 302);
  return page;
};
