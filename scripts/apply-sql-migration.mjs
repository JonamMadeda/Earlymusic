#!/usr/bin/env node
/**
 * Apply the repo's schema files (lib/migration-*.sql) to the database.
 *
 * The app never runs DDL, so these files have to be executed from outside a
 * request. This does that against the same Neon database the app uses.
 *
 * Usage:
 *   node scripts/apply-sql-migration.mjs --status
 *   node scripts/apply-sql-migration.mjs lib/migration-notifications.sql
 *   node scripts/apply-sql-migration.mjs --all
 *
 * --status prints which files public.schema_migrations has recorded; --all
 * applies every lib/migration*.sql not yet recorded, in filename order.
 *
 * Most files are additive (CREATE ... IF NOT EXISTS) so re-running them is
 * harmless, but the UPDATE-only ones (relative song paths, placeholder names)
 * are worth running once. schema_migrations exists so "has this actually run
 * against production?" has an answer that is not a guess.
 *
 * NOTE: lib/migration.sql is Supabase-era (auth.uid(), RLS policies,
 * uuid_generate_v4) and will not execute against Neon. It is kept for history.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { executableStatements } from "../lib/sqlSplit.js";

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

const rowsOf = (result) => (Array.isArray(result) ? result : result?.rows ?? []);

const TRACKING_DDL = `CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  statements INTEGER NOT NULL DEFAULT 0
)`;

const repoMigrations = () =>
  readdirSync(join(root, "lib"))
    .filter((name) => name.startsWith("migration") && name.endsWith(".sql"))
    .map((name) => `lib/${name}`)
    .sort();

const applyFile = async (file) => {
  let text;
  try {
    text = readFileSync(join(root, file), "utf8");
  } catch {
    console.error(`Could not read ${file}.`);
    return { ok: false, ran: 0 };
  }

  console.log(`\n# ${file}`);

  const { statements, droppedTransactionMarkers } = executableStatements(text);
  if (droppedTransactionMarkers) {
    console.log(
      `  note  dropped ${droppedTransactionMarkers} BEGIN/COMMIT: statements autocommit individually.`
    );
  }

  let ran = 0;
  for (const statement of statements) {
    const label = statement.split("\n")[0].slice(0, 64);
    try {
      await sql.query(statement);
      ran += 1;
      console.log(`  ok    ${label}`);
    } catch (error) {
      console.error(`  FAIL  ${label}\n        ${error.message}`);
      return { ok: false, ran };
    }
  }

  try {
    await sql.query(
      `INSERT INTO public.schema_migrations (filename, statements)
       VALUES ($1, $2)
       ON CONFLICT (filename) DO UPDATE SET applied_at = NOW(), statements = $2`,
      [file, ran]
    );
  } catch (error) {
    console.error(`  warn  could not record ${file}: ${error.message}`);
  }

  return { ok: true, ran };
};

const argv = process.argv.slice(2);

await sql.query(TRACKING_DDL);

if (argv.includes("--status")) {
  const applied = rowsOf(
    await sql.query("SELECT filename, applied_at, statements FROM public.schema_migrations ORDER BY filename")
  );
  const known = new Map(applied.map((row) => [row.filename, row]));
  console.log("\nmigrations:");
  for (const file of repoMigrations()) {
    const row = known.get(file);
    console.log(`  ${row ? "applied" : "   never"}  ${file}${row ? ` (${row.statements} statements, ${new Date(row.applied_at).toISOString().slice(0, 10)})` : ""}`);
    known.delete(file);
  }
  for (const [file] of known) console.log(`  removed    ${file} (applied but no longer in lib/)`);
  process.exit(0);
}

const explicit = argv.filter((arg) => arg.startsWith("lib/"));
let targets;
if (argv.includes("--all")) {
  const applied = new Set(
    rowsOf(await sql.query("SELECT filename FROM public.schema_migrations")).map((r) => r.filename)
  );
  targets = repoMigrations().filter((file) => !applied.has(file));
  if (!targets.length) console.log("Every lib/migration*.sql is already recorded.");
} else {
  targets = explicit;
}

if (!targets.length && !argv.includes("--all")) {
  console.error("Give one or more lib/migration-*.sql files, or pass --all / --status.");
  process.exit(1);
}

for (const file of targets) {
  const { ok } = await applyFile(file);
  // Files are order-dependent (later ones reference earlier tables), so a
  // failure stops the run instead of pressing on into a half-built schema.
  if (!ok) {
    console.error(`\nStopped: ${file} did not apply cleanly.`);
    process.exit(1);
  }
}

const check = rowsOf(
  await sql.query(
    `SELECT table_name,
            (SELECT count(*) FROM information_schema.columns c
              WHERE c.table_name = t.table_name) AS columns
       FROM information_schema.tables t
      WHERE t.table_schema = 'public'
      ORDER BY table_name`
  )
);
console.log("\npublic tables:");
for (const row of check) console.log(`  ${row.table_name} (${row.columns} columns)`);
