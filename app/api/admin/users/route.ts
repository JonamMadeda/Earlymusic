import { createClient, User } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/adminAuth";

const findUserByEmail = async (email: string) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const normalizedEmail = email.trim().toLowerCase();

  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;

    const users = data.users as User[];
    const user = users.find((candidate) => candidate.email?.toLowerCase() === normalizedEmail);
    if (user) return { supabase, user };
    if (users.length < 1000) break;
  }

  return { supabase, user: null };
};

export async function POST(request: NextRequest) {  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    }

    const { email } = await request.json();
    if (typeof email !== "string" || !email.trim()) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const { supabase, user } = await findUserByEmail(normalizedEmail);
    if (!user) {
      return NextResponse.json({ error: "No Supabase account exists for that email address." }, { status: 404 });
    }

    const { error } = await supabase.from("user_roles").upsert({
      user_id: user.id,
      role: "admin",
    });
    if (error) throw error;

    return NextResponse.json({ email: user.email, message: "Administrator access granted." });
  } catch (error) {
    console.error("Unable to grant administrator access:", error);
    const message = error instanceof Error && error.message === "SUPABASE_SERVICE_ROLE_KEY is not configured."
      ? "Server administrator configuration is incomplete."
      : "Unable to grant administrator access.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const getServiceClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    }

    const supabase = getServiceClient();
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, created_at")
      .eq("role", "admin")
      .order("created_at", { ascending: true });
    if (rolesError) throw rolesError;

    const emailById = new Map<string, string>();
    for (let page = 1; page <= 100; page += 1) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      for (const u of data.users as User[]) {
        if (u.email) emailById.set(u.id, u.email);
      }
      if (data.users.length < 1000) break;
    }

    return NextResponse.json({
      admins: (roles || []).map((r) => ({
        user_id: r.user_id,
        email: emailById.get(r.user_id) || "Unknown account",
        created_at: r.created_at,
      })),
    });
  } catch (error) {
    console.error("Unable to list administrators:", error);
    return NextResponse.json({ error: "Unable to list administrators." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    }

    let userId: unknown;
    try {
      ({ user_id: userId } = await request.json());
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    if (typeof userId !== "string" || !userId) {
      return NextResponse.json({ error: "An administrator id is required." }, { status: 400 });
    }
    if (userId === admin.user.id) {
      return NextResponse.json({ error: "You cannot revoke your own administrator access." }, { status: 400 });
    }

    const supabase = getServiceClient();
    const { data: roles, error: countError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (countError) throw countError;
    if ((roles || []).length <= 1) {
      return NextResponse.json({ error: "Cannot remove the last administrator." }, { status: 400 });
    }

    const { error: deleteError, count } = await supabase
      .from("user_roles")
      .delete({ count: "exact" })
      .eq("user_id", userId)
      .eq("role", "admin");
    if (deleteError) throw deleteError;
    if (!count) {
      return NextResponse.json({ error: "Administrator not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unable to revoke administrator access:", error);
    return NextResponse.json({ error: "Unable to revoke administrator access." }, { status: 500 });
  }
}
