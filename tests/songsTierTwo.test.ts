import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Tier 2 kept the same functions but moved them into fewer places: one control
// to get back to the whole catalogue, the track length on the row, the view in
// the address bar, and the scroll line on the bar that belongs to the list.
const view = readFileSync(new URL("../app/songs/songs-view.js", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/songs/page.js", import.meta.url), "utf8");
const row = view.slice(view.indexOf("const SongRow = "), view.indexOf("const ScrollProgress = "));
const toolbar = view.slice(
  view.indexOf("Search / Filter Bar"),
  view.indexOf("{filtersOpen && ("),
);
const strip = toolbar.slice(toolbar.indexOf("{hasFilters && ("));
const progress = view.slice(view.indexOf("const ScrollProgress = "), view.indexOf("const ScrollToTop = "));

describe("songs clear control", () => {
  it("is one handler, used by both places that offer it", () => {
    expect(view.match(/onClick=\{clearAll\}/g)).toHaveLength(2);
    expect(view).toMatch(/const clearAll = useCallback\(\(\) => \{/);
    // The three controls it replaced: Reset left the search alone, and
    // "Clear search" duplicated the ✕ already inside the field. The ✕ itself is
    // now named "Clear search" for screen readers — a label, not a second button.
    expect(view).not.toMatch(/>\s*Clear search\s*</);
    expect(view).not.toMatch(/>\s*Reset\s*</);
  });

  it("clears the search as part of clearing everything", () => {
    const start = view.indexOf("const clearAll");
    const handler = view.slice(start, view.indexOf("return (", start));
    for (const setter of ["setSearchValue", "setActiveFilter", "setActiveCategory", "setActiveDuration"]) {
      expect(handler).toContain(`${setter}(`);
    }
  });

  it("still leaves the strip without a second count", () => {
    expect(strip).not.toMatch(/filteredSongs|activeFilterCount|stats\.total/);
  });
});

describe("songs track length", () => {
  it("is not a tag in the row any more", () => {
    // The owner took the Long/Short label back out (2026-11-16): it repeated a
    // filter control rather than describing the track. The filter itself stays.
    expect(row).not.toMatch(/song\.duration/);
    expect(view).toMatch(/const durations = \["All", "Long", "Short"\];/);
    expect(view).toMatch(/\(song\) => \(song\.duration \|\| "Long"\) === activeDuration/);
  });
});

describe("songs view in the address bar", () => {
  it("reads the six controls it can write", () => {
    const reader = view.slice(view.indexOf("const readViewFromUrl"), view.indexOf("const writeViewToUrl"));
    for (const key of ["q", "time", "type", "duration", "sort", "dir"]) {
      expect(reader, `?${key} is not read`).toContain(`"${key}"`);
    }
    // A value no control can produce falls back rather than half-applying.
    expect(view).toMatch(/const oneOf = /);
    expect(reader).toMatch(/oneOf\(/);
  });

  it("writes through the History API, not a navigation", () => {
    const writer = view.slice(
      view.indexOf("const url = writeViewToUrl"),
      view.indexOf("const retryLoad"),
    );
    expect(writer.length, "url writer effect not found").toBeGreaterThan(100);
    expect(writer).toMatch(/window\.history\.replaceState\(window\.history\.state/);
    expect(writer).not.toMatch(/router\.(push|replace)\(/);
    expect(view.match(/useRouter\(\)/g)).toHaveLength(1); // only the row's share redirect
    expect(view).toMatch(/useSearchParams\(\)/);
  });

  it("sits behind the boundary that keeps the prerender honest", () => {
    expect(page).toMatch(/import \{ Suspense \} from "react"/);
    expect(page).toMatch(/<Suspense/);
    expect(page).toMatch(/<SongsView \/>/);
    expect(page).not.toMatch(/useSearchParams/);
    const body = view.slice(view.indexOf("export default function SongsView"));
    expect(body.length, "view component not found").toBeGreaterThan(200);
    expect(body).toMatch(/useState\(\(\) => readViewFromUrl\(searchParams\)\)/);
  });
});

describe("songs toolbar is page content", () => {
  it("does not stick, so the list scrolls past it", () => {
    expect(toolbar).not.toMatch(/sticky/);
    // The blur and the /95 fill only existed because rows scrolled underneath.
    expect(toolbar).not.toMatch(/backdrop-blur/);
    expect(toolbar).not.toMatch(/bg-white\/95/);
    // No sticky box any more, so the progress line needs the bar to be the
    // containing block it resolves against. The index is centred below the
    // header, so only sm and up keeps a right gutter; phones use full width.
    expect(toolbar).toMatch(/className="relative sm:mr-8"/);
  });

  it("clears only the scroll container's top edge, not a sticky bar", () => {
    // The app header sits outside #app-scroll, so only an 8px breathing gap
    // separates these from it — flush against the edge read as part of the bar.
    expect(view).toMatch(/const STICKY_TOP = 8;/);
    // Measuring the bar's height existed only to park things under it.
    expect(view).not.toMatch(/toolbarHeight|toolbarRef/);
    const rail = view.slice(view.indexOf("Alphabet Jump Bar"), view.indexOf("</main>"));
    // The index is a fixed overlay measured against the scroller, so it can
    // never park its tail behind the player the way an in-flow column did.
    expect(rail).toMatch(/fixed z-30/);
    expect(rail).toMatch(/top: railBox\.top/);
    // Section headers pin as full-width opaque bars, not pills floating over
    // the row text beneath them.
    const header = view.slice(view.indexOf("ref={(el) => { letterRefs.current[group.key] = el; }}"), view.indexOf("A flat list with hairlines"));
    expect(header).toMatch(/sticky z-10 -mx-1\.5/);
    expect(header).toMatch(/bg-white\/95/);
    expect(header).toMatch(/border-b border-neutral-200\/70/);
  });
});
describe("songs scroll progress", () => {
  it("is drawn on the toolbar, not across the app header", () => {
    expect(progress).not.toMatch(/fixed top-0/);
    expect(progress).not.toMatch(/z-\[600\]/);
    expect(progress).toMatch(/absolute inset-x-0 bottom-0/);
    expect(toolbar).toMatch(/<ScrollProgress progress=\{scrollProgress\} \/>/);
    const above = view.slice(0, view.indexOf(`<div className="mx-auto max-w-5xl space-y-3`));
    expect(above.length, "page body slice not found").toBeGreaterThan(100);
    expect(above).not.toMatch(/<ScrollProgress/);
  });
});
