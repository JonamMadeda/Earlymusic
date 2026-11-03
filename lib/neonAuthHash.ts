import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number }
) => Promise<Buffer>;

// Better Auth's default password hashing. These parameters are what
// Neon Auth stores in neon_auth.account.password as "<salt>:<hash>".
const SCRYPT = { N: 16384, r: 16, p: 1 };
const KEY_LENGTH = 64;
// Node's default maxmem (32 MiB) is exactly what N=16384/r=16 needs, so
// it fails with ERR_CRYPTO_INVALID_SCRYPT_PARAMS. Give it headroom.
const MAX_MEM = 64 * 1024 * 1024;

const SALT_BYTES = 16;

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const key = await scryptAsync(
    password.normalize("NFKC"),
    salt,
    KEY_LENGTH,
    { ...SCRYPT, maxmem: MAX_MEM }
  );
  return `${salt}:${key.toString("hex")}`;
};

export const verifyPassword = async (
  password: string,
  stored: string | null | undefined
): Promise<boolean> => {
  if (typeof password !== "string" || typeof stored !== "string") return false;

  const separator = stored.indexOf(":");
  if (separator <= 0) return false;

  const salt = stored.slice(0, separator);
  const expected = stored.slice(separator + 1);
  if (!/^[0-9a-f]{32}$/i.test(salt)) return false;
  if (!/^[0-9a-f]{128}$/i.test(expected)) return false;

  try {
    const key = await scryptAsync(
      password.normalize("NFKC"),
      salt,
      KEY_LENGTH,
      { ...SCRYPT, maxmem: MAX_MEM }
    );
    const actual = Buffer.from(key.toString("hex"), "utf8");
    const target = Buffer.from(expected.toLowerCase(), "utf8");
    return actual.length === target.length && timingSafeEqual(actual, target);
  } catch {
    return false;
  }
};
