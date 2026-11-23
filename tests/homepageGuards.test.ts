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
const scrollToTop = source.slice(
  source.indexOf("const ScrollToTop = "),
  source.indexOf("/* --- COMPACT")
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

describe("homepage card duration tags", () => {
  it("uses the tag-free length helper on every homepage card", () => {
    expect(source).not.toContain("sessionLengthLabel(");
    expect(source).toContain("homepageLengthLabel(");
    expect(featuredCard).not.toContain("sessionLengthLabel(");
    expect(featuredCard).toContain("homepageLengthLabel(");
    expect(source).toContain('{ id: "short", label: "Short" }');
  });
});

describe("curated for you filter pills", () => {
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

describe("homepage shelf headings", () => {
  it("uses the exact warm, familiar shelf names", () => {
    for (const heading of [
      'title="Continue Listening"',
      'title="Recently Added"',
      'title="Featured"',
      'title="Keep Exploring"',
      "Curated for You",
    ]) {
      expect(source, `missing heading: ${heading}`).toContain(heading);
    }
    for (const oldHeading of [
      'title="Continue Where You Left Off"',
      'title="Praise Songs"',
      'title="New Songs"',
      'title="More Songs to Explore"',
      "Browse All Songs",
      "browse-songs-title",
      'title="Continue Your Worship"',
      'title="Praise & Adoration"',
      'title="New Worship Recordings"',
      'title="Full Worship Archive"',
      "Browse Worship Sessions",
      "browse-sessions-title",
      'title="Resume Worship"',
      'title="Newly Recorded"',
      'title="Deeper Sessions"',
      "Session Index",
      "session-index-title",
      'title="Continue Worshipping"',
      'title="Signature Sessions"',
      'title="Recent Sessions"',
      'title="From the Archive"',
    ]) {
      expect(source, `stale heading: ${oldHeading}`).not.toContain(oldHeading);
    }
    expect(source).toContain('aria-labelledby="curated-for-you-title"');
    expect(source).not.toContain('subtitle="');
    expect(source).not.toContain("Filter by praise, worship, length, or new");
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain("Matching sessions: ");
  });

  it("points hero jumps at the exact shelf names", () => {
    expect(hero).toContain('href="#newest-songs"');
    expect(hero).toContain('href="#recently-played"');
    expect(hero).toContain('href="#featured-songs"');
    expect(hero).toContain("Continue Listening");
    expect(hero).toContain("Featured");
    expect(hero).toContain("recently added");
    expect(hero).not.toContain("Continue Where You Left Off");
    expect(hero).not.toContain("Praise Songs");
    expect(hero).not.toContain("new songs");
    expect(hero).not.toContain("Continue Your Worship");
    expect(hero).not.toContain("Praise & Adoration");
    expect(hero).not.toContain("new recordings");
    expect(hero).not.toContain("Resume Worship");
    expect(hero).not.toContain("newly recorded");
    expect(hero).not.toContain("Continue Worshipping");
    expect(hero).not.toContain("Signature Sessions");
    expect(hero).not.toContain("recent sessions");
    expect(hero).not.toContain("Recently played");
    expect(hero).not.toContain("new this week");
    expect(source).toContain('aria-label="Play all from Curated for You"');
    expect(source).toContain('aria-label="View all from Curated for You"');
    expect(source).toContain('aria-label="Filter Curated for You"');
    expect(source).toContain("scrollable worship sessions");
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

describe("homepage banner", () => {
  it("uses a restrained navy wash instead of a plain white panel", () => {
    expect(hero).toContain(
      "border-accent/10 bg-gradient-to-br from-accent/[0.07] via-white to-accent/[0.025]"
    );
    expect(hero).toContain("border-accent/10 bg-accent/[0.05]");
    expect(hero).not.toContain("border-neutral-200 bg-white p-4");
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

describe("homepage back-to-top button", () => {
  it("raises itself only while the bottom player is active", () => {
    expect(scrollToTop).toContain("hasPlayer ? \"bottom-40 md:bottom-24\" : \"bottom-24 md:bottom-8\"");
    expect(scrollToTop).not.toMatch(/className="[^"]*\bbottom-/);
    expect(source).toContain("<ScrollToTop visible={scrollY > 400} hasPlayer={Boolean(activeSong)} />");
  });
});
