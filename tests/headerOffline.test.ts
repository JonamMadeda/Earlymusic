import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The offline indicator used to be a pill inside the header's control cluster,
// where it cost ~101px and shoved the Sign in button leftward on a 411px screen.
// It is now its own row under the bar. These guards keep it there.
const header = readFileSync(new URL("../app/components/Header.jsx", import.meta.url), "utf8");

describe("offline indicator", () => {
  it("renders the status row, and nowhere else", () => {
    expect(header.match(/CloudOff/g)).toHaveLength(2); // import + the one glyph
    expect(header).toMatch(/role="status"/);
  });

  it("does not put the state inside the control cluster", () => {
    // The cluster ends where the status row's comment begins; slicing to
    // </header> would include the row itself and prove nothing.
    const start = header.indexOf("{showSignIn &&");
    const cluster = header.slice(start, header.indexOf("Offline is a state of the whole app"));
    expect(cluster.length, "cluster slice not found").toBeGreaterThan(0);
    expect(cluster).not.toMatch(/isOnline/);
    expect(cluster).not.toMatch(/CloudOff/);
  });

  it("stays still, because a permanent warning should not animate forever", () => {
    expect(header).not.toMatch(/animate-pulse/);
    expect(header).not.toMatch(/uppercase tracking-wider/);
  });

  it("offers a full navigation to downloads without claiming playback is active", () => {
    expect(header).toContain('href="/library?tab=downloads"');
    expect(header).toContain("downloaded songs are available");
    expect(header).not.toContain("playing from");
    expect(header).toMatch(/showSignIn = isOnline &&/);
  });
});

// The bar is pinned by structure, not by behaviour: layout.js puts it in the
// flex column *above* #app-scroll, so it never scrolls and needs no collapse,
// no negative margin and no `position` to hold it in place.
describe("the bar stays pinned", () => {
  it("sits outside the scroll container", () => {
    const layout = readFileSync(new URL("../app/layout.js", import.meta.url), "utf8");
    const shell = layout.slice(layout.indexOf('id="app-shell"'), layout.indexOf("</main>"));
    expect(shell.indexOf("<Header />")).toBeLessThan(shell.indexOf('id="app-scroll"'));
  });

  it("stays in normal flow, with no fixed or sticky positioning", () => {
    // `sticky top-0` / `fixed` would lift it out of the column and make the
    // scroll area grow under it; in flow it simply cannot scroll.
    expect(header).not.toMatch(/sticky top-0/);
    expect(header).not.toMatch(/\bfixed\b/);
    expect(header).toMatch(/relative z-\[200\]/);
  });

  it("never moves, so it never has to hand its space back", () => {
    expect(header).not.toMatch(/marginTop: -/);
    expect(header).not.toMatch(/inert=/);
    expect(header).not.toMatch(/addEventListener\("scroll"/);
  });

  it("keeps the mobile wordmark at the size the brand is elsewhere", () => {
    expect(header).toMatch(/text-\[18px\][^>]*>\s*Luumbo/);
  });
});
