import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../lib/neonAuthHash";

describe("Neon Auth password hashes", () => {
  it("round-trips a password without storing plaintext", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(hash).not.toContain("correct horse");
    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });

  it("uses a fresh salt for each hash", async () => {
    const first = await hashPassword("same-password");
    const second = await hashPassword("same-password");
    expect(first).not.toBe(second);
  });

  it("rejects malformed or missing hashes", async () => {
    await expect(verifyPassword("password", null)).resolves.toBe(false);
    await expect(verifyPassword("password", "not-a-hash")).resolves.toBe(false);
    await expect(verifyPassword("password", "00:00")).resolves.toBe(false);
  });
});
