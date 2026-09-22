import { neon } from "@neondatabase/serverless";

const rawSql = neon(process.env.NEON_DATABASE_URL);

export const sql = rawSql;

export const db = {
  // NOTE: the Neon HTTP driver resolves every statement to an array of
  // returned rows. Statements without RETURNING (bare UPDATE/DELETE) yield
  // [], so the synthesized rowCount is only meaningful for SELECTs and
  // writes with RETURNING — never use it to check a bare write.
  query: async (text, params) => {
    const result = await rawSql.query(text, params || []);
    if (Array.isArray(result)) return { rows: result, rowCount: result.length };
    return result;
  },
};
