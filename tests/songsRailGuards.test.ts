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

  it("reserves one glyph of width on a phone and grows only when the label needs it", () => {
    // Date sort labels are three characters ("Jan"), so a fixed w-4 clips them.
    // The phone column is one glyph wide (14px) because every pixel of it comes
    // off the rows beside it.
    expect(rail).toMatch(/min-w-3\.5/);
    expect(rail).toMatch(/whitespace-nowrap/);
    expect(rail).not.toMatch(/(?<!min-)w-4/);
    expect(rail).not.toMatch(/(?<!min-)w-5/);
    expect(rail).not.toMatch(/min-w-4/);
  });

  it("keeps the letters stacked without gaps to tap between", () => {
    expect(rail).not.toMatch(/gap-px/);
  });

  it("fits the screen instead of becoming a second scroll area", () => {
    // A touch on the column is a scrub, never a flick that scrolls it, so the
    // letters have to compress rather than hide below the fold.
    expect(rail).toMatch(/overflow-hidden/);
    expect(rail).not.toMatch(/overflow-y-auto|shrink-0 items-center/);
    expect(rail).toMatch(/min-h-0/);
    expect(rail).toMatch(/maxHeight: `calc\(100dvh - \$\{STICKY_TOP \+ 150\}px\)`/);
  });
});
