import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// app/page.js is a client component with hooks and live services, so these
// invariants are asserted against the source instead of a mounted tree — the
// same approach cacheNames.test.ts takes for literals that cannot share a
// constant. Each one guards a regression that was shipped once already.
const source = readFileSync(new URL("../app/page.js", import.meta.url), "utf8");
const featuredCard = readFileSync(
  new URL("../app/components/FeaturedCard.jsx", import.meta.url),
  "utf8"
);

describe("shuffle all", () => {
  it("does not order tracks with a random comparator", () => {
    expect(source).not.toMatch(/\.sort\(\s*\(\s*\)\s*=>\s*Math\.random\(\)\s*-\s*0\.5\s*\)/);
  });

  it("builds the queue through the seeded Fisher-Yates helper", () => {
    const shuffleAll = source.match(/const shuffleAll = useCallback\(\(\) => \{[\s\S]*?\n {2}\},/);
    expect(shuffleAll, "shuffleAll callback not found").not.toBeNull();
    expect(shuffleAll![0]).toContain("seededShuffle(");
  });
});

describe("rail scroll arrows", () => {
  it("shows every hover-revealed arrow on keyboard focus too", () => {
    const hoverRevealed = source.match(/group-hover\/rail:opacity-100/g) ?? [];
    expect(hoverRevealed.length, "no rail arrows found to guard").toBeGreaterThan(0);
    const hoverOnly = source.match(/group-hover\/rail:opacity-100(?! focus-visible:opacity-100)/g) ?? [];
    expect(hoverOnly).toHaveLength(0);
  });
});

describe("curated filter pills", () => {
  it("renders inside the section the pills filter, not above the fold", () => {
    const section = source.indexOf(`id="recommended"`);
    const pills = source.indexOf(`aria-label="Filter Curated for You"`);
    expect(section, "curated section not found").toBeGreaterThan(-1);
    expect(pills, "filter pill group not found").toBeGreaterThan(section);
  });

  it("leaves the page still when a pill is tapped", () => {
    expect(source).not.toMatch(/\.scrollIntoView\(/);
  });
});

describe("spotlight pool", () => {
  it("draws from the whole catalogue rather than the newest ten", () => {
    const spotlight = source.match(/const spotifySong = useMemo\(\(\) => \{[\s\S]*?\n {2}\},/);
    expect(spotlight, "spotifySong memo not found").not.toBeNull();
    expect(spotlight![0]).not.toMatch(/Math\.min\(\s*sortedSongs\.length\s*,\s*10\s*\)/);
    expect(spotlight![0]).toContain("rng() * sortedSongs.length");
  });
});

describe("verse capsule", () => {
  it("offers a stop control for the auto-rotation", () => {
    expect(source).toMatch(/"(Pause|Resume) verse rotation"/);
    expect(source).toMatch(/if \(activeSong \|\| versePaused \|\| reduceMotion\) return;/);
  });

  it("stops rotating under reduced motion", () => {
    expect(source).toContain('matchMedia("(prefers-reduced-motion: reduce)")');
  });

  it("reports a failed copy instead of swallowing it", () => {
    expect(source).not.toMatch(/catch \{\s*\/\/ fallback\s*\}/);
    const copyVerse = source.match(/const copyVerse = useCallback\(async \(\) => \{[\s\S]*?\n {2}\},/);
    expect(copyVerse, "copyVerse callback not found").not.toBeNull();
    expect(copyVerse![0]).toContain('setVerseCopyState("failed")');
  });
});

describe("active track marking", () => {
  it("marks every card type with aria-current, not only with colour", () => {
    // Four card components live in page.js, the fifth is its own module.
    expect(source.match(/aria-current=\{isActive \? "true" : undefined\}/g) ?? []).toHaveLength(4);
    expect(featuredCard).toMatch(/aria-current=\{isActive \? "true" : undefined\}/);
  });
});
