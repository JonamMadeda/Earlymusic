import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  LEGAL_EFFECTIVE_DATE,
  LEGAL_EMAIL,
  LEGAL_LAST_UPDATED,
  LEGAL_MAILTO,
  LEGAL_PRIVACY_VERSION,
  LEGAL_TERMS_LAST_UPDATED,
  LEGAL_TERMS_VERSION,
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

  it("versions the revised Terms independently of the unchanged Privacy Policy", () => {
    expect(LEGAL_TERMS_VERSION).toBe("2026-11-26");
    expect(LEGAL_TERMS_LAST_UPDATED).toBe("November 26, 2026");
    expect(LEGAL_PRIVACY_VERSION).toBe("2026-11-09");
    expect(LEGAL_LAST_UPDATED).toBe("November 9, 2026");
  });
});

describe("music rights terms and links", () => {
  it("publishes the archive-use wording and revised Terms date", () => {
    const source = readFileSync(new URL("../app/terms/page.js", import.meta.url), "utf8");
    const copy = source.replace(/\s+/g, " ");

    expect(copy).toContain("lastUpdated={LEGAL_TERMS_LAST_UPDATED}");
    expect(copy).toContain("Luumbo is a worship archive");
    expect(copy).toContain("does not mean Luumbo owns the underlying song");
    expect(copy).toContain("Luumbo does not claim ownership of third-party songs");
    expect(copy).toContain("not sold or offered for commercial redistribution");
    expect(copy).toContain("Archive recording tag means the ownership classification has not yet been verified");
    expect(copy).toContain("Rights &amp; archive use");
    expect(copy).toContain("before publishing it");
  });

  it.each(["app/settings/page.js", "app/account/page.js"])("links %s to the music-rights section", (path) => {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    expect(source).toMatch(/<Link\s+href="\/terms#content"[^>]*>\s*Music rights\s*<\/Link>/);
  });
});
