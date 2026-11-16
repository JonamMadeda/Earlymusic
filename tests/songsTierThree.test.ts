import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Tier 3 changed no measurements — it made the page's existing controls behave
// the way they already look. Each guard below is the thing a "cleanup" would most
// likely undo: the row going back to a button that contains buttons, the ⋯ losing
// its disclosure state, Escape going back to only clearing the search, and the
// rail going back to twenty-six 16×18 targets that must be hit precisely.
const view = readFileSync(new URL("../app/songs/songs-view.js", import.meta.url), "utf8");
const rowStart = view.indexOf("const SongRow = ");
const row = view.slice(rowStart, view.indexOf("const ScrollProgress = "));
const rowBody = row.slice(row.indexOf("ref={rowRef}"));
const menu = rowBody.slice(rowBody.indexOf("{showMenu && ("), rowBody.indexOf("{showInfo && ("));
const toolbar = view.slice(
  view.indexOf("Search / Filter Bar"),
  view.indexOf("{filtersOpen && ("),
);
const rail = view.slice(view.indexOf("Alphabet Jump Bar"), view.indexOf("</main>"));

describe("songs row menu", () => {
  it("is a disclosure: the trigger says whether it is open and what it opened", () => {
    expect(row).toMatch(/aria-haspopup="menu"/);
    expect(row).toMatch(/aria-expanded=\{showMenu\}/);
    expect(row).toMatch(/aria-controls=\{showMenu \? menuId : undefined\}/);
    expect(menu).toMatch(/role="menu"/);
    expect(menu).toMatch(/id=\{menuId\}/);
    expect(menu.match(/role="menuitem"/g)).toHaveLength(6);
  });

  it("takes Escape for itself and hands focus back to the ⋯", () => {
    expect(row).toMatch(/document\.addEventListener\("keydown", handleEscape\)/);
    expect(row).toMatch(/e\.key !== "Escape"/);
    expect(row).toMatch(/e\.preventDefault\(\)/);
    expect(row).toMatch(/menuButtonRef\.current\?\.focus\(\)/);
    // The page-level Escape clears the search; it has to stand down when a row
    // already answered the key, or leaving a menu also wipes the query.
    const shortcuts = view.slice(view.indexOf("// Keyboard shortcuts"), view.indexOf("const handleCategoryClick"));
    expect(shortcuts).toMatch(/if \(e\.defaultPrevented\) return;/);
  });

  it("moves between items with the arrow keys it just promised", () => {
    expect(row).toMatch(/onKeyDown=\{onMenuKeyDown\}/);
    const handler = row.slice(row.indexOf("const onMenuKeyDown"), row.indexOf("const handleShare"));
    for (const key of ["ArrowDown", "ArrowUp", "Home", "End"]) {
      expect(handler, `${key} does not move`).toContain(`e.key === "${key}"`);
    }
    expect(handler).toMatch(/querySelectorAll\('\[role="menuitem"\]'\)/);
  });

  it("flips up from where the row actually sits, not from its index", () => {
    // Against the row's top: the popup hangs from there. Measuring the bottom
    // flipped the upper half of the screen and sent their menus off the top.
    expect(row).toMatch(/row\.getBoundingClientRect\(\)\.top \+ MENU_ROOM > window\.innerHeight - reserved/);
    expect(row).not.toMatch(/getBoundingClientRect\(\)\.bottom \+ MENU_ROOM/);
    // The reserve is the layout's own number: the scroller's bottom padding is the
    // space the player and the bottom nav already took.
    expect(row).toMatch(/parseFloat\(window\.getComputedStyle\(scroller\)\.paddingBottom\)/);
    expect(row).not.toMatch(/menuUp = false/);
    const list = view.slice(view.indexOf("{group.songs.map((song)"), view.indexOf("</main>"));
    expect(list).not.toMatch(/menuUp/);
    expect(list).not.toMatch(/group\.songs\.length - 2/);
  });
});

