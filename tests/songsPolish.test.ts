import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The polish pass changed no measurements of the rows or the rail. Each guard
// below is a defect that was measured on the served page, or a piece of the
// app's own visual language the songs page had drifted away from: a list that
// ended in 319–383px of blank white, a load failure with no way to retry, an
// empty state that told listeners to upload, a primary action carrying a second
// copy of the count, an unnamed back-to-top button, and a sort field that
// cycled blind while calling a date order "A-Z".
const view = readFileSync(new URL("../app/songs/songs-view.js", import.meta.url), "utf8");
const layout = readFileSync(new URL("../app/layout.js", import.meta.url), "utf8");
const toolbar = view.slice(view.indexOf("Search / Filter Bar"), view.indexOf("{filtersOpen && ("));
const mainTag = view.slice(view.indexOf("<main className="), view.indexOf(">", view.indexOf("<main className=")));
const scrollToTop = view.slice(view.indexOf("const ScrollToTop = "), view.indexOf("export default function SongsView"));
const empty = view.slice(
  view.indexOf('<div className="flex flex-col items-center justify-center py-16 text-center">'),
  view.indexOf("</main>"),
);
const sortMenu = toolbar.slice(toolbar.indexOf("{sortOpen && ("));
const row = view.slice(view.indexOf("const SongRow = "), view.indexOf("const ScrollProgress = "));
const count = view.slice(view.indexOf("const activeFilterCount"), view.indexOf("const filterGroups"));

describe("songs list has an end, not a void", () => {
  it("leaves the chrome reserve to the scroll container that owns it", () => {
    // #app-scroll already pads for the player and the bottom nav. A second
    // page-level reserve stacked on top of it: 176 + 176 = 352px of nothing.
    expect(layout).toMatch(/id="app-scroll"[^>]*pb-44 md:pb-32/);
    expect(mainTag).not.toMatch(/pb-44|pb-40|pb-32|pb-16|11rem|7rem/);
    // The inset still belongs to the page: the scroller's fixed padding cannot
    // know about the iOS home indicator.
    expect(mainTag).toMatch(/pb-\[calc\(1rem\+env\(safe-area-inset-bottom,0px\)\)\]/);
  });

  it("says where the list stops, in the home feed's own words", () => {
    expect(view).toMatch(/You&apos;ve reached the end/);
    expect(view).toMatch(/Thanks for worshipping with us today\./);
    // One way back to the top: the floating control is already on screen at
    // this depth, so the terminus does not repeat it.
    const terminus = view.slice(view.indexOf("You&apos;ve reached the end") - 700, view.indexOf("Alphabet Jump Bar"));
    expect(terminus).not.toMatch(/Back to top/);
  });
});

