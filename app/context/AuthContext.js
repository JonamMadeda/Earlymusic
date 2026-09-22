"use client";

import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

const getToken = () => {
  try { return localStorage.getItem("auth-token"); } catch { return null; }
};
const setToken = (token) => {
  try { if (token) localStorage.setItem("auth-token", token); else localStorage.removeItem("auth-token"); } catch {}
};
const apiFetch = (url, opts = {}) => {
  const token = getToken();
  const headers = { ...opts.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (opts.body && typeof opts.body === "string" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  return fetch(url, { ...opts, headers });
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); setRoleLoading(false); return; }

    apiFetch("/api/auth/me")
      .then(async (res) => {
        if (!res.ok) throw new Error("not authenticated");
        const { user: u } = await res.json();
        setUser(u);

        const roleRes = await apiFetch(`/api/admin/check-role?userId=${u.id}`);
        if (roleRes.ok) {
          const { admin } = await roleRes.json();
          setIsAdmin(admin);
        }
      })
      .catch(() => { setToken(null); })
      .finally(() => { setLoading(false); setRoleLoading(false); });
  }, []);

  useEffect(() => {
    if (!user) { setProfile(null); return; }

    apiFetch(`/api/profiles/${user.id}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (data) setProfile(data);
      })
      .catch(() => {});
  }, [user]);

  const signIn = async (email, password) => {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) return { error: { message: data.error } };
    setToken(data.token);
    setUser(data.user);

    const roleRes = await apiFetch(`/api/admin/check-role?userId=${data.user.id}`);
    if (roleRes.ok) {
      const { admin } = await roleRes.json();
      setIsAdmin(admin);
    }
    setRoleLoading(false);
    return { error: null };
  };

  const signUp = async (email, password) => {
    const res = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) return { error: { message: data.error } };
    setToken(data.token);
    setUser(data.user);
    setRoleLoading(false);
    return { error: null };
  };

  const resetPassword = async (email) => {
    return { error: { message: "Password reset is not yet available. Contact an administrator." } };
  };

  const signOut = async () => {
    try { await apiFetch("/api/auth/signout", { method: "POST" }); } catch {}
    setToken(null);
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
  };

  const updateProfile = async ({ first_name, last_name }) => {
    if (!user) return { error: new Error("Not authenticated") };

    const res = await apiFetch(`/api/profiles/${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({ first_name, last_name }),
    });
    if (!res.ok) return { error: new Error("Failed to update profile") };

    setProfile({ first_name, last_name });
    return { error: null };
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, roleLoading, signIn, signUp, resetPassword, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
