import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The A-Z rail shares the row with the song list, so every pixel of its column
// and of the gap beside it comes off the rows. It was a bordered white card
// (25px column + 12px gap at 411px) around 20px letters.
const songs = readFileSync(new URL("../app/songs/songs-view.js", import.meta.url), "utf8");
const rail = songs.slice(
  songs.indexOf("Alphabet Jump Bar"),
  songs.indexOf("{railLabel(group)}"),
);

describe("songs alphabet rail", () => {
  it("is the block this file describes", () => {
    expect(rail.length, "rail slice not found").toBeGreaterThan(200);
  });

  it("wears no card of its own", () => {
    expect(rail).not.toMatch(/bg-white\/90/);
    expect(rail).not.toMatch(/border-neutral-200/);
    expect(rail).not.toMatch(/px-0\.5/);
    expect(rail).not.toMatch(/backdrop-blur/);
    expect(songs).toMatch(/className="flex gap-1\.5 sm:gap-4"/);
  });

  it("reserves the track's width in flow and pins the track itself", () => {
    // Date sort labels are three characters ("Jan"), so the track is two glyphs
    // wide; the placeholder keeps the rows clear of the fixed overlay.
    expect(rail).toMatch(/w-6 shrink-0 sm:w-7/);
    expect(rail).toMatch(/fixed z-30/);
    expect(rail).toMatch(/whitespace-nowrap/);
    expect(rail).not.toMatch(/(?<!min-)w-4/);
  });

  it("overrides the unlayered touch floor for the continuous index only", () => {
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    expect(rail).toContain("songs-index");
    expect(rail).not.toContain("tap-sm");
    expect(css).toMatch(/\.songs-index button\s*\{\s*min-height: 0;\s*min-width: 0;/);
    expect(css).toMatch(/@media \(pointer: coarse\)[\s\S]*?min-height: 44px/);
  });

  it("halves the full-list height and scrolls the remaining letters inside", () => {
    expect(rail).toContain("songGroups.length > 1");
    expect(songs).toContain("Math.max(4, Math.ceil(songGroups.length / 2))");
    expect(songs).toContain("visibleGroups * 24 + 12");
  });

  it("scrubs with a mouse, taps with touch and respects reduced motion", () => {
    expect(songs).toContain('scrollToLetter(nearest, "instant")');
    expect(songs).toContain('(prefers-reduced-motion: reduce)');
    expect(rail).toContain('if (e.pointerType !== "mouse" || e.button !== 0) return;');
    expect(rail).toContain("onClick={() => scrollToLetter(group.key)}");
    expect(rail).toContain('touchAction: "pan-y"');
    expect(rail).toContain('aria-current={(jumpLetter || activeGroupKey) === group.key ? "location" : undefined}');
  });

  it("keeps the letters stacked without gaps to tap between", () => {
    expect(rail).not.toMatch(/gap-px/);
  });

  it("fits the safe area and hides the scrollbar on its own scroll area", () => {
    expect(songs).toMatch(/const measureRail = \(\) =>/);
    expect(songs).toMatch(/bottom = Math\.min\(bottom, rect\.top\)/);
    expect(songs).toMatch(/Math\.max\(0, bottom - STICKY_TOP - top\)/);
    expect(songs).toMatch(/new ResizeObserver\(measureRail\)/);
    expect(songs).toMatch(/viewport\?\.addEventListener\("resize", measureRail\)/);
    expect(songs).toMatch(/observer\.disconnect\(\)/);
    expect(songs).toMatch(/"bottom-nav", "now-playing-bar", "mobile-now-playing-bar"/);
    expect(rail).toMatch(/justify-start/);
    expect(rail).toMatch(/h-6 min-h-0 w-full shrink-0 cursor-pointer/);
    expect(rail).toMatch(/overflow-y-auto/);
    expect(songs).toMatch(/rail\.scrollTop/);
    expect(songs).toMatch(/revealRailLetter\(activeGroupKey\)/);

    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.songs-index\s*\{[^}]*scrollbar-width: none/);
    expect(css).toMatch(/\.songs-index::-webkit-scrollbar\s*\{\s*display: none/);
  });
});
