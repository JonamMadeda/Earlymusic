import { describe, expect, it } from "vitest";
import {
  normalizeEmail,
  passwordByteLength,
  validateEmail,
  validatePassword,
} from "../lib/authValidation";

describe("auth validation", () => {
  it("normalizes email casing and surrounding whitespace", () => {
    expect(normalizeEmail("  Listener@Example.COM ")).toBe("listener@example.com");
    expect(normalizeEmail(null)).toBe("");
  });

  it("accepts normal addresses and rejects malformed ones", () => {
    expect(validateEmail("listener@example.com")).toBeNull();
    expect(validateEmail("not-an-email")).toMatch(/valid email/);
    expect(validateEmail("")).toMatch(/required/);
  });

  it("enforces the password length and non-blank rules", () => {
    expect(validatePassword("a-good-passphrase")).toBeNull();
    expect(validatePassword("short")).toMatch(/at least 8/);
    expect(validatePassword("        ")).toMatch(/only spaces/);
  });

  it("enforces the 72-byte bcrypt boundary for multibyte input", () => {
    expect(passwordByteLength("é".repeat(36))).toBe(72);
    expect(validatePassword("é".repeat(36))).toBeNull();
    expect(validatePassword("é".repeat(37))).toMatch(/72 bytes/);
  });
});
