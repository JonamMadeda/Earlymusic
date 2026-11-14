import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { executableStatements, splitSqlStatements } from "../lib/sqlSplit.js";

const repoFile = (name) => readFileSync(new URL(`../lib/${name}`, import.meta.url), "utf8");

describe("splitSqlStatements", () => {
  it("keeps a dollar-quoted body in one statement", () => {
    const sql = `DO $x$ BEGIN
  UPDATE public.songs SET title = 'a';
END $x$;
SELECT 1;`;

    const statements = splitSqlStatements(sql);

    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain("SET title = 'a';");
  });

  it("does not split on a semicolon inside a string literal", () => {
    expect(splitSqlStatements(`SELECT 'keep; me';`)).toEqual(["SELECT 'keep; me'"]);
  });

  it("does not split on a semicolon inside a comment", () => {
    expect(splitSqlStatements(`-- note; here\nSELECT 1;`)).toEqual(["SELECT 1"]);
  });

  it("treats a doubled quote as an escape, not the end of the literal", () => {
    expect(splitSqlStatements(`SELECT 'it''s; fine';`)).toEqual(["SELECT 'it''s; fine'"]);
  });

  it("handles nested block comments", () => {
    expect(splitSqlStatements(`/* a /* b; still c */ d */ SELECT 1;`)).toEqual(["SELECT 1"]);
  });

  it("keeps a statement that has no trailing semicolon", () => {
    expect(splitSqlStatements("SELECT 1")).toEqual(["SELECT 1"]);
  });
});

describe("executableStatements", () => {
  it("drops bare transaction markers and reports how many", () => {
    const { statements, droppedTransactionMarkers } = executableStatements(
      "BEGIN;\nSELECT 1;\nCOMMIT;"
    );

    expect(statements).toEqual(["SELECT 1"]);
    expect(droppedTransactionMarkers).toBe(2);
  });

  it("does not drop a statement that merely starts with BEGIN", () => {
    const { statements, droppedTransactionMarkers } = executableStatements(
      "DO $x$ BEGIN NULL; END $x$;"
    );

    expect(statements).toHaveLength(1);
    expect(droppedTransactionMarkers).toBe(0);
  });
});

describe("repository migration files split correctly", () => {
  it("keeps the Supabase is_admin() function body intact", () => {
    const { statements } = executableStatements(repoFile("migration.sql"));
    const functionStatements = statements.filter((statement) =>
      statement.startsWith("CREATE OR REPLACE FUNCTION")
    );

    expect(functionStatements).toHaveLength(1);
    expect(functionStatements[0]).toContain("WHERE user_id = auth.uid() AND role = 'admin'");
  });

  it("reduces the FK migration to its six ALTER statements", () => {
    const { statements, droppedTransactionMarkers } = executableStatements(
      repoFile("migration-user-fks-to-neon-auth.sql")
    );

    expect(droppedTransactionMarkers).toBe(2);
    expect(statements).toHaveLength(6);
    expect(statements.every((statement) => statement.startsWith("ALTER TABLE"))).toBe(true);
  });

  it("splits the captured core tables into four runnable statements", () => {
    const { statements } = executableStatements(repoFile("migration-core-tables.sql"));

    expect(statements).toHaveLength(4);
    expect(statements[3]).toContain("ADD CONSTRAINT profiles_id_fkey");
  });

  it("keeps each guarded block of the song FK migration whole", () => {
    const { statements } = executableStatements(repoFile("migration-song-fks.sql"));

    expect(statements).toHaveLength(2);
    // Three ALTERs live inside the first body; splitting on ";" would leak them
    // out as standalone statements and fail to parse.
    expect(statements[0].match(/ADD CONSTRAINT/g)).toHaveLength(3);
    expect(statements[1]).toContain("DROP CONSTRAINT dmca_reports_song_id_fkey");
  });
});
