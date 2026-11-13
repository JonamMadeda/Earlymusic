"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { clearPendingDownloadClears } from "@/lib/downloadManager";

const AuthContext = createContext();

export const AUTH_CHANNEL = "lumbo-auth";

const clearPrivateClientData = async () => {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem("auth-token"); } catch {}
  try { localStorage.removeItem("lumbo_recently_played"); } catch {}
  try { localStorage.removeItem("lumbo_has_played"); } catch {}
  try { localStorage.removeItem("lumbo_playback_position"); } catch {}
  // The download list names every track the account saved offline. It is
  // account data, so it must not survive a sign-out on a shared device.
  try { localStorage.removeItem("lumbo_downloaded_songs"); } catch {}
  try { clearPendingDownloadClears(); } catch {}
  try { window.dispatchEvent(new CustomEvent("downloads:changed")); } catch {}
  try { window.dispatchEvent(new CustomEvent("auth:signed-out")); } catch {}
  // Cache Storage is shared with the worker. Clear it here and await completion:
  // a fire-and-forget worker message could erase the next account's caches.
  if ("caches" in window) {
    try {
      await caches.delete("lumbo-audio-cache-v1");
    } catch {}
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
const apiFetch = (url, opts = {}, isCurrent = () => true) => {
  const headers = { ...opts.headers };
  if (opts.body && typeof opts.body === "string" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  return fetch(url, { ...opts, headers, credentials: "same-origin" }).then(
    (res) => {
      const quiet = url.startsWith("/api/auth/me") || url.startsWith("/api/auth/login");
      if (res.status === 401 && typeof window !== "undefined" && !quiet && isCurrent()) {
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
  const userId = user?.id;
  const signedIn = Boolean(user);

  const authGeneration = useRef(0);
  const authTransition = useRef(null);
  const currentUserId = useRef(null);
  const privateCleanup = useRef(null);

  const resetSessionState = useCallback(() => {
    currentUserId.current = null;
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
  }, []);

  const clearPrivateData = useCallback(() => {
    // Coalesce duplicate invalidations, and hold new identities behind this
    // barrier until every asynchronous cache deletion has finished.
    if (!privateCleanup.current) {
      privateCleanup.current = clearPrivateClientData().finally(() => {
        privateCleanup.current = null;
      });
    }
    return privateCleanup.current;
  }, []);

  const invalidateSession = useCallback((expired) => {
    ++authGeneration.current;
    resetSessionState();
    setSessionExpired(expired);
    setAuthError(null);
    setLoading(false);
    setRoleLoading(false);
    return clearPrivateData();
  }, [resetSessionState, clearPrivateData]);

  const commitUser = useCallback(async (u, generation) => {
    if (generation !== authGeneration.current) return null;
    // Invalidate even requests started while the login itself was in flight.
    const committedGeneration = ++authGeneration.current;
    if (currentUserId.current && currentUserId.current !== u.id) {
      resetSessionState();
      clearPrivateData();
    }
    await privateCleanup.current;
    if (committedGeneration !== authGeneration.current) return null;
    currentUserId.current = u.id;
    setUser(u);
    setSessionExpired(false);
    setAuthError(null);
    setLoading(false);
    return committedGeneration;
  }, [resetSessionState, clearPrivateData]);

  const refreshRole = useCallback(async (u, generation) => {
    const isCurrent = () => generation === authGeneration.current;
    try {
      const roleRes = await apiFetch(`/api/admin/check-role?userId=${u.id}`, {}, isCurrent);
      if (roleRes.ok) {
        const { admin } = await roleRes.json();
        if (isCurrent()) setIsAdmin(Boolean(admin));
        return;
      }
    } catch {}
    if (isCurrent()) setIsAdmin(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let generation = authGeneration.current;
    const isCurrent = () => !cancelled && generation === authGeneration.current;

    const bootstrap = async () => {
      // Sessions now live in Neon Auth and ride on an HttpOnly cookie.
      // A pre-hardening localStorage token cannot be exchanged any more,
      // so it is simply dropped.
      try {
        localStorage.removeItem("auth-token");
      } catch {}

      try {
        const res = await apiFetch("/api/auth/me");
        if (!isCurrent()) return;
        if (res.status === 401) {
          await invalidateSession(false);
          return;
        }
        if (!res.ok) throw new Error("Unable to verify session");
        const { user: u } = await res.json();
        if (!isCurrent()) return;
        const committedGeneration = await commitUser(u, generation);
        if (committedGeneration === null) return;
        generation = committedGeneration;
        await refreshRole(u, generation);
      } catch {
        // Network/5xx: the cookie may still be fine. Don't clear anything,
        // just tell the UI to show a retry prompt instead of a white screen.
        if (isCurrent()) setAuthError("We couldn't verify your session. Check your connection and try again.");
      } finally {
        if (isCurrent()) {
          setLoading(false);
          setRoleLoading(false);
        }
      }
    };

    bootstrap();
    return () => { cancelled = true; ++authGeneration.current; };
  }, [refreshRole, commitUser, invalidateSession]);

  const refreshUser = useCallback(async () => {
    if (authTransition.current !== null) return null;
    const generation = authGeneration.current;
    try {
      const res = await apiFetch("/api/auth/me");
      if (generation !== authGeneration.current) return null;
      if (res.status === 401) {
        await invalidateSession(true);
        return null;
      }
      if (!res.ok) return null;
      const { user: u } = await res.json();
      const committedGeneration = await commitUser(u, generation);
      if (committedGeneration === null) return null;
      await refreshRole(u, committedGeneration);
      if (committedGeneration !== authGeneration.current) return null;
      setRoleLoading(false);
      return u;
    } catch {
      return null;
    }
  }, [invalidateSession, commitUser, refreshRole]);

  useEffect(() => {
    if (!userId) { setProfile(null); return; }
    let cancelled = false;
    const generation = authGeneration.current;
    const isCurrent = () => !cancelled && generation === authGeneration.current;

    apiFetch(`/api/profiles/${userId}`, {}, isCurrent)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (data && isCurrent()) setProfile(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [userId, user]);

  // The cookie can outlive the session behind it (revoked on another device,
  // password reset elsewhere). Re-checking when the tab comes back keeps the
  // UI from offering a signed-in shell whose every request 401s.
  useEffect(() => {
    if (!signedIn) return;
    let lastCheck = Date.now();
    const revalidate = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastCheck < 30_000) return;
      lastCheck = Date.now();
      void refreshUser();
    };
    const interval = setInterval(revalidate, 5 * 60_000);
    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", revalidate);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", revalidate);
      document.removeEventListener("visibilitychange", revalidate);
    };
  }, [signedIn, refreshUser]);

  const signIn = async (email, password) => {
    const generation = ++authGeneration.current;
    authTransition.current = generation;
    try {
      await privateCleanup.current;
      if (generation !== authGeneration.current) return { error: { message: "Authentication changed. Please try again." } };
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { error: { message: data.error || "Invalid email or password." }, code: data.code };
      const committedGeneration = await commitUser(data.user, generation);
      if (committedGeneration === null) return { error: { message: "Authentication changed. Please try again." } };
      await refreshRole(data.user, committedGeneration);
      if (committedGeneration !== authGeneration.current) return { error: { message: "Authentication changed. Please try again." } };
      setRoleLoading(false);
      return { error: null };
    } catch {
      return { error: { message: "Network error. Check your connection and try again." } };
    } finally {
      if (authTransition.current === generation) authTransition.current = null;
    }
  };

  const signUp = async (email, password, { first_name, last_name, tos_accepted, privacy_accepted, age_attested } = {}) => {
    const generation = ++authGeneration.current;
    authTransition.current = generation;
    try {
      await privateCleanup.current;
      if (generation !== authGeneration.current) return { error: { message: "Authentication changed. Please try again." } };
      const res = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          first_name,
          last_name,
          tos_accepted,
          privacy_accepted,
          age_attested,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { error: { message: data.error || "Unable to create account." } };
      if (data.exists) return { error: { message: data.message }, exists: true };
      if (data.verificationRequired) return { error: null, verificationRequired: true };
      const committedGeneration = await commitUser(data.user, generation);
      if (committedGeneration === null) return { error: { message: "Authentication changed. Please try again." } };
      setRoleLoading(false);
      setIsAdmin(false);
      return { error: null };
    } catch {
      return { error: { message: "Network error. Check your connection and try again." } };
    } finally {
      if (authTransition.current === generation) authTransition.current = null;
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
    const generation = ++authGeneration.current;
    authTransition.current = generation;
    let res;
    try {
      res = await fetch(everywhere ? "/api/auth/signout-all" : "/api/auth/signout", {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      return { error: "We couldn't reach the server, so you are still signed in. Check your connection and try again." };
    } finally {
      if (authTransition.current === generation) authTransition.current = null;
    }
    // 401 means the session is already gone — a reset, a deletion, or this
    // device being revoked. That is the outcome we asked for.
    if (!res.ok && res.status !== 401) {
      return { error: "Unable to sign out. Please try again." };
    }
    if (generation !== authGeneration.current) return { error: "Authentication changed. Please try again." };
    const cleanup = invalidateSession(false);
    postAuthEvent("signout");
    await cleanup;
    return { error: null };
  };

  // Global 401 recovery: reset to a clean signed-out state and let the UI
  // show a re-auth prompt instead of failing silently.
  useEffect(() => {
    const onUnauthorized = () => {
      // External requests carry no generation. Confirm against the current
      // cookie rather than letting an old account's late 401 clear a new one.
      void refreshUser();
    };
    window.addEventListener("auth:unauthorized", onUnauthorized);

    let channel = null;
    // Another tab signed out: this tab shares the cookie, so it must drop the
    // same account data, not just the visible user object.
    const onRemoteSignOut = () => {
      void invalidateSession(false);
    };
    try {
      channel = new BroadcastChannel(AUTH_CHANNEL);
      channel.onmessage = (event) => {
        if (event.data === "signout") onRemoteSignOut();
      };
    } catch {}

    // Cross-tab fallback when BroadcastChannel is unavailable.
    const onStorage = (event) => {
      if (event.key === "lumbo-auth-event" && event.newValue) {
        try {
          if (JSON.parse(event.newValue)?.type === "signout") onRemoteSignOut();
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("auth:unauthorized", onUnauthorized);
      window.removeEventListener("storage", onStorage);
      if (channel) channel.close();
    };
  }, [refreshUser, invalidateSession]);

  const updateProfile = async ({ first_name, last_name }) => {
    if (!user) return { error: new Error("Not authenticated") };
    const generation = authGeneration.current;
    const isCurrent = () => generation === authGeneration.current;

    const res = await apiFetch(`/api/profiles/${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({ first_name, last_name }),
    }, isCurrent);
    if (!isCurrent() || !res.ok) return { error: new Error("Failed to update profile") };

    setProfile({ first_name, last_name });
    return { error: null };
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, roleLoading, sessionExpired, setSessionExpired, authError, signIn, signUp, changePassword, signOut, updateProfile, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
