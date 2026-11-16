import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Tier 1 was a de-cluttering pass with four decisions, each of which is a
// regression risk: a "nicer" card on every row or a count back in the
// clear-everything strip would put the clutter there again by accident.
const songs = readFileSync(new URL("../app/songs/songs-view.js", import.meta.url), "utf8");
const panelStart = songs.indexOf("{filtersOpen && (");
const panel = songs.slice(panelStart, songs.indexOf("</section>", panelStart));
const toolbar = songs.slice(songs.indexOf("Sticky Search / Filter Bar"), panelStart);
const strip = toolbar.slice(toolbar.indexOf("{hasFilters && ("));
const groups = songs.slice(
  songs.indexOf("const filterGroups = ["),
  songs.indexOf("const stats = useMemo"),
);
const rowStart = songs.indexOf("className={`group relative flex w-full items-center");
const rowClass = songs.slice(rowStart, songs.indexOf("}`", rowStart));

describe("songs filters panel", () => {
  it("is the block this file describes", () => {
    expect(panel.length, "filters panel slice not found").toBeGreaterThan(400);
  });

  it("puts each group's name beside its chips, not on a line above them", () => {
    expect(panel).toMatch(/filterGroups\.map/);
    expect(panel).toMatch(/w-\[64px\] shrink-0/);
    // The stacked headings are what made the open panel 225px tall on a phone.
    expect(panel).not.toMatch(/mb-2/);
    expect(panel).toMatch(/px-3 py-2\.5/);
  });

  it("sizes its chips at the dense tier, not the generic button floor", () => {
    // 44px chips made the open panel taller than the few songs it filters.
    expect(songs).toMatch(/tap-sm whitespace-nowrap rounded-lg border px-2 py-1 text-\[11px\]/);
    expect(songs).not.toMatch(/rounded-lg border px-2\.5 py-1\.5/);
  });

  it("drives every group from one list so a new filter is one entry", () => {
    expect(groups.match(/title: "/g)).toHaveLength(3);
    expect(panel).not.toMatch(/timeFilters\.map/);
    expect(panel).not.toMatch(/categories\.map/);
    expect(panel).not.toMatch(/durations\.map/);
  });
});

describe("songs toolbar labels", () => {
  it("names the sort field and the filters control at phone width", () => {
    expect(songs).toMatch(/const sortLabels = \{ title: "Title", author: "Artist", created_at: "Date" \}/);
    expect(toolbar).toMatch(/<span>\{sortLabels\[sortBy\]\}<\/span>/);
    expect(toolbar).toMatch(/<span>Filters\{activeFilterCount/);
    // Only the A-Z direction may hide its word, and only that one control.
    expect(toolbar.match(/hidden sm:inline/g)).toHaveLength(1);
    expect(toolbar).not.toMatch(/hidden md:inline/);
  });
});

describe("songs rows as a flat list", () => {
  it("gives the list hairlines instead of a card per row", () => {
    expect(songs).toMatch(/className="flex flex-col divide-y divide-neutral-200\/70"/);
    expect(songs).not.toMatch(/gap-y-1\.5 md:gap-y-2/);
  });

  it("keeps the row frameless, with the active state as an inset bar", () => {
    expect(rowClass.length, "row class slice not found").toBeGreaterThan(100);
    expect(rowClass).not.toMatch(/border/);
    expect(rowClass).not.toMatch(/rounded-xl/);
    expect(rowClass).not.toMatch(/shadow-2xs|shadow-xs/);
    expect(rowClass).not.toMatch(/hover:-translate-y/);
    expect(rowClass).toMatch(/shadow-\[inset_2px_0_0_var\(--color-accent\)\]/);
  });
});

describe("songs result count", () => {
  it("states the count once, in the title line, only while a filter is on", () => {
    expect(songs).toMatch(/\{filteredSongs\.length\}<\/span> of\{" "\}/);
    expect(songs).toMatch(/\{stats\.total\} tracks/);
  });

  it("keeps the clear-everything strip free of counts", () => {
    expect(strip.length, "clear strip slice not found").toBeGreaterThan(100);
    expect(strip).not.toMatch(/filteredSongs/);
    expect(strip).not.toMatch(/activeFilterCount/);
    expect(strip).not.toMatch(/stats\.total/);
  });
});