describe("songs load failure is recoverable", () => {
  it("offers its own retry instead of telling you to reload the app", () => {
    expect(view).toMatch(/const retryLoad = useCallback\(\(\) => \{/);
    expect(view).toMatch(/setLoadAttempt\(\(n\) => n \+ 1\)/);
    expect(view).toMatch(/\[setAllSongs, setIsLoading, loadAttempt\]/);
    expect(empty).toMatch(/onClick=\{retryLoad\}/);
    expect(empty).toMatch(/Try again/);
    // A download glyph for a connection failure reads as "download something".
    expect(empty).toMatch(/<CloudOff/);
    expect(empty).not.toMatch(/<Download/);
    expect(empty).toMatch(/role=\{loadError \? "alert" : undefined\}/);
  });

  it("does not mistake a failed load for an empty catalogue", () => {
    const heading = empty.slice(empty.indexOf("role={loadError"), empty.indexOf("mt-1 max-w-xs"));
    expect(heading).toMatch(/Songs could not be loaded/);
    expect(heading.indexOf("Songs could not be loaded")).toBeLessThan(heading.indexOf("No matching songs"));
  });
});

describe("songs empty state speaks to whoever is reading it", () => {
  it("asks an admin to upload and tells a listener the collection is coming", () => {
    expect(view).toMatch(/const \{ isAdmin \} = useAuth\(\)/);
    expect(empty).toMatch(/isAdmin\s*\?\s*"Your library is empty"/);
    expect(empty).toMatch(/The collection is still being built/);
    expect(empty).toMatch(/href="\/admin"/);
    expect(empty).toMatch(/Upload a Song/);
    // The upload call to action is the admin's alone.
    const cta = empty.slice(empty.indexOf("Clear all filters"));
    expect(cta).toMatch(/isAdmin && \(/);
  });
});

describe("songs primary action matches the app's primary tier", () => {
  it("is the home page's button, not a smaller cousin of it", () => {
    const play = view.slice(view.indexOf("onClick={playAll}"), view.indexOf("</section>"));
    expect(play).toMatch(/btn-primary/);
    expect(play).toMatch(/active:scale-95/);
  });

  it("names what it plays instead of repeating the count", () => {
    expect(view).toMatch(/<span>\{hasFilters \? "Play results" : "Play all"\}<\/span>/);
    expect(view).not.toMatch(/Play All \(/);
    expect(view).not.toMatch(/Play all \(\{filteredSongs\.length\}\)/);
  });

  it("shuffles the queue behind the one primary action", () => {
    const shuffle = view.slice(view.indexOf("const shuffleSongs ="), view.indexOf("const oneOf"));
    expect(shuffle).toMatch(/const shuffled = \[\.\.\.queue\]/);
    expect(shuffle).toMatch(/for \(let i = shuffled\.length - 1; i > 0; i -= 1\)/);
    expect(shuffle).toMatch(/Math\.floor\(Math\.random\(\) \* \(i \+ 1\)\)/);

    const play = view.slice(
      view.indexOf("const playAll = useCallback"),
      view.indexOf("// One handler for getting back")
    );
    expect(play).toMatch(/const shuffled = shuffleSongs\(filteredSongs\)/);
    expect(play).toMatch(/setActiveSong\(shuffled\[0\], shuffled\)/);
    expect(play).not.toMatch(/setIsShuffle/);
  });

  it("has no second shuffle affordance beside Play all", () => {
    const actions = view.slice(
      view.indexOf("{filteredSongs.length > 0 && ("),
      view.indexOf("</section>")
    );
    expect(actions).not.toMatch(/aria-label=/);
    expect(actions).not.toMatch(/<Shuffle/);
    expect(view).not.toMatch(/Play a random song/);
    expect(view).not.toMatch(/playRandom/);
  });
});

describe("songs sort is a choice, not a cycle", () => {
  it("opens the three fields and marks the one in force", () => {
    expect(toolbar).toMatch(/aria-haspopup="menu"/);
    expect(toolbar).toMatch(/aria-expanded=\{sortOpen\}/);
    expect(toolbar).toMatch(/aria-controls=\{sortOpen \? "songs-sort-menu" : undefined\}/);
    expect(sortMenu).toMatch(/id="songs-sort-menu"/);
    expect(sortMenu).toMatch(/role="menu"/);
    expect(sortMenu).toMatch(/\{sortOptions\.map\(\(option\) => \(/);
    expect(sortMenu).toMatch(/role="menuitemradio"/);
    expect(sortMenu).toMatch(/aria-checked=\{sortBy === option\.value\}/);
    // The blind cycle: Title → Artist → Date, two taps past what you wanted.
    expect(toolbar).not.toMatch(/setSortBy\("author"\)/);
    expect(toolbar).not.toMatch(/tap to change field/);
  });

  it("keeps the menu outside a box that would clip it", () => {
    const sortBox = toolbar.slice(toolbar.indexOf("ref={sortRef}"), toolbar.indexOf("{sortOpen && ("));
    expect(sortBox).not.toMatch(/overflow-hidden/);
    expect(sortBox).toMatch(/rounded-l-lg/);
    expect(sortBox).toMatch(/rounded-r-lg/);
  });

  it("answers Escape and the arrow keys it promises", () => {
    expect(view).toMatch(/const onSortMenuKeyDown = \(e\) => \{/);
    const handler = view.slice(view.indexOf("const onSortMenuKeyDown"), view.indexOf("// Keyboard shortcuts"));
    for (const key of ["ArrowDown", "ArrowUp", "Home", "End"]) {
      expect(handler, `${key} does not move`).toContain(`e.key === "${key}"`);
    }
    expect(handler).toMatch(/querySelectorAll\('\[role="menuitemradio"\]'\)/);
    // Tab dismisses the menu, so focus must land on a node that still exists.
    expect(handler).toMatch(/e\.key === "Tab"/);
    expect(handler).toMatch(/sortTriggerRef\.current\?\.focus\(\)/);
    const outside = view.slice(view.indexOf("if (!sortOpen) return;"), view.indexOf("const onSortMenuKeyDown"));
    expect(outside).toMatch(/document\.addEventListener\("pointerdown", onPointerDown\)/);
    expect(outside).toMatch(/document\.addEventListener\("keydown", onKeyDown\)/);
    expect(outside).toMatch(/e\.preventDefault\(\)/);
    expect(outside).toMatch(/sortTriggerRef\.current\?\.focus\(\)/);
    // Opening lands on the choice in force, not on the first item by luck.
    expect(outside).toMatch(/querySelector\('\[aria-checked="true"\]'\)\?\.focus\(\)/);
  });

  it("calls a date order oldest/newest, not A-Z", () => {
    expect(view).toMatch(/const byDate = sortBy === "created_at"/);
    expect(view).toMatch(/const dirLabel = byDate \? \(sortAsc \? "Old" : "New"\) : sortAsc \? "A-Z" : "Z-A"/);
    expect(view).toMatch(/Sorted oldest first, tap for newest first/);
    expect(toolbar).toMatch(/<span className="hidden sm:inline">\{dirLabel\}<\/span>/);
    expect(toolbar).toMatch(/aria-label=\{dirName\}/);
  });
});

describe("songs controls say what they are", () => {
  it("pluralises the nouns the catalogue actually counts", () => {
    // All 102 live tracks are by one artist, so the subtitle rendered
    // "102 tracks • 1 artists" on the served page.
    expect(view).toMatch(/\{stats\.total === 1 \? "track" : "tracks"\}/);
    expect(view).toMatch(/\{stats\.artists === 1 \? "artist" : "artists"\}/);
    expect(view).not.toMatch(/<\/span> artists/);
    expect(view).not.toMatch(/<\/span> tracks/);
  });

  it("names the floating back-to-top button", () => {
    expect(scrollToTop).toMatch(/aria-label="Back to top"/);
    expect(scrollToTop).toMatch(/active:scale-95/);
  });

  it("counts filters on the button called Filters, and not the query", () => {
    expect(count).not.toMatch(/searchValue/);
    expect(count).toMatch(/activeFilter !== "All"/);
    expect(count).toMatch(/activeCategory !== "All"/);
    expect(count).toMatch(/activeDuration !== "All"/);
    // The Clear strip still undoes the search, so hasFilters keeps it.
    const hasFilters = view.slice(view.indexOf("const hasFilters ="), view.indexOf("const activeFilterCount"));
    expect(hasFilters).toMatch(/searchValue\.trim\(\)/);
  });

  it("advertises the shortcut the page already answers", () => {
    expect(toolbar).toMatch(/aria-keyshortcuts="\/"/);
    expect(toolbar).toMatch(/enterKeyHint="search"/);
    expect(toolbar).toMatch(/<kbd/);
    expect(toolbar).toMatch(/max-md:hidden/);
    expect(view).toMatch(/e\.key === "\/"/);
  });

  it("gives the index a role so its name is announced", () => {
    const rail = view.slice(view.indexOf("Alphabet Jump Bar"), view.indexOf("</main>"));
    expect(rail).toMatch(/role="group"/);
    expect(rail).toMatch(/aria-label=\{sortBy === "created_at" \? "Date index" : "Alphabet index"\}/);
  });
});

describe("songs rows answer the pointer", () => {
  it("shows a hand over the strip that plays, and a press state under the finger", () => {
    // Tailwind v4's preflight leaves buttons at cursor: default, so 102 tappable
    // rows looked like plain text on a desktop.
    expect(row).toMatch(/cursor-pointer[^"\n]*rounded text-left after:absolute after:inset-0/);
    expect(row).toMatch(/hover:bg-neutral-50 active:bg-neutral-100/);
    const rail = view.slice(view.indexOf("Alphabet Jump Bar"), view.indexOf("</main>"));
    expect(rail).toMatch(/h-6 min-h-0 w-full shrink-0 cursor-pointer/);
  });

  it("gives the toolbar and the row menu the same hand as the rows", () => {
    // A pointer over the list but an arrow over Play all reads as half-disabled.
    const anchors = [
      "btn-primary shrink-0 cursor-pointer",
      "tap-sm min-h-8.5 cursor-pointer whitespace-nowrap",
      "shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-l-lg",
      "shrink-0 cursor-pointer items-center justify-center gap-1 rounded-r-lg",
      "shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border",
      "inline-flex h-8.5 cursor-pointer items-center gap-1 rounded-full",
      "h-10 w-10 cursor-pointer",
      "mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent",
    ];
    for (const anchor of anchors) expect(view, anchor).toContain(anchor);
    expect(view.match(/flex w-full cursor-pointer items-center gap-x-3/g)).toHaveLength(7);
  });
});