describe("songs row structure", () => {
  it("is a container whose play control is a button, with nothing nested in it", () => {
    // Comments tell the story below, so the guards read the markup only.
    const markup = rowBody.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(markup).not.toMatch(/role="button"/);
    expect(markup).not.toMatch(/tabIndex=\{0\}/);
    expect(markup).not.toMatch(/onKeyDown=\{\(e\) => \{/);
    expect(rowBody).toMatch(/<button[\s\S]*?aria-label=\{`\$\{isActive \? "Playing" : "Play"\}: \$\{song\.title/);
    // The stretched layer is what keeps the whole strip tappable now that the row
    // itself has no onClick; the controls above it need their own stacking.
    expect(rowBody).toMatch(/after:absolute after:inset-0/);
    expect(rowBody).toMatch(/relative z-20 flex items-center gap-1\.5/);
  });

  it("puts title and artist in one touch target instead of padding the title alone", () => {
    const play = rowBody.slice(rowBody.indexOf("<button"), rowBody.indexOf("</button>"));
    expect(play).toContain("song.title");
    expect(play).toContain("song.author");
    expect(play).toContain("min-h-11");
    expect(play).toContain("flex-col justify-center gap-0.5");
    expect(play).not.toContain("tap-sm");
    expect(play).toContain("text-sm font-semibold leading-5");
    expect(play).toContain("text-xs leading-4");
  });

  it("still says which row is playing, in markup a screen reader reads", () => {
    expect(rowBody).toMatch(/aria-current=\{isActive \? "true" : undefined\}/);
  });
});

describe("alphabet rail as a scrub surface", () => {
  it("follows the pointer down the column", () => {
    expect(rail).toMatch(/onPointerDown=\{\(e\) => \{/);
    expect(rail).toMatch(/onPointerMove=\{\(e\) => \{/);
    expect(rail).toMatch(/onPointerUp=\{stopRailScrub\}/);
    expect(rail).toMatch(/onPointerLeave=\{stopRailScrub\}/);
    expect(rail).toMatch(/onPointerCancel=\{stopRailScrub\}/);
    // Capture would retarget the release away from the letter, so the letters have
    // to stay ordinary buttons that still take a click.
    expect(rail).not.toMatch(/setPointerCapture/);
    expect(view).toMatch(/const jumpFromClientY = useCallback\(\(clientY\) => \{/);
    expect(view).toMatch(/el\.dataset\.railKey/);
    expect(rail).toMatch(/data-rail-key=\{group\.key\}/);
    // The gesture belongs to the rail, so a vertical drag must not scroll the page.
    expect(rail).toMatch(/touchAction: "none"/);
  });

  it("shows every group at once instead of scrolling to reach them", () => {
    // The track is pinned to the safe area (below the app bar, above the player)
    // and the letters share its measured height, so nothing is out of reach and
    // nothing hides behind the chrome at the top of the page.
    expect(rail).toMatch(/fixed z-30/);
    expect(rail).toMatch(/height: railBox\.height/);
    expect(rail).toMatch(/justify-between/);
    expect(rail).not.toMatch(/overflow-y-auto|no-scrollbar/);
    expect(view).not.toMatch(/rail\.scrollTop/);
    expect(rail).toMatch(/min-h-0 w-full flex-1/);
  });
});

describe("songs toolbar accessible names", () => {
  it("names the field, the clear-in-the-field and the two disclosures", () => {
    expect(toolbar).toMatch(/aria-label="Search songs or artists"/);
    expect(toolbar).toMatch(/aria-label="Clear search"/);
    expect(toolbar).toMatch(/aria-label=\{`Sort by \$\{sortOptions/);
    expect(toolbar).toMatch(/aria-expanded=\{filtersOpen\}/);
    expect(toolbar).toMatch(/aria-controls="songs-filter-panel"/);
    expect(view).toMatch(/<section id="songs-filter-panel"/);
  });
});
