#!/usr/bin/env node
/**
 * Apply one of the repo's schema files (lib/migration-*.sql) to the database.
 *
 * The app never runs DDL, so these files have to be executed from outside a
 * request. This does that against the same Neon database the app uses.
 *
 * Usage:
 *   node scripts/apply-sql-migration.mjs                     # all known files
 *   node scripts/apply-sql-migration.mjs lib/migration-notifications.sql
 *
 * Additive by convention: every file here uses CREATE ... IF NOT EXISTS, so
 * re-running is safe and no existing row is touched.
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

const files = process.argv.slice(2).filter((arg) => arg.startsWith("lib/"));
if (files.length === 0) {
  console.error("Give at least one lib/migration-*.sql file to apply.");
  process.exit(1);
}

const statementsIn = (text) =>
  text
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

// The HTTP driver resolves to a bare array of rows unless a parameter list is
// passed, which is what lib/neon.js normalises too.
const rowsOf = (result) => (Array.isArray(result) ? result : result?.rows ?? []);

for (const file of files) {
  const path = join(root, file);
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    console.error(`Could not read ${file}.`);
    process.exit(1);
  }

  console.log(`\n# ${file}`);
  for (const statement of statementsIn(text)) {
    const label = statement.split("\n")[0].slice(0, 64);
    try {
      await sql.query(statement);
      console.log(`  ok    ${label}`);
    } catch (error) {
      console.error(`  FAIL  ${label}\n        ${error.message}`);
      process.exitCode = 1;
      break;
    }
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
