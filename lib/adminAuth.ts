import { createClient, User } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

const getSupabaseConfig = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase environment variables are not configured.");
  return { url, anonKey };
};

export const getAuthenticatedUser = async (request: NextRequest): Promise<User | null> => {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const { url, anonKey } = getSupabaseConfig();
  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  return error ? null : data.user;
};

export const isAdmin = async (userId: string, accessToken: string) => {
  const { url, anonKey } = getSupabaseConfig();
  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  return !error && data?.role === "admin";
};

export const getAdminFromRequest = async (request: NextRequest) => {
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!accessToken) return null;

  const user = await getAuthenticatedUser(request);
  if (!user || !(await isAdmin(user.id, accessToken))) return null;

  return { user, accessToken };
};
