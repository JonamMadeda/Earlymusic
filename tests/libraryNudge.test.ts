import { describe, expect, it } from "vitest";
import { libraryNudgeWindow } from "../lib/libraryNudge";

describe("library spotlight nudge", () => {
  const at = (day: number, hour: number, minute: number) =>
    new Date(2026, 10, day, hour, minute, 0, 0);

  it("uses one short window per day", () => {
    const hours = new Set<number>();
    for (let day = 1; day <= 31; day += 1) {
      for (let hour = 0; hour < 24; hour += 1) {
        const window = libraryNudgeWindow(at(day, hour, 0));
        if (window) hours.add(hour);
      }
    }
    expect(hours.size).toBeGreaterThan(1);
    expect([...hours].every((hour) => [7, 12, 18].includes(hour))).toBe(true);
  });

  it("only shows inside the chosen window, not all day", () => {
    const day = 19;
    const morning = libraryNudgeWindow(at(day, 7, 0));
    const lunch = libraryNudgeWindow(at(day, 12, 0));
    const evening = libraryNudgeWindow(at(day, 18, 0));
    const active = [morning, lunch, evening].filter(Boolean);

    expect(active).toHaveLength(1);
    const chosen = active[0]!;
    expect(chosen.label).toMatch(/morning|lunch|evening/);
    expect(libraryNudgeWindow(at(day, 20, 0))).toBeNull();
    expect(libraryNudgeWindow(at(day, 23, 59))).toBeNull();
  });

  it("expires after 45 minutes", () => {
    let activeHour = -1;
    for (let hour = 0; hour < 24; hour += 1) {
      if (libraryNudgeWindow(at(20, hour, 0))) activeHour = hour;
    }
    expect(activeHour).toBeGreaterThan(-1);
    expect(libraryNudgeWindow(at(20, activeHour, 44))).not.toBeNull();
    expect(libraryNudgeWindow(at(20, activeHour, 45))).toBeNull();
  });
});
