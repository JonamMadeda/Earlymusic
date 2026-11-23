import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");

describe("app button shape", () => {
  it("rounds buttons to one shared radius", () => {
    expect(css).toMatch(/--radius-button:\s*1rem;/);
    expect(css).toMatch(
      /@layer base\s*\{\s*button:not\(\[class\*="rounded-"\]\)\s*\{\s*border-radius:\s*var\(--radius-button\);/
    );
    expect(css).toMatch(
      /@layer utilities\s*\{[\s\S]*?button\.rounded-md,[\s\S]*?button\.rounded-lg,[\s\S]*?border-radius:\s*var\(--radius-button\);/
    );
  });

  it("raises only the named side of a directional radius", () => {
    expect(css).toMatch(
      /button\.rounded-l-lg,[\s\S]*?border-top-left-radius:\s*var\(--radius-button\);\s*border-bottom-left-radius:\s*var\(--radius-button\);/
    );
    expect(css).toMatch(
      /button\.rounded-r-lg,[\s\S]*?border-top-right-radius:\s*var\(--radius-button\);\s*border-bottom-right-radius:\s*var\(--radius-button\);/
    );
  });

  it("uses the same radius for the shared button patterns", () => {
    for (const pattern of ["btn-primary", "btn-secondary", "btn-tertiary", "btn-destructive", "btn-destructive-outline"]) {
      expect(css).toMatch(new RegExp(`\\.${pattern}\\s*\\{[^}]*rounded-button`));
    }
  });

  it("leaves circular icon buttons and role=button cards alone", () => {
    expect(css).not.toMatch(/button\.rounded-full/);
    expect(css).not.toMatch(/\[role="button"\][^{]*\{\s*border-radius:/);
  });
});
