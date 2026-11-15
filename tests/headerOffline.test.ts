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

  it("describes the cache, not only downloads", () => {
    // public/sw.js caches full (non-Range) audio responses, so a track that was
    // merely streamed still plays offline. "Saved songs" would be a lie.
    expect(header).not.toMatch(/only songs saved/);
    expect(header).toMatch(/cache/);
  });
});
