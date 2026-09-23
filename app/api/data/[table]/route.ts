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

// Query-param NAMES are interpolated into SQL — accept only plain
// identifiers so crafted keys can't inject SQL (values stay parameterized).
function isSafeIdentifier(key: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key);
}

// playlist_songs has no user_id column: access is granted only through
// ownership of the parent playlist. Central check, used by every method.
async function playlistOwnedBy(playlistId: string, userId: string): Promise<boolean> {
  const { rows } = await db.query(
    "SELECT id FROM public.playlists WHERE id = $1 AND user_id = $2",
    [playlistId, userId]
  );
  return (rows?.length || 0) > 0;
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

      // playlist_songs carries no user_id — scope strictly to playlists the
      // caller owns (prevents cross-account reads AND fixes the broken
      // user_id filter that 500'd every playlist-songs query).
      if (table === "playlist_songs") {
        const playlistId = searchParams.get("playlist_id");
        if (!playlistId) {
          return NextResponse.json({ error: "playlist_id required." }, { status: 400 });
        }
        if (!(await playlistOwnedBy(playlistId, user.id))) {
          return NextResponse.json({ error: "Playlist not found." }, { status: 404 });
        }
        const columns = searchParams.get("columns");
        const selectCols = columns ? sanitizeColumns(columns) : "*";
        let query = `SELECT ${selectCols} FROM public.playlist_songs WHERE playlist_id = $1`;
        const values: string[] = [playlistId];
        for (const key of ["song_id", "id"]) {
          const v = searchParams.get(key);
          if (v !== null) {
            values.push(v);
            query += ` AND ${key} = $${values.length}`;
          }
        }
        const orderCol = searchParams.get("order");
        if (orderCol && isSafeIdentifier(orderCol)) {
          const asc = searchParams.get("ascending") !== "false";
          query += ` ORDER BY ${orderCol} ${asc ? "ASC" : "DESC"}`;
        }
        const limit = searchParams.get("limit");
        if (limit && /^\d+$/.test(limit)) {
          query += ` LIMIT ${parseInt(limit, 10)}`;
        }
        const result = await db.query(query, values);
        return NextResponse.json(result.rows || []);
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
        if (!isSafeIdentifier(key)) continue;
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
      if (!isSafeIdentifier(key)) continue;
      conditions.push(`${key} = $${values.length + 1}`);
      values.push(value);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    const orderCol = searchParams.get("order");
    if (orderCol && isSafeIdentifier(orderCol)) {
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
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
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
    const ownedPlaylists = new Set<string>();
    for (const row of rows) {
      // playlist_songs has no user_id column: authorize through the parent
      // playlist instead of stamping a column that doesn't exist.
      if (table === "playlist_songs") {
        const pid = row.playlist_id;
        if (typeof pid !== "string" || !pid) {
          return NextResponse.json({ error: "playlist_id required." }, { status: 400 });
        }
        if (!ownedPlaylists.has(pid)) {
          if (!(await playlistOwnedBy(pid, user.id))) {
            return NextResponse.json({ error: "Playlist not found." }, { status: 404 });
          }
          ownedPlaylists.add(pid);
        }
        delete row.user_id;
      } else {
        // Enforce user_id matches authenticated user
        if (row.user_id && row.user_id !== user.id) {
          return NextResponse.json({ error: "Cannot insert for another user." }, { status: 403 });
        }
        row.user_id = user.id;
      }

      const keys = Object.keys(row).filter(
        (k) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k)
      );
      const values = keys.map((k) => row[k]);
      const placeholders = keys.map((_, i) => `$${i + 1}`);

      // Conflict handling per table (unique constraints exist — see schema):
      // - recently_played: replaying bumps played_at instead of erroring.
      // - saved_songs / playlist_songs: double-saves are harmless no-ops.
      let conflict = "";
      if (table === "recently_played") {
        if (!keys.includes("played_at")) {
          keys.push("played_at");
          values.push(new Date().toISOString());
          placeholders.push(`$${keys.length}`);
        }
        conflict = " ON CONFLICT (user_id, song_id) DO UPDATE SET played_at = EXCLUDED.played_at";
      } else if (table === "saved_songs") {
        conflict = " ON CONFLICT (user_id, song_id) DO NOTHING";
      } else if (table === "playlist_songs") {
        conflict = " ON CONFLICT (playlist_id, song_id) DO NOTHING";
      }

      const query = `INSERT INTO public.${table} (${keys.join(", ")}) VALUES (${placeholders.join(", ")})${conflict} RETURNING *`;
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

    // Scope writes to the caller's own rows. playlist_songs has no
    // user_id column, so it is scoped through the owned parent playlist.
    const conditions: string[] = [];
    if (table === "playlist_songs") {
      const playlistId = searchParams.get("playlist_id");
      if (!playlistId) {
        return NextResponse.json({ error: "playlist_id required." }, { status: 400 });
      }
      if (!(await playlistOwnedBy(playlistId, user.id))) {
        return NextResponse.json({ error: "Playlist not found." }, { status: 404 });
      }
      conditions.push(`playlist_id = $${idx}`);
      values.push(playlistId);
      idx++;
    } else if (USER_TABLES.has(table)) {
      conditions.push(`user_id = $${idx}`);
      values.push(user.id);
      idx++;
    }

    // Support additional filter params
    for (const [key, value] of searchParams.entries()) {
      if (["limit", "order", "ascending", "playlist_id"].includes(key)) continue;
      if (!isSafeIdentifier(key)) continue;
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

    // Scope deletes to the caller's own rows. playlist_songs has no
    // user_id column, so it is scoped through the owned parent playlist.
    if (table === "playlist_songs") {
      const playlistId = searchParams.get("playlist_id");
      if (!playlistId) {
        return NextResponse.json({ error: "playlist_id required." }, { status: 400 });
      }
      if (!(await playlistOwnedBy(playlistId, user.id))) {
        return NextResponse.json({ error: "Playlist not found." }, { status: 404 });
      }
      conditions.push(`playlist_id = $${idx}`);
      values.push(playlistId);
      idx++;
    } else {
      conditions.push(`user_id = $${idx}`);
      values.push(user.id);
      idx++;
    }

    // Support filter params (e.g., song_id, playlist_id, id)
    for (const [key, value] of searchParams.entries()) {
      if (["limit", "order", "ascending", "playlist_id"].includes(key)) continue;
      if (!isSafeIdentifier(key)) continue;
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
