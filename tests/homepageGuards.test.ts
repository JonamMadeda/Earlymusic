import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// app/page.js is a client component with hooks and live services, so these
// invariants are asserted against the source instead of a mounted tree — the
// same approach cacheNames.test.ts takes for literals that cannot share a
// constant. Each one guards a regression that was shipped once already.
const source = readFileSync(new URL("../app/page.js", import.meta.url), "utf8");
const hero = readFileSync(
  new URL("../app/components/HomeHero.jsx", import.meta.url),
  "utf8"
);
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
  it("uses measured overflow and visible controls instead of hover-only arrows", () => {
    const rail = source.slice(source.indexOf("const SectionBlock"), source.indexOf("export default function Home"));
    expect(rail).toContain("new ResizeObserver(updateEdges)");
    expect(rail).toContain("onScroll={updateEdges}");
    expect(rail).toContain("disabled={!edges.left}");
    expect(rail).toContain("disabled={!edges.right}");
    expect(rail).not.toMatch(/opacity-0|md:flex|mask-image|items.length > 3/);
    expect(rail).toContain("e.preventDefault()");
    expect(rail).toContain('matches ? "instant" : "smooth"');
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
    expect(source).toContain("min-h-[60dvh]");
  });
});

describe("standouts pool", () => {
  it("draws from the whole catalogue rather than the newest ten", () => {
    const standouts = source.match(/const standoutSong = useMemo\(\(\) => \{[\s\S]*?\n {2}\},/);
    expect(standouts, "standoutSong memo not found").not.toBeNull();
    expect(standouts![0]).not.toMatch(/Math\.min\(\s*sortedSongs\.length\s*,\s*10\s*\)/);
    expect(standouts![0]).toContain("rng() * sortedSongs.length");
  });
});

describe("verse capsule", () => {
  it("offers a stop control for the auto-rotation", () => {
    expect(hero).toMatch(/"(Pause|Resume) verse rotation"/);
    expect(hero).toMatch(/if \(activeSong \|\| versePaused \|\| reduceMotion\) return;/);
  });

  it("stops rotating under reduced motion", () => {
    expect(hero).toContain('matchMedia("(prefers-reduced-motion: reduce)")');
  });

  it("reports a failed copy instead of swallowing it", () => {
    expect(hero).not.toMatch(/catch \{\s*\/\/ fallback\s*\}/);
    const copyVerse = hero.match(/const copyVerse = useCallback\(async \(\) => \{[\s\S]*?\n {2}\},/);
    expect(copyVerse, "copyVerse callback not found").not.toBeNull();
    expect(copyVerse![0]).toContain('setVerseCopyState("failed")');
  });
});

describe("homepage layout", () => {
  it("uses the shell main landmark without a second main or progress overlay", () => {
    expect(source).not.toMatch(/<main|ScrollProgress|z-\[600\]/);
    expect(hero).toContain('className="page-title');
    expect(hero).toContain("disabled: songs.length === 0");
  });

  it("keeps title space and card borders stable when selected", () => {
    expect(source).not.toContain("border-2 border-accent");
    expect(featuredCard).not.toContain("border-2 border-accent");
    // Song names stay on one line and end in an ellipsis, so the author line
    // never drifts away from a wrapped second line and every card is the same
    // height whether or not its title is long.
    expect(source).toContain("truncate text-sm font-semibold leading-5");
    expect(featuredCard).toContain("truncate text-sm font-semibold leading-5");
    expect(source).not.toContain("line-clamp-2 min-h-10");
    expect(featuredCard).not.toContain("line-clamp-2 min-h-10");
    expect(source).not.toContain("mask-image:");
  });
});

describe("active track marking", () => {
  it("marks every card type with aria-current, not only with colour", () => {
    // Four card components live in page.js, the fifth is its own module.
    expect(source.match(/aria-current=\{isActive \? "true" : undefined\}/g) ?? []).toHaveLength(4);
    expect(featuredCard).toMatch(/aria-current=\{isActive \? "true" : undefined\}/);
  });
});
