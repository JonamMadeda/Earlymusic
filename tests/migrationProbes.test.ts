import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  SUPABASE_ONLY_MIGRATIONS,
  classifyMigration,
  presenceProbes,
  shouldApply,
} from "../lib/migrationProbes.js";

const libDir = new URL("../lib/", import.meta.url);
const repoMigrations = () =>
  readdirSync(libDir)
    .filter((name) => name.startsWith("migration") && name.endsWith(".sql"))
    .map((name) => `lib/${name}`)
    .sort();

describe("migration presence probes", () => {
  it("covers every migration file in the repo", () => {
    for (const file of repoMigrations()) {
      const covered = file in presenceProbes || SUPABASE_ONLY_MIGRATIONS.includes(file);
      expect(covered, `${file} needs a probe or a supabase-only entry`).toBe(true);
    }
  });

  it("lists no file that is not actually in the repo", () => {
    const known = new Set(repoMigrations());
    for (const file of [...Object.keys(presenceProbes), ...SUPABASE_ONLY_MIGRATIONS]) {
      expect(known.has(file), `${file} is probed but does not exist`).toBe(true);
    }
  });

  it("only probes, never changes the schema", () => {
    for (const [file, probe] of Object.entries(presenceProbes)) {
      const upper = probe.toUpperCase();
      expect(upper.trim().startsWith("SELECT"), file).toBe(true);
      for (const word of ["INSERT", "UPDATE", "DELETE", "ALTER", "DROP", "CREATE", "TRUNCATE", "GRANT", "SET"]) {
        expect(upper, `${file} probe contains ${word}`).not.toContain(word);
      }
      expect(upper.endsWith("AS PRESENT"), file).toBe(true);
    }
  });

  it("never casts a possibly-missing table to regclass", () => {
    // A bare 'public.foo'::regclass raises when the table is absent, which on a
    // fresh branch would take the whole status report down. to_regclass returns
    // NULL instead, so a probe on an unbuilt schema reports false rather than
    // erroring.
    for (const [file, probe] of Object.entries(presenceProbes)) {
      expect(probe, `${file} probe uses a bare ::regclass cast`).not.toContain("::regclass");
      for (const quoted of probe.match(/to_regclass\('([^']+)'\)/g) ?? []) {
        expect(quoted, file).toMatch(/to_regclass\('[a-z_]+\.[a-z_"]+'\)/);
      }
    }
  });
});

describe("classifyMigration", () => {
  const classify = (over = {}) =>
    classifyMigration("lib/migration-play-count.sql", { recorded: false, probeResult: false, ...over });

  it("treats the Supabase-era file as never applicable, even if recorded", () => {
    expect(
      classifyMigration("lib/migration.sql", { recorded: true, probeResult: true })
    ).toBe("supabase-only");
  });

  it("prefers the tracking row over the probe", () => {
    expect(classify({ recorded: true, probeResult: true })).toBe("recorded");
  });

  it("reads the probe's three outcomes apart", () => {
    expect(classify({ probeResult: true })).toBe("present");
    expect(classify({ probeResult: false })).toBe("missing");
    expect(classify({ probeResult: null })).toBe("probe-failed");
    expect(classify({ probeResult: undefined })).toBe("unknown");
  });
});

describe("shouldApply", () => {
  it("only applies what is genuinely unapplied or undecidable", () => {
    expect(shouldApply("missing")).toBe(true);
    expect(shouldApply("unknown")).toBe(true);
    for (const kind of ["recorded", "present", "supabase-only", "probe-failed"]) {
      expect(shouldApply(kind), kind).toBe(false);
    }
  });
});
