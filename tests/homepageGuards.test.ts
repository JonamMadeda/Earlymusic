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
  it("keeps section headers limited to titles and rail navigation", () => {
    expect(source).not.toContain("Play all");
    expect(source).not.toContain("View all");
    expect(source).not.toContain("onPlayAll");
    expect(source).not.toContain("cta=");
  });

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

describe("homepage active song motion", () => {
  it("marks the active card without a pulsing dot or equalizer bars", () => {
    for (const cardSource of [source, featuredCard]) {
      expect(cardSource).not.toContain("playing-pulse");
      expect(cardSource).not.toContain("animate-ping");
      expect(cardSource).not.toContain("waveform");
    }
  });
});

describe("homepage typography weights", () => {
  it("uses the app weight ladder without extra-heavy or normal badge text", () => {
    for (const cardSource of [source, featuredCard, hero]) {
      expect(cardSource).not.toMatch(/font-(black|normal)\b/);
    }
    expect(source).toContain("text-[10px] font-semibold uppercase leading-none tracking-wider text-ink");
    expect(hero).toContain("text-[10px] font-semibold uppercase");
    expect(hero).toContain("text-2xl font-bold text-white");
  });

  it("keeps compact metadata medium and rank numerals bold", () => {
    const metadata = source.slice(source.indexOf("const cardMetaLine"), source.indexOf("const ScrollToTop"));
    expect(metadata).toContain("shrink-0 font-medium tabular-nums");
    expect(metadata).toContain("min-w-0 truncate font-medium");
    expect(featuredCard).toContain("shrink-0 font-medium tabular-nums");
    expect(featuredCard).toContain("text-[9px] font-semibold uppercase");
    expect(source).toContain("text-xs font-bold tabular-nums text-neutral-600");
    expect(source).not.toContain("text-[11px] font-semibold leading-4 tabular-nums");
  });
});

describe("homepage card duration tags", () => {
  it("uses the tag-free length helper on every homepage card", () => {
    expect(source).not.toContain("sessionLengthLabel(");
    expect(source).toContain("homepageLengthLabel(");
    expect(featuredCard).not.toContain("sessionLengthLabel(");
    expect(featuredCard).toContain("homepageLengthLabel(");
  });
});

describe("homepage posture labels", () => {
  it("shows the curated posture once, not in both the metadata line and chip", () => {
    const recommendation = source.slice(
      source.indexOf("const RecommendationCard"),
      source.indexOf("const HistoryCard")
    );
    expect(recommendation, "RecommendationCard not found").not.toBe("");
    expect(recommendation).toContain("cardMetaLine({ song, showPosture: false })");
    expect(recommendation).toContain("{posture}");
  });
});

describe("homepage section artwork themes", () => {
  it("keeps navy artwork as the Featured section's signature treatment", () => {
    const spotify = source.slice(
      source.indexOf("const SpotifyCard"),
      source.indexOf("const RecommendationCard")
    );
    expect(spotify).toContain('backgroundColor: "#0f172a"');
  });

  it("keeps the app's neutral artwork treatment in the other homepage sections", () => {
    const rail = source.slice(
      source.indexOf("const SongRailCard"),
      source.indexOf("const SpotifyCard")
    );
    const recommendation = source.slice(
      source.indexOf("const RecommendationCard"),
      source.indexOf("const HistoryCard")
    );
    const history = source.slice(
      source.indexOf("const HistoryCard"),
      source.indexOf("const SectionBlock")
    );
    for (const card of [recommendation, history]) {
      expect(card).not.toContain('bg-[#0f172a]');
      expect(card).not.toContain('backgroundColor: "#0f172a"');
    }
    expect(history).toContain('variant="mono"');
    for (const card of [rail, recommendation]) {
      expect(card).toContain("border-neutral-300 bg-neutral-100");
      expect(card).toContain("text-accent");
    }
    expect(featuredCard).not.toContain("#0f172a");
    expect(featuredCard).toContain("border-neutral-300 bg-neutral-100");
    expect(featuredCard).toContain("text-accent");
  });

  it("uses navy letter tiles only for Suggested Starters", () => {
    const rail = source.slice(
      source.indexOf("const SongRailCard"),
      source.indexOf("const SpotifyCard")
    );
    const suggested = source.slice(
      source.indexOf('id="suggested-starters"'),
      source.indexOf('id="keep-exploring"')
    );
    const exploring = source.slice(
      source.indexOf('id="keep-exploring"'),
      source.indexOf('id="recommended"')
    );
    expect(rail).toContain('border-neutral-800 bg-[#0f172a] text-white');
    expect(rail).not.toContain("playing-pulse");
    expect(suggested).toContain("navyArtwork");
    expect(exploring).not.toContain("navyArtwork");
  });
});

describe("homepage weighted curation", () => {
  it("de-duplicates after shuffling so preferred tracks keep their extra weight", () => {
    const dedupe = ".filter((song, index, list) => list.findIndex((item) => item.id === song.id) === index)";
    for (const [name, shuffle] of [
      ["featured", "seededShuffle(mixed,"],
      ["explore", "seededShuffle(soakingFirst,"],
    ] as const) {
      const at = source.indexOf(shuffle);
      const after = source.indexOf(dedupe, at);
      expect(at, `${name} shuffle not found`).toBeGreaterThan(-1);
      expect(after, `${name} de-duplication must follow the shuffle`).toBeGreaterThan(at);
      expect(after - at, `${name} de-duplication is too far from its shuffle`).toBeLessThan(200);
    }
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

  it("offers only the category filters, without a duration dial", () => {
    expect(source).not.toContain('activeFilter === "short"');
    expect(source).not.toContain('label: "Quick Sessions"');
    expect(source).not.toContain('label: "Full Sessions"');
    expect(source).not.toContain("Select by Duration");
    for (const pill of ["All", "Praise", "Worship", "New"]) {
      expect(source).toContain(`label: "${pill}"`);
    }
    expect(source).not.toContain('{ id: "soaking"');
    expect(source).not.toContain('{ id: "devotional"');
    expect(source).not.toContain('{ id: "extended"');
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
    expect(source).not.toContain('aria-label="Play all from Curated for You"');
    expect(source).not.toContain('aria-label="View all from Curated for You"');
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

describe("homepage greeting", () => {
  it("shows the greeting without time-of-day tags", () => {
    expect(hero).toContain("greeting.text");
    expect(hero).not.toContain("greeting.watch");
    expect(hero).not.toMatch(/Morning Altar|Midday Sanctuary|Evening Vigil|Night Vigil/);
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

  it("keeps playback controls in the persistent player without hero duplicates", () => {
    for (const duplicate of [
      "usePlaybackStatus",
      "progressCard",
      'role="progressbar"',
      "requestTogglePlay",
      "formatTime",
      "Repeat All",
      "Worship Timer",
      "repeatMode",
      "setSleepTimer",
      "timerMenuOpen",
    ]) {
      expect(hero, `duplicate player UI: ${duplicate}`).not.toContain(duplicate);
    }
    expect(hero).toContain('label: "In your player"');
    expect(hero).toContain("requestOpenPlayer");
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
