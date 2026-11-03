#!/usr/bin/env node
/**
 * Move every account from the app's own user tables into Neon Auth.
 *
 * Source:  public.users (+ public.profiles, public.user_roles)
 * Target:  neon_auth.user (+ public.legacy_credentials for the password)
 *
 * User ids are carried over unchanged so playlists, saved songs and
 * listening history stay attached to the right person.
 *
 * Usage:
 *   node scripts/migrate-users-to-neon-auth.mjs            # dry run
 *   node scripts/migrate-users-to-neon-auth.mjs --apply    # write
 *   node scripts/migrate-users-to-neon-auth.mjs --verify    # compare only
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const readEnvFile = () => {
  try {
    const contents = readFileSync(join(root, ".env.local"), "utf8");
    for (const line of contents.split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] === undefined) {
        process.env[key] = rawValue.replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // No .env.local: rely on the environment.
  }
};

readEnvFile();

const databaseUrl = process.env.NEON_DATABASE_URL;
if (!databaseUrl) {
  console.error("NEON_DATABASE_URL is not set (add it to .env.local).");
  process.exit(1);
}

const sql = neon(databaseUrl);

const apply = process.argv.includes("--apply");
const verifyOnly = process.argv.includes("--verify");

const LEGACY_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS public.legacy_credentials (
  user_id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  upgraded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
`;

const LEGACY_TABLE_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS legacy_credentials_email_idx
  ON public.legacy_credentials (lower(email))
`;

const displayName = (profile, email) => {
  const first = (profile?.first_name || "").trim();
  const last = (profile?.last_name || "").trim();
  const combined = [first, last].filter(Boolean).join(" ");
  if (combined) return combined.slice(0, 80);
  return (email.split("@")[0] || "Member").slice(0, 80);
};

const readSource = async () => {
  const users = await sql.query(
    `SELECT id, email, password_hash, created_at
     FROM public.users
     ORDER BY created_at ASC`
  );
  const profiles = await sql.query(
    `SELECT id, first_name, last_name FROM public.profiles`
  );
  const roles = await sql.query(
    `SELECT user_id, role FROM public.user_roles`
  );

  const profileById = new Map(
    (profiles || []).map((p) => [p.id, p])
  );
  const adminIds = new Set(
    (roles || []).filter((r) => r.role === "admin").map((r) => r.user_id)
  );

  return (users || []).map((user) => ({
    id: user.id,
    email: String(user.email || "").toLowerCase(),
    passwordHash: user.password_hash,
    createdAt: user.created_at,
    name: displayName(profileById.get(user.id), user.email || ""),
    role: adminIds.has(user.id) ? "admin" : "user",
  }));
};

const readExisting = async () => {
  const existing = await sql.query(
    `SELECT id, email, role FROM neon_auth.user`
  );
  const byEmail = new Map();
  const byId = new Map();
  for (const row of existing || []) {
    byEmail.set(String(row.email || "").toLowerCase(), row);
    byId.set(row.id, row);
  }
  return { byEmail, byId };
};

const migrate = async () => {
  const source = await readSource();
  const { byEmail, byId } = await readExisting();

  console.log(`Accounts in public.users: ${source.length}`);
  console.log(`Accounts in neon_auth.user: ${byId.size}`);
  console.log("");

  const conflicts = [];
  const plan = [];

  for (const user of source) {
    const emailMatch = byEmail.get(user.email);
    if (emailMatch && emailMatch.id !== user.id) {
      conflicts.push({
        email: user.email,
        reason: `neon_auth.user already has this email with id ${emailMatch.id}`,
      });
      continue;
    }
    plan.push({ ...user, existingId: byId.get(user.id)?.id || null });
  }

  const admins = plan.filter((u) => u.role === "admin");

  console.log("Planned moves:");
  for (const user of plan) {
    const state = user.existingId ? "update" : "insert";
    console.log(
      `  [${state}] ${user.email}  id=${user.id}  role=${user.role}  name="${user.name}"`
    );
  }
  console.log("");
  console.log(`Administrators to carry over: ${admins.length}`);
  console.log(
    `Legacy passwords to park in public.legacy_credentials: ${plan.length}`
  );

  if (conflicts.length) {
    console.log("");
    console.log("Conflicts (skipped, resolve by hand):");
    for (const conflict of conflicts) {
      console.log(`  ${conflict.email}: ${conflict.reason}`);
    }
  }

  if (verifyOnly) return;

  if (!apply) {
    console.log("");
    console.log("Dry run. Re-run with --apply to write.");
    return;
  }

  console.log("");
  console.log("Writing...");
  await sql.query(LEGACY_TABLE_SQL);
  await sql.query(LEGACY_TABLE_INDEX_SQL);

  for (const user of plan) {
    await sql.query(
      `INSERT INTO neon_auth.user
         (id, name, email, "emailVerified", role, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, false, $4, COALESCE($5, now()), now())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         email = EXCLUDED.email,
         role = EXCLUDED.role,
         "updatedAt" = now()`,
      [user.id, user.name, user.email, user.role, user.createdAt]
    );

    if (user.passwordHash) {
      await sql.query(
        `INSERT INTO public.legacy_credentials (user_id, email, password_hash)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET
           email = EXCLUDED.email,
           password_hash = EXCLUDED.password_hash`,
        [user.id, user.email, user.passwordHash]
      );
    }
  }

  console.log(`Moved ${plan.length} accounts into neon_auth.user.`);
  console.log(
    "Their passwords stay valid: the first sign-in converts the bcrypt hash into a Neon Auth credential."
  );
};

const verify = async () => {
  const source = await readSource();
  const { byId, byEmail } = await readExisting();

  let ok = 0;
  const problems = [];

  for (const user of source) {
    const migrated = byId.get(user.id);
    if (!migrated) {
      problems.push(`${user.email}: missing in neon_auth.user`);
      continue;
    }
    if (String(migrated.email).toLowerCase() !== user.email) {
      problems.push(
        `${user.email}: neon_auth.user has ${migrated.email} under id ${user.id}`
      );
      continue;
    }
    const legacy = await sql.query(
      `SELECT upgraded_at FROM public.legacy_credentials WHERE user_id = $1`,
      [user.id]
    );
    const upgraded = legacy?.[0]?.upgraded_at ? "upgraded" : "legacy password parked";
    console.log(
      `  ok  ${user.email}  role=${migrated.role}  (${upgraded})`
    );
    ok++;
  }

  console.log("");
  console.log(`Verified ${ok}/${source.length} accounts.`);

  const { rows: extra } = await sql.query(
    `SELECT email FROM neon_auth.user
     WHERE id NOT IN (SELECT id FROM public.users)`
  );
  if (extra?.length) {
    console.log(
      `New accounts registered in Neon Auth (not in public.users): ${extra.length}`
    );
  }

  if (problems.length) {
    console.log("");
    console.log("Problems:");
    for (const problem of problems) console.log(`  ${problem}`);
    process.exitCode = 1;
  }
};

try {
  if (verifyOnly) await verify();
  else await migrate();
} catch (error) {
  console.error("Migration failed:", error?.message || error);
  process.exit(1);
}
