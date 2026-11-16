import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Tier 2 kept the same functions but moved them into fewer places: one control
// to get back to the whole catalogue, the track length on the row, the view in
// the address bar, and the scroll line on the bar that belongs to the list.
const view = readFileSync(new URL("../app/songs/songs-view.js", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/songs/page.js", import.meta.url), "utf8");
const row = view.slice(view.indexOf("const SongRow = "), view.indexOf("const ScrollProgress = "));
const toolbar = view.slice(
  view.indexOf("Sticky Search / Filter Bar"),
  view.indexOf("{filtersOpen && ("),
);
const strip = toolbar.slice(toolbar.indexOf("{hasFilters && ("));
const progress = view.slice(view.indexOf("const ScrollProgress = "), view.indexOf("const ScrollToTop = "));

describe("songs clear control", () => {
  it("is one handler, used by both places that offer it", () => {
    expect(view.match(/onClick=\{clearAll\}/g)).toHaveLength(2);
    expect(view).toMatch(/const clearAll = useCallback\(\(\) => \{/);
    // The three controls it replaced: Reset left the search alone, and
    // "Clear search" duplicated the ✕ already inside the field.
    expect(view).not.toMatch(/Clear search/);
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
  it("states the length the Duration filter sorts on", () => {
    expect(row).toMatch(/\{song\.duration \|\| "Long"\}/);
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
      view.indexOf("const fetchedRef"),
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

describe("songs scroll progress", () => {
  it("is drawn on the toolbar, not across the app header", () => {
    expect(progress).not.toMatch(/fixed top-0/);
    expect(progress).not.toMatch(/z-\[600\]/);
    expect(progress).toMatch(/absolute inset-x-0 bottom-0/);
    expect(toolbar).toMatch(/<ScrollProgress progress=\{scrollProgress\} \/>/);
    const above = view.slice(0, view.indexOf(`<div className="mx-auto max-w-5xl space-y-4`));
    expect(above.length, "page body slice not found").toBeGreaterThan(100);
    expect(above).not.toMatch(/<ScrollProgress/);
  });
});
