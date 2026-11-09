import { describe, expect, it } from "vitest";
import { formatTime, sumDurations, toSeconds } from "../lib/timeFormat";

describe("time formatting", () => {
  it("reads short tracks as minutes and seconds", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(9)).toBe("0:09");
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(599)).toBe("9:59");
  });

  it("switches to hours for long sets instead of showing 90:00", () => {
    expect(formatTime(3600)).toBe("1:00:00");
    expect(formatTime(5400)).toBe("1:30:00");
    expect(formatTime(3661)).toBe("1:01:01");
  });

  it("parses the text duration column Postgres actually returns", () => {
    expect(toSeconds("245")).toBe(245);
    expect(toSeconds(245)).toBe(245);
    expect(toSeconds("245.7")).toBe(245.7);
  });

  it("treats missing and malformed durations as unknown, not zero", () => {
    expect(toSeconds(null)).toBeNull();
    expect(toSeconds(undefined)).toBeNull();
    expect(toSeconds("")).toBeNull();
    expect(toSeconds("abc")).toBeNull();
    expect(toSeconds(-5)).toBeNull();
    expect(toSeconds(Number.POSITIVE_INFINITY)).toBeNull();
    expect(formatTime(null)).toBe("0:00");
  });

  it("totals a queue and reports how much of it was measurable", () => {
    expect(
      sumDurations([{ duration: "60" }, { duration: 90 }, { duration: null }, {}])
    ).toEqual({ seconds: 150, known: 2, total: 4 });
    expect(sumDurations([])).toEqual({ seconds: 0, known: 0, total: 0 });
    expect(sumDurations(null)).toEqual({ seconds: 0, known: 0, total: 0 });
  });
});