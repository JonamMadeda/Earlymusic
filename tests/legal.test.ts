import { describe, expect, it } from "vitest";
import {
  LEGAL_EFFECTIVE_DATE,
  LEGAL_EMAIL,
  LEGAL_LAST_UPDATED,
  LEGAL_MAILTO,
} from "../lib/legal";

describe("legal contact configuration", () => {
  it("builds a mailto link from the configured address", () => {
    expect(LEGAL_MAILTO).toBe(`mailto:${LEGAL_EMAIL}`);
    expect(LEGAL_EMAIL).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/);
  });

  it("does not fall back to a reserved placeholder domain", () => {
    // `.example` is reserved by RFC 2606 and can never receive mail, which is
    // exactly the bug this module exists to prevent.
    expect(LEGAL_EMAIL.endsWith(".example")).toBe(false);
  });

  it("publishes parseable dates", () => {
    expect(Number.isNaN(Date.parse(LEGAL_EFFECTIVE_DATE))).toBe(false);
    expect(Number.isNaN(Date.parse(LEGAL_LAST_UPDATED))).toBe(false);
    expect(Date.parse(LEGAL_LAST_UPDATED)).toBeGreaterThanOrEqual(
      Date.parse(LEGAL_EFFECTIVE_DATE)
    );
  });
});
