import { neon } from "@neondatabase/serverless";

const rawSql = neon(process.env.NEON_DATABASE_URL);

export const sql = rawSql;

export const db = {
  query: async (text, params) => {
    const result = await rawSql.query(text, params || []);
    if (Array.isArray(result)) return { rows: result, rowCount: result.length };
    return result;
  },
};
