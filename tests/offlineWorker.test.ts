import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const origin = "https://app.test";
const offlineUrl = `${origin}/library?tab=downloads`;
const source = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const absolute = (request: any) => new URL(typeof request === "string" ? request : request.url, origin).href;

function worker() {
  const buckets = new Map<string, Map<string, Response>>();
  const caches = {
    keys: async () => [...buckets.keys()],
    delete: vi.fn(async (name: string) => buckets.delete(name)),
    open: async (name: string) => {
      if (!buckets.has(name)) buckets.set(name, new Map());
      const entries = buckets.get(name)!;
      return {
        keys: async () => [...entries.keys()].map(url => new Request(url)),
        match: async (request: any) => entries.get(absolute(request))?.clone(),
        put: async (request: any, response: Response) => { entries.set(absolute(request), response.clone()); },
        delete: async (request: any) => entries.delete(absolute(request)),
      };
    },
  };
  const fetch = vi.fn(async (request: any) => {
    const url = absolute(request);
    if (url === offlineUrl) return new Response('<link rel="stylesheet" href="/_next/static/site.css"><script src="/_next/static/app.js"></script><a href="/api/auth/me">not an asset</a>', { headers: { "Content-Type": "text/html" } });
    if (url.endsWith("site.css")) return new Response('@font-face{src:url("./media/font.woff2")}', { headers: { "Content-Type": "text/css" } });
    return new Response("asset");
  });
  const handlers = new Map<string, (event: any) => void>();
  const self = {
    location: { origin },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
    addEventListener: (name: string, callback: any) => handlers.set(name, callback),
  };
  runInNewContext(source, { self, caches, fetch, URL, Response, Set });
  const lifecycle = async (name: string, data?: string) => {
    let work: Promise<any> | undefined;
    handlers.get(name)!({ data, waitUntil: (promise: Promise<any>) => { work = promise; } });
    await work;
  };
  const request = async (path: string, headers = {}, mode = "cors") => {
    let response: Promise<Response> | undefined;
    handlers.get("fetch")!({
      request: { url: new URL(path, origin).href, method: "GET", headers: new Headers(headers), mode },
      respondWith: (promise: Promise<Response>) => { response = promise; },
    });
    return response ? await response : undefined;
  };
  const offline = () => fetch.mockRejectedValue(new TypeError("Network unavailable"));
  return { caches, buckets, fetch, self, lifecycle, request, offline };
}

describe("offline application shell", () => {
  it("installs the downloads document, JS, CSS and font before activating", async () => {
    const w = worker();
    await w.lifecycle("install");
    expect(w.self.skipWaiting).toHaveBeenCalledOnce();
    expect(w.fetch.mock.calls.map(([request]) => absolute(request))).toEqual([
      offlineUrl, `${origin}/_next/static/site.css`, `${origin}/_next/static/app.js`, `${origin}/_next/static/media/font.woff2`,
    ]);
    w.offline();
    expect((await w.request("/library?tab=downloads", {}, "navigate"))?.status).toBe(200);
    expect(await (await w.request("/_next/static/app.js"))?.text()).toBe("asset");
  });

  it("does not replace a working installation if shell preparation fails", async () => {
    const w = worker();
    w.fetch.mockRejectedValueOnce(new TypeError("offline"));
    await expect(w.lifecycle("install")).rejects.toThrow();
    expect(w.self.skipWaiting).not.toHaveBeenCalled();
  });

  it("redirects an unvisited offline page to downloads, not mismatched root HTML", async () => {
    const w = worker();
    await w.lifecycle("install");
    w.offline();
    const response = await w.request("/songs?search=anything", {}, "navigate");
    expect(response?.status).toBe(302);
    expect(response?.headers.get("location")).toBe(offlineUrl);
  });

  it("never hands offline HTML to a missing script or RSC request", async () => {
    const w = worker();
    await w.lifecycle("install");
    w.offline();
    expect((await w.request("/_next/static/missing.js"))?.type).toBe("error");
    expect((await w.request("/songs?_rsc=unknown", { RSC: "1" }))?.type).toBe("error");
  });

  it("leaves APIs, bearer requests, partial audio and foreign resources uncached", async () => {
    const w = worker();
    for (const [url, headers] of [
      ["/api/auth/me", {}], ["/api/data/songs", {}], ["/private", { authorization: "Bearer test" }],
      ["/audio/song.mp3", { range: "bytes=0-" }], ["https://other.test/script.js", {}],
    ] as const) expect(await w.request(url, headers)).toBeUndefined();
    expect(w.fetch).not.toHaveBeenCalled();
  });

  it("preserves downloaded bytes and the shell on upgrade and cache trimming", async () => {
    const w = worker();
    await w.lifecycle("install");
    await (await w.caches.open("lumbo-audio-cache-v1")).put("/audio/saved", new Response("audio", { headers: { "x-luumbo-download": "1" } }));
    await w.caches.open("lumbo-app-v7");
    await w.lifecycle("activate");
    expect(w.buckets.has("lumbo-app-v7")).toBe(false);
    expect(w.buckets.has("lumbo-audio-cache-v1")).toBe(true);
    expect(w.self.clients.claim).toHaveBeenCalledOnce();
    for (let i = 0; i < 125; i++) await w.request(`/asset-${i}.png`);
    await new Promise(resolve => setImmediate(resolve));
    const runtime = [...w.buckets.entries()].find(([name]) => name.startsWith("lumbo-app-") && !name.endsWith("-offline"))![1];
    expect(runtime.size).toBeLessThanOrEqual(120);
    w.offline();
    expect((await w.request("/library?tab=downloads", {}, "navigate"))?.status).toBe(200);
    expect(await (await w.request("/_next/static/app.js"))?.text()).toBe("asset");
    expect(await (await w.request("/audio/saved"))?.text()).toBe("audio");
  });

  it("clears private bytes but not the offline application on sign-out", async () => {
    const w = worker();
    await w.lifecycle("install");
    await w.caches.open("lumbo-audio-cache-v1");
    await w.lifecycle("message", "CLEAR_PRIVATE_CACHES");
    expect(w.buckets.has("lumbo-audio-cache-v1")).toBe(false);
    w.offline();
    expect((await w.request("/library?tab=downloads", {}, "navigate"))?.status).toBe(200);
  });
});
