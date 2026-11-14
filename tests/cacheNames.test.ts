import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// Four files name the audio cache, and none of them can import a shared
// constant: public/sw.js is served verbatim, so it cannot reach bundled code.
// A drifted literal is not cosmetic — signing out would then leave the
// previous listener's downloaded audio in Cache Storage, or offline playback
// would look in a cache that nothing writes to.
const repoFile = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const audioCacheNames = () => {
  const worker = repoFile("../public/sw.js");
  const cacheUtils = repoFile("../lib/cacheUtils.js");
  const downloads = repoFile("../lib/downloadManager.js");
  const auth = repoFile("../app/context/AuthContext.js");

  const named = (source: string, pattern: RegExp) => {
    const match = source.match(pattern);
    if (!match) throw new Error(`No audio cache name matched ${pattern}`);
    return match[1];
  };

  return {
    worker: named(worker, /const AUDIO_CACHE = "([^"]+)"/),
    cacheUtils: named(cacheUtils, /const CACHE_NAME = "([^"]+)"/),
    downloads: named(downloads, /const CACHE_NAME = "([^"]+)"/),
    // Sign-out deletes the audio cache by name before it sweeps API responses.
    signOut: named(auth, /caches\.delete\("([^"]+)"\)/),
  };
};

describe("audio cache name", () => {
  it("is the same string in every file that cannot share a constant", () => {
    const names = audioCacheNames();
    expect(new Set(Object.values(names)).size).toBe(1);
  });

  it("matches the name the download tests and mocks use", () => {
    const [name] = Object.values(audioCacheNames());
    expect(repoFile("../tests/downloadManager.test.ts")).toContain(`"${name}"`);
  });

  it("is not duplicated as a client-side cache list in the registrar", () => {
    // The worker's activate handler already deletes names it does not
    // recognise. A second list in the page has to be bumped by hand, and a
    // forgotten bump deletes the new worker's cache — downloads included.
    const registrar = repoFile("../app/components/SWRegister.js");
    expect(registrar).not.toMatch(/caches\.delete/);
    expect(registrar).not.toContain("lumbo-audio-cache");
  });
});
