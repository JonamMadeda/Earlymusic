import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The tab strips hide their scrollbars. Without an explicit edge treatment a
// listener cannot tell that another tab is one swipe away, so these guards keep
// the scroll affordance wired to both tablists.
const source = readFileSync(new URL("../app/library/page.js", import.meta.url), "utf8");

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

  it("offers a chevron and a plain-language swipe hint for hidden tabs", () => {
    expect(source).toContain('aria-label="Scroll library tabs right"');
    expect(source).toContain('aria-label="Scroll Standouts views right"');
    expect(source).toContain("Swipe for more tabs");
    expect(source).toContain("Swipe for more views");
  });

  it("brings the selected tab into view when the active tab changes", () => {
    expect(source).toContain("scrollActiveTabIntoView(tablistRef.current");
    expect(source).toContain("scrollActiveTabIntoView(\n      standoutsTablistRef.current");
  });
});
