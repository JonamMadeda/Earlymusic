import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");

describe("app button shape", () => {
  it("rounds every button, including older radius utilities", () => {
    expect(css).toMatch(/@layer base\s*\{\s*button\s*\{\s*border-radius:\s*9999px;/);
    expect(css).toMatch(
      /@layer utilities\s*\{[\s\S]*?button\.rounded-md,[\s\S]*?button\.rounded-lg,[\s\S]*?border-radius:\s*9999px;/
    );
  });

  it("leaves role=button cards on their own radius", () => {
    expect(css).not.toMatch(/\[role="button"\][^{]*\{\s*border-radius:\s*9999px/);
  });
});
