import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/neon";
import { getUserFromRequest } from "@/lib/auth";

const USER_TABLES = new Set(["saved_songs", "playlists", "playlist_songs", "recently_played"]);

const ALLOWED_TABLES = new Set(["songs", "saved_songs", "playlists", "playlist_songs", "recently_played"]);

function sanitizeTable(table: string): string {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error("Invalid table");
  }
  return table;
}

function sanitizeColumns(columns: string): string {
  return columns
    .split(",")
    .map((c) => c.trim())
    .filter((c) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(c))
    .join(", ");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const { table: rawTable } = await params;
    const table = sanitizeTable(rawTable);
    const { searchParams } = new URL(request.url);

    const userTable = USER_TABLES.has(table);

    if (userTable) {
      const user = await getUserFromRequest(request);
      if (!user) {
        return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
      }

      const columns = searchParams.get("columns");
      const selectCols = columns ? sanitizeColumns(columns) : "*";

      let query = `SELECT ${selectCols} FROM public.${table}`;
      const values: string[] = [];
      const conditions: string[] = [];

      conditions.push(`user_id = $${values.length + 1}`);
      values.push(user.id);

      // Support additional filters (e.g., song_id, playlist_id)
      for (const [key, value] of searchParams.entries()) {
        if (["columns", "limit", "order", "ascending", "count"].includes(key)) continue;
        conditions.push(`${key} = $${values.length + 1}`);
        values.push(value);
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(" AND ")}`;
      }

      const orderCol = searchParams.get("order");
      if (orderCol && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(orderCol)) {
        const asc = searchParams.get("ascending") !== "false";
        query += ` ORDER BY ${orderCol} ${asc ? "ASC" : "DESC"}`;
      }

      const limit = searchParams.get("limit");
      if (limit && /^\d+$/.test(limit)) {
        query += ` LIMIT ${parseInt(limit, 10)}`;
      }

      const result = await db.query(query, values);

      if (searchParams.get("count") === "true" && searchParams.get("head") === "true") {
        const countQuery = `SELECT COUNT(*) FROM public.${table} WHERE user_id = $1`;
        const countResult = await db.query(countQuery, [user.id]);
        return NextResponse.json({ count: parseInt(countResult.rows?.[0]?.count || "0", 10) });
      }

      return NextResponse.json(result.rows || []);
    }

    // Public table (songs) — no auth needed
    const columns = searchParams.get("columns");
    const selectCols = columns ? sanitizeColumns(columns) : "*";

    let query = `SELECT ${selectCols} FROM public.${table}`;
    const values: string[] = [];
    const conditions: string[] = [];

    // Support optional filters on public tables
    for (const [key, value] of searchParams.entries()) {
      if (["columns", "limit", "order", "ascending", "count"].includes(key)) continue;
      conditions.push(`${key} = $${values.length + 1}`);
      values.push(value);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    const orderCol = searchParams.get("order");
    if (orderCol && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(orderCol)) {
      const asc = searchParams.get("ascending") !== "false";
      query += ` ORDER BY ${orderCol} ${asc ? "ASC" : "DESC"}`;
    }

    const limit = searchParams.get("limit");
    if (limit && /^\d+$/.test(limit)) {
      query += ` LIMIT ${parseInt(limit, 10)}`;
    }

    const result = await db.query(query, values);
    return NextResponse.json(result.rows || []);
  } catch (error: any) {
    if (error?.message === "Invalid table") {
      return NextResponse.json({ error: "Invalid table." }, { status: 400 });
    }
    console.error("GET /api/data error:", error);
    return NextResponse.json(
      { error: "Internal server error.", detail: error?.message || String(error) },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const { table: rawTable } = await params;
    const table = sanitizeTable(rawTable);

    const userTable = USER_TABLES.has(table);
    if (!userTable) {
      return NextResponse.json({ error: "Cannot insert into this table." }, { status: 403 });
    }

    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const body = await request.json();
    const rows = Array.isArray(body) ? body : [body];

    const results = [];
    for (const row of rows) {
      // Enforce user_id matches authenticated user
      if (row.user_id && row.user_id !== user.id) {
        return NextResponse.json({ error: "Cannot insert for another user." }, { status: 403 });
      }
      row.user_id = user.id;

      const keys = Object.keys(row).filter(
        (k) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k)
      );
      const values = keys.map((k) => row[k]);
      const placeholders = keys.map((_, i) => `$${i + 1}`);

      const query = `INSERT INTO public.${table} (${keys.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`;
      const result = await db.query(query, values);
      if (result.rows?.[0]) {
        results.push(result.rows[0]);
      }
    }

    return NextResponse.json(Array.isArray(body) ? results : results[0] || {});
  } catch (error: any) {
    if (error?.message === "Invalid table") {
      return NextResponse.json({ error: "Invalid table." }, { status: 400 });
    }
    console.error("POST /api/data error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const { table: rawTable } = await params;
    const table = sanitizeTable(rawTable);

    const userTable = USER_TABLES.has(table);
    if (!userTable) {
      return NextResponse.json({ error: "Cannot update this table." }, { status: 403 });
    }

    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const body = await request.json();

    const setClauses: string[] = [];
    const values: string[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(body)) {
      if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        setClauses.push(`${key} = $${idx}`);
        values.push(value as string);
        idx++;
      }
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    }

    // Always filter by user_id for user tables
    const conditions: string[] = [];
    if (USER_TABLES.has(table)) {
      conditions.push(`user_id = $${idx}`);
      values.push(user.id);
      idx++;
    }

    // Support additional filter params
    for (const [key, value] of searchParams.entries()) {
      if (["limit", "order", "ascending"].includes(key)) continue;
      conditions.push(`${key} = $${idx}`);
      values.push(value);
      idx++;
    }

    let query = `UPDATE public.${table} SET ${setClauses.join(", ")}`;
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }
    query += " RETURNING *";

    const result = await db.query(query, values);
    return NextResponse.json(result.rows || []);
  } catch (error: any) {
    if (error?.message === "Invalid table") {
      return NextResponse.json({ error: "Invalid table." }, { status: 400 });
    }
    console.error("PATCH /api/data error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const { table: rawTable } = await params;
    const table = sanitizeTable(rawTable);

    const userTable = USER_TABLES.has(table);
    if (!userTable) {
      return NextResponse.json({ error: "Cannot delete from this table." }, { status: 403 });
    }

    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const values: string[] = [];
    const conditions: string[] = [];
    let idx = 1;

    // Always filter by user_id for user tables
    conditions.push(`user_id = $${idx}`);
    values.push(user.id);
    idx++;

    // Support filter params (e.g., song_id, playlist_id, id)
    for (const [key, value] of searchParams.entries()) {
      if (["limit", "order", "ascending"].includes(key)) continue;
      conditions.push(`${key} = $${idx}`);
      values.push(value);
      idx++;
    }

    const query = `DELETE FROM public.${table} WHERE ${conditions.join(" AND ")} RETURNING *`;
    const result = await db.query(query, values);
    return NextResponse.json(result.rows || []);
  } catch (error: any) {
    if (error?.message === "Invalid table") {
      return NextResponse.json({ error: "Invalid table." }, { status: 400 });
    }
    console.error("DELETE /api/data error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
