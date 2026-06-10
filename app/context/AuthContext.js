"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
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
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, resetPassword, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
