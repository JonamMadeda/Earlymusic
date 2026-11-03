"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

const AuthContext = createContext();

export const AUTH_CHANNEL = "lumbo-auth";

const clearPrivateClientData = async () => {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem("auth-token"); } catch {}
  try { localStorage.removeItem("lumbo_recently_played"); } catch {}
  try { localStorage.removeItem("lumbo_has_played"); } catch {}
  try { window.dispatchEvent(new CustomEvent("auth:signed-out")); } catch {}
  try {
    navigator.serviceWorker?.controller?.postMessage("CLEAR_PRIVATE_CACHES");
  } catch {}
  if ("caches" in window) {
    try {
      const names = await caches.keys();
      await Promise.all(
        names.map(async (name) => {
          const cache = await caches.open(name);
          const requests = await cache.keys();
          await Promise.all(
            requests
              .filter((request) => new URL(request.url).pathname.startsWith("/api/"))
              .map((request) => cache.delete(request))
          );
        })
      );
    } catch {}
  }
};

// Same-origin cookies are sent automatically; 401s from auth endpoints are
// handled by those screens themselves and must not tear down a session.
const apiFetch = (url, opts = {}) => {
  const headers = { ...opts.headers };
  if (opts.body && typeof opts.body === "string" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  return fetch(url, { ...opts, headers, credentials: "same-origin" }).then(
    (res) => {
      const quiet = url.startsWith("/api/auth/me") || url.startsWith("/api/auth/login");
      if (res.status === 401 && typeof window !== "undefined" && !quiet) {
        window.dispatchEvent(new CustomEvent("auth:unauthorized"));
      }
      return res;
    }
  );
};

const postAuthEvent = (type) => {
  try {
    const channel = new BroadcastChannel(AUTH_CHANNEL);
    channel.postMessage(type);
    channel.close();
  } catch {}
  try {
    localStorage.setItem("lumbo-auth-event", JSON.stringify({ type, at: Date.now() }));
  } catch {}
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [authError, setAuthError] = useState(null);

  const resetSessionState = useCallback(() => {
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
  }, []);

  const refreshRole = useCallback(async (u) => {
    try {
      const roleRes = await apiFetch(`/api/admin/check-role?userId=${u.id}`);
      if (roleRes.ok) {
        const { admin } = await roleRes.json();
        setIsAdmin(Boolean(admin));
        return;
      }
    } catch {}
    setIsAdmin(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      // Sessions now live in Neon Auth and ride on an HttpOnly cookie.
      // A pre-hardening localStorage token cannot be exchanged any more,
      // so it is simply dropped.
      try {
        localStorage.removeItem("auth-token");
      } catch {}

      try {
        const res = await apiFetch("/api/auth/me");
        if (res.status === 401) return; // signed out — nothing to verify
        if (!res.ok) throw new Error("Unable to verify session");
        const { user: u } = await res.json();
        if (cancelled) return;
        setUser(u);
        setSessionExpired(false);
        await refreshRole(u);
      } catch {
        // Network/5xx: the cookie may still be fine. Don't clear anything,
        // just tell the UI to show a retry prompt instead of a white screen.
        if (!cancelled) setAuthError("We couldn't verify your session. Check your connection and try again.");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRoleLoading(false);
        }
      }
    };

    bootstrap();
    return () => { cancelled = true; };
  }, [refreshRole]);

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
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { error: { message: data.error || "Invalid email or password." } };
      setUser(data.user);
      setSessionExpired(false);
      setAuthError(null);
      await refreshRole(data.user);
      setRoleLoading(false);
      return { error: null };
    } catch {
      return { error: { message: "Network error. Check your connection and try again." } };
    }
  };

  const signUp = async (email, password, { first_name, last_name } = {}) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, first_name, last_name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { error: { message: data.error || "Unable to create account." } };
      if (data.exists) return { error: { message: data.message }, exists: true };
      setUser(data.user);
      setSessionExpired(false);
      setAuthError(null);
      setRoleLoading(false);
      setIsAdmin(false);
      return { error: null };
    } catch {
      return { error: { message: "Network error. Check your connection and try again." } };
    }
  };

  const changePassword = async ({ currentPassword, password }) => {
    try {
      const res = await fetch("/api/auth/update-password", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { error: { message: data.error || "Unable to update password." } };
      return { error: null };
    } catch {
      return { error: { message: "Network error. Check your connection and try again." } };
    }
  };

  const signOut = async ({ everywhere = false } = {}) => {
    try {
      await fetch(everywhere ? "/api/auth/signout-all" : "/api/auth/signout", {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {}
    resetSessionState();
    setSessionExpired(false);
    postAuthEvent("signout");
    await clearPrivateClientData();
  };

  // Global 401 recovery: reset to a clean signed-out state and let the UI
  // show a re-auth prompt instead of failing silently.
  useEffect(() => {
    const onUnauthorized = () => {
      resetSessionState();
      setSessionExpired(true);
    };
    window.addEventListener("auth:unauthorized", onUnauthorized);

    let channel = null;
    try {
      channel = new BroadcastChannel(AUTH_CHANNEL);
      channel.onmessage = (event) => {
        if (event.data === "signout") resetSessionState();
      };
    } catch {}

    // Cross-tab fallback when BroadcastChannel is unavailable.
    const onStorage = (event) => {
      if (event.key === "lumbo-auth-event" && event.newValue) {
        try {
          if (JSON.parse(event.newValue)?.type === "signout") resetSessionState();
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("auth:unauthorized", onUnauthorized);
      window.removeEventListener("storage", onStorage);
      if (channel) channel.close();
    };
  }, [resetSessionState]);

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
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, roleLoading, sessionExpired, setSessionExpired, authError, signIn, signUp, changePassword, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
