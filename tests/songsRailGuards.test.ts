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

  it("keeps the letters stacked without gaps to tap between", () => {
    expect(rail).not.toMatch(/gap-px/);
  });

  it("fits the safe area instead of becoming a second scroll area", () => {
    // A touch on the column is a scrub, never a flick that scrolls it, so the
    // letters share the measured height rather than hide below the fold. The
    // budget is the scroller's bottom minus the player chrome minus the rail's
    // top — in flow the tail used to sit behind the mini-player.
    expect(songs).toMatch(/const measureRail = useCallback/);
    expect(songs).toMatch(/scRect\.bottom - chrome - top/);
    expect(rail).toMatch(/justify-between/);
    expect(rail).toMatch(/min-h-0 w-full flex-1/);
    expect(rail).not.toMatch(/overflow-y-auto|no-scrollbar/);
    expect(songs).not.toMatch(/rail\.scrollTop/);
  });
});
