"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch(() => {
      supabase.auth.signOut({ scope: "local" });
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) { setProfile(null); return; }

    supabase.from("profiles").select("first_name, last_name").eq("id", user.id).single()
      .then(({ data }) => {
        if (data) setProfile(data);
      });
  }, [user]);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setRoleLoading(false);
      return;
    }

    setRoleLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(data?.role === "admin"))
      .catch(() => setIsAdmin(false))
      .finally(() => setRoleLoading(false));
  }, [user]);

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password });

  const signUp = (email, password) =>
    supabase.auth.signUp({ email, password, options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined } });

  const resetPassword = (email) =>
    supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth?mode=update-password` : undefined,
    });

  const signOut = () => supabase.auth.signOut();

  const updateProfile = async ({ first_name, last_name }) => {
    if (!user) return { error: new Error("Not authenticated") };

    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      first_name,
      last_name,
      updated_at: new Date().toISOString(),
    });

    if (!error) setProfile({ first_name, last_name });
    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, roleLoading, signIn, signUp, resetPassword, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
