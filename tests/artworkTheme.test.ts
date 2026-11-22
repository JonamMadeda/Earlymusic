import { afterEach, describe, expect, it, vi } from "vitest";

const canvas = {
  fillStyle: "",
  strokeStyle: "",
  lineWidth: 0,
  font: "",
  textAlign: "",
  textBaseline: "",
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  stroke: vi.fn(),
  fillText: vi.fn(),
};

vi.mock("@/app/components/SongAvatar", () => ({
  initialLetter: () => "N",
}));

import { getSongArtwork } from "../lib/artwork";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("MediaSession artwork", () => {
  it("uses the white app-theme tile instead of a colored gradient", () => {
    const fills: string[] = [];
    const strokes: string[] = [];
    Object.defineProperty(canvas, "fillStyle", {
      get: () => fills[fills.length - 1] ?? "",
      set: (value: string) => { fills.push(value); },
      configurable: true,
    });
    Object.defineProperty(canvas, "strokeStyle", {
      get: () => strokes[strokes.length - 1] ?? "",
      set: (value: string) => { strokes.push(value); },
      configurable: true,
    });

    vi.stubGlobal("document", {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => canvas,
        toDataURL: () => "data:image/png;base64,white",
      }),
    });

    expect(getSongArtwork("Nitasimama")).toBe("data:image/png;base64,white");
    expect(fills).toContain("#ffffff");
    expect(fills).toContain("#0f172a");
    expect(strokes).toContain("rgba(15,23,42,0.08)");
    expect(canvas.createLinearGradient).not.toHaveBeenCalled();
    expect(canvas.fillText).toHaveBeenCalledWith("N", 256, 268);
  });
});
