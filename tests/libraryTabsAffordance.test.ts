import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The tab strips hide their scrollbars. Without an explicit edge treatment a
// listener cannot tell that another tab is one swipe away, so these guards keep
// the scroll affordance wired to both tablists.
const source = readFileSync(new URL("../app/library/page.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");

describe("library tab overflow affordance", () => {
  it("measures both tablists on scroll and resize", () => {
    const main = source.slice(
      source.indexOf('aria-label="Library collections"'),
      source.indexOf('aria-labelledby="library-tab-downloads"')
    );
    const standouts = source.slice(
      source.indexOf('<div className="relative inline-flex max-w-full min-w-0">'),
      source.indexOf('aria-labelledby="standouts-tabpanel-top"')
    );

    expect(main).toContain("onScroll={measureTabs}");
    expect(standouts).toContain("ref={standoutsTablistRef}");
    expect(standouts).toContain("onScroll={measureTabs}");
    expect(source).toContain('window.addEventListener?.("resize", onResize)');
  });

  it("uses swipe hints without extra button controls", () => {
    expect(source).not.toContain('aria-label="Scroll library tabs');
    expect(source).not.toContain('aria-label="Scroll Standouts views');
    expect(source).not.toContain("ChevronLeft");
    expect(source).not.toContain("ChevronRight");
    expect(source).toContain("Swipe for more tabs");
    expect(source).toContain("Swipe for more views");
  });

  it("brings the selected tab into view when the active tab changes", () => {
    expect(source).toContain("scrollActiveTabIntoView(tablistRef.current");
    expect(source).toContain("scrollActiveTabIntoView(\n      standoutsTablistRef.current");
  });

  it("keeps both tab strips compact", () => {
    const main = source.slice(
      source.indexOf('aria-label="Library collections"'),
      source.indexOf('aria-labelledby="library-tab-downloads"')
    );
    const standouts = source.slice(
      source.indexOf('<div className="relative inline-flex max-w-full min-w-0">'),
      source.indexOf('aria-labelledby="standouts-tabpanel-top"')
    );

    expect(main).toContain("inline-flex w-auto max-w-full scroll-mt-4 flex-nowrap items-center gap-0.5");
    expect(main).toContain("rounded-lg border border-neutral-200 bg-neutral-100/70 p-0.5");
    expect(main).toContain("rounded-md px-2 py-1.5 text-[11px]");
    expect(main).toContain("size={13}");

    expect(standouts).toContain("rounded-lg border border-neutral-200 bg-neutral-50 p-0.5");
    expect(standouts).toContain("rounded-md px-2 py-1.5 text-[11px]");
    expect(standouts).toContain("size={13}");
  });
});

describe("library downloads A-Z rail", () => {
  it("pins the rail above the bottom player/nav instead of the top of the list", () => {
    expect(source).toContain('["bottom-nav", "now-playing-bar", "mobile-now-playing-bar"]');
    expect(source).toContain('aria-label="Jump to letter in downloads"');
    expect(source).toContain("songs-index fixed z-30 flex w-6 select-none flex-col items-stretch justify-start overflow-y-auto rounded-full bg-neutral-100/80 py-1.5 sm:w-7");
    expect(source).not.toContain('className="songs-index sticky top-24');
  });

  it("uses the Songs page half-height track and bottom gap", () => {
    expect(source).toContain("bottom - DOWNLOAD_STICKY_TOP - top");
    expect(source).toContain("Math.max(4, Math.ceil(downloadLetters.length / 2))");
    expect(source).toContain("visibleLetters * 24 + 12");
    expect(source).toContain("bottom - MOBILE_RAIL_BOTTOM_GAP - height");
  });
});
