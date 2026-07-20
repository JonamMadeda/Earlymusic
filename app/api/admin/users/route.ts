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

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
    }

    const { email } = await request.json();
    if (typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const { supabase, user } = await findUserByEmail(email);
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
