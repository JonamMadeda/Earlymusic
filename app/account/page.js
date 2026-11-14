"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Mail, Calendar, Disc, Heart, LogOut, LogIn, Save, Settings, Download, Library, ChevronRight, UserRoundPlus } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useAuth } from "@/app/context/AuthContext";
import StatusMessage from "@/app/components/StatusMessage";
import AnalyticsConsentControl from "@/app/components/AnalyticsConsentControl";
import { LEGAL_EMAIL, LEGAL_MAILTO } from "@/lib/legal";
import Link from "next/link";
import { KeyRound, ShieldCheck, MonitorSmartphone, Trash2 } from "lucide-react";


export default function AccountPage() {
  const { user, profile, loading: authLoading, signOut, updateProfile } = useAuth();
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const saveMsgTimeoutRef = useRef(null);
  const [sessions, setSessions] = useState(null);
  const [sessionsError, setSessionsError] = useState("");
  const [signingOutEverywhere, setSigningOutEverywhere] = useState(false);
  const [confirmEverywhere, setConfirmEverywhere] = useState(false);
  const confirmEverywhereTimeoutRef = useRef(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [signOutError, setSignOutError] = useState("");

  useEffect(() => {
    return () => {
      clearTimeout(saveMsgTimeoutRef.current);
      clearTimeout(confirmEverywhereTimeoutRef.current);
    };
  }, []);

  const draftKey = profile ? (user?.id || "draft") : null;
  const [prevDraftKey, setPrevDraftKey] = useState(null);
  if (draftKey !== prevDraftKey) {
    setPrevDraftKey(draftKey);
    setFirstName(profile?.first_name || "");
    setLastName(profile?.last_name || "");
  }

  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      try {
        const data = await apiFetch("/api/auth/sessions");
        setSessions(data.sessions || []);
        setSessionsError("");
      } catch (error) {
        console.error("Unable to load sessions:", error);
        setSessionsError("Unable to load active sessions.");
      }
    })();
  }, [authLoading, user]);

  const handleRevokeSession = async (sessionId) => {
    try {
      const data = await apiFetch(`/api/auth/sessions/${sessionId}`, { method: "DELETE" });
      if (data.current) {
        // Endpoint already cleared the cookie and revoked the session;
        // reset local state so the UI matches reality.
        await signOut();
        router.push("/auth");
        return;
      }
      setSessions((prev) => (prev || []).filter((s) => s.id !== sessionId));
    } catch (error) {
      console.error("Unable to revoke session:", error);
      setSessionsError("Unable to revoke that session.");
    }
  };

  const handleSignOut = async () => {
    setSignOutError("");
    const { error } = await signOut();
    if (error) {
      setSignOutError(error);
      return false;
    }
    return true;
  };

  const handleSignOutEverywhere = async () => {
    if (!confirmEverywhere) {
      setConfirmEverywhere(true);
      clearTimeout(confirmEverywhereTimeoutRef.current);
      confirmEverywhereTimeoutRef.current = setTimeout(() => setConfirmEverywhere(false), 4000);
      return;
    }
    setConfirmEverywhere(false);
    setSigningOutEverywhere(true);
    setSessionsError("");
    const { error } = await signOut({ everywhere: true });
    if (error) {
      setSessionsError(error);
      setSigningOutEverywhere(false);
      return;
    }
    router.push("/");
  };

  const handleDeleteAccount = async (event) => {    event.preventDefault();
    setDeleting(true);
    setDeleteError("");
    try {
      await apiFetch("/api/auth/delete-account", {
        method: "POST",
        body: JSON.stringify({ password: deletePassword }),
      });
      await signOut();
      router.replace("/");
    } catch (error) {
      setDeleteError(error.message || "Unable to delete the account.");
      setDeleting(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setExportError("");
    try {
      const response = await fetch("/api/account/export", {
        credentials: "same-origin",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Unable to build your data export.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const filename =
        match?.[1] || `luumbo-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error.message || "Unable to build your data export.");
    } finally {
      setExporting(false);
    }
  };

  const describeDevice = (ua = "") => {
    if (/iPhone|iPad/i.test(ua)) return "iPhone / iPad";
    if (/Android/i.test(ua)) return "Android";
    if (/Windows/i.test(ua)) return "Windows";
    if (/Macintosh|Mac OS X/i.test(ua)) return "macOS";
    if (/Linux/i.test(ua)) return "Linux";
    return "Unknown device";
  };

  const describeBrowser = (ua = "") => {
    if (/Edg\//.test(ua)) return "Edge";
    if (/Firefox\//.test(ua)) return "Firefox";
    if (/Chrome\//.test(ua)) return "Chrome";
    if (/Safari\//.test(ua)) return "Safari";
    return "";
  };

  const formatTimestamp = (iso) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "unknown";
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const isDirty =
    firstName.trim() !== (profile?.first_name || "").trim() ||
    lastName.trim() !== (profile?.last_name || "").trim();

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveStatus(null);
    clearTimeout(saveMsgTimeoutRef.current);
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    try {
      const { error } = await updateProfile({ first_name: trimmedFirst, last_name: trimmedLast });
      if (error) {
        setSaveStatus({
          tone: "error",
          text: "Couldn't save your name. Check your connection and try again.",
        });
      } else {
        setFirstName(trimmedFirst);
        setLastName(trimmedLast);
        setSaveStatus({ tone: "success", text: "Saved" });
        saveMsgTimeoutRef.current = setTimeout(() => setSaveStatus(null), 2500);
      }
    } catch {
      setSaveStatus({
        tone: "error",
        text: "Couldn't save your name. Check your connection and try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <main className="min-h-[90vh] bg-neutral-50/60 px-4 pb-40 pt-2 md:px-8 md:pt-6">
        <div className="mx-auto max-w-3xl flex items-center justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-[90vh] bg-neutral-50/60 px-4 pb-40 pt-2 md:px-8 md:pt-6">
        <div className="mx-auto max-w-md flex flex-col items-center justify-center text-center rounded-2xl border border-neutral-200 bg-white px-8 py-16 shadow-sm">
          <Disc className="mb-4 text-neutral-300" size={32} />
          <p className="mb-2 text-sm font-semibold text-neutral-900">Sign in to view your account</p>
          <Link
            href="/auth"
            className="inline-flex items-center gap-2 rounded-full bg-accent px-4.5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-accent/90"
          >
            <LogIn size={14} />
            Sign In
          </Link>
        </div>
      </main>
    );
  }

  const joinedDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "Unknown";

  // The email already appears in the meta row, so the title falls back to a
  // placeholder rather than repeating it when no name has been saved.
  const nameParts = [firstName, lastName].filter(Boolean);
  const displayName = nameParts.join(" ") || "Your account";
  const initials = nameParts.map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  const quickLinks = [
    { icon: Settings, label: "Settings", desc: "Storage, data, and app preferences", href: "/settings" },
    { icon: Download, label: "Downloads", desc: "Manage your offline tracks", href: "/library?tab=downloads" },
    { icon: Library, label: "Library", desc: "View your saved songs and playlists", href: "/library" },
  ];

  return (
    <main className="min-h-[90vh] bg-neutral-50/60 px-4 pb-40 pt-2 md:px-8 md:pt-6">
      <div className="mx-auto max-w-3xl">
        {/* Page header */}
        <div className="mb-8 flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 md:text-2xl">Account</h1>
        </div>

        <div className="flex flex-col gap-6">
          {/* Profile card */}
          <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
            <div className="h-20 bg-accent/[0.04] border-b border-neutral-200" />
            <div className="px-5 pb-5">
              <div className="-mt-10 mb-4 flex items-end gap-4">
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl border border-accent/10 bg-accent/[0.08] text-xl font-bold text-accent shadow-sm ring-4 ring-white">
                  {initials || <UserRoundPlus size={26} className="text-accent/50" aria-hidden="true" />}
                </div>
                <div className="min-w-0 pb-1">
                  <p className="truncate text-base font-bold tracking-tight text-neutral-900">{displayName}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <div className="flex items-center gap-1">
                      <Mail size={11} className="text-neutral-400" />
                      <span className="text-xs font-medium text-neutral-400 truncate">{user.email}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar size={11} className="text-neutral-400" />
                      <span className="text-xs font-medium text-neutral-400">Joined {joinedDate}</span>
                    </div>
                  </div>
                </div>
              </div>

              {!firstName && !lastName && (
                <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-accent/15 bg-accent/[0.04] px-3.5 py-3">
                  <UserRoundPlus size={15} className="mt-px shrink-0 text-accent" />
                  <div>
                    <p className="text-xs font-bold text-neutral-900">Add your name</p>
                    <p className="mt-0.5 text-xs font-medium leading-relaxed text-neutral-500">
                      The home page greets you by name. Add yours below so we
                      know what to call you.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="ml-1 text-xs font-semibold uppercase tracking-wider text-neutral-400">First name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First"
                    className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm font-medium text-neutral-900 outline-none transition focus:border-accent placeholder:text-neutral-300"
                  />
                </div>
                <div>
                  <label className="ml-1 text-xs font-semibold uppercase tracking-wider text-neutral-400">Last name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last"
                    className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm font-medium text-neutral-900 outline-none transition focus:border-accent placeholder:text-neutral-300"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  onClick={handleSaveProfile}
                  disabled={saving || !isDirty}
                  className="btn-primary"
                >
                  <Save size={15} aria-hidden="true" />
                  {saving ? "Saving..." : "Save"}
                </button>
                {saveStatus && (
                  <StatusMessage tone={saveStatus.tone}>{saveStatus.text}</StatusMessage>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <StatsCards />

          {/* Security */}
          <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-neutral-200 bg-neutral-50/60 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Security</p>
              <ShieldCheck size={14} className="text-neutral-400" aria-hidden="true" />
            </div>
            <div className="divide-y divide-neutral-100">
              <Link
                href="/auth?mode=update-password&redirectTo=/account"
                className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-neutral-50 group"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/[0.08] border border-accent/10 text-accent">
                  <KeyRound size={16} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold tracking-tight text-neutral-900">Change password</p>
                  <p className="text-xs font-medium text-neutral-400">Update it with your current password</p>
                </div>
                <ChevronRight size={15} className="text-neutral-300 transition group-hover:text-neutral-500" aria-hidden="true" />
              </Link>

              <div className="px-5 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/[0.08] border border-accent/10 text-accent">
                      <MonitorSmartphone size={16} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold tracking-tight text-neutral-900">Active sessions</p>
                      <p className="text-xs font-medium text-neutral-400">Where you&rsquo;re signed in</p>
                    </div>
                  </div>
                  <button
                    onClick={handleSignOutEverywhere}
                    disabled={signingOutEverywhere}
                    className="shrink-0 rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    {signingOutEverywhere ? "Signing out…" : confirmEverywhere ? "Tap to confirm" : "Sign out everywhere"}
                  </button>
                </div>

                {sessionsError && (
                  <p role="alert" className="mt-3 text-xs font-medium text-red-600">{sessionsError}</p>
                )}

                <div className="mt-3 flex flex-col gap-2">
                  {sessions === null && !sessionsError && (
                    <p className="text-xs text-neutral-400">Loading sessions…</p>
                  )}
                  {Array.isArray(sessions) && sessions.length === 0 && (
                    <p className="text-xs text-neutral-400">No active sessions.</p>
                  )}
                  {Array.isArray(sessions) && sessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50/60 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-neutral-900 truncate">
                          {describeDevice(session.user_agent)}{" "}
                          {describeBrowser(session.user_agent) && (
                            <span className="font-medium text-neutral-400">· {describeBrowser(session.user_agent)}</span>
                          )}
                          {session.current && (
                            <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-accent align-middle">
                              This device
                            </span>
                          )}
                        </p>
                        <p className="text-xs font-medium text-neutral-400">
                          Last active {formatTimestamp(session.last_seen_at)}
                        </p>
                      </div>
                      {!session.current && (
                        <button
                          onClick={() => handleRevokeSession(session.id)}
                          aria-label="Revoke session"
                          title="Revoke session"
                          className="shrink-0 rounded-lg p-2 text-neutral-400 transition hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Your data */}
          <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-neutral-200 bg-neutral-50/60 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Your data</p>
              <Download size={14} className="text-neutral-400" aria-hidden="true" />
            </div>
            <div className="px-5 py-4">
              <p className="text-sm font-semibold tracking-tight text-neutral-900">Download a copy</p>
              <p className="mt-1 text-xs font-medium leading-relaxed text-neutral-500">
                Export your profile, saved songs, playlists, listening history,
                reports you filed, and consent records as JSON. Your password and
                session tokens are never included.
              </p>
              {exportError && (
                <p role="alert" className="mt-2 text-xs font-medium text-red-600">
                  {exportError}
                </p>
              )}
              <button
                onClick={handleExport}
                disabled={exporting}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-accent/90 disabled:opacity-50"
              >
                <Download size={13} aria-hidden="true" />
                {exporting ? "Preparing…" : "Download my data"}
              </button>
            </div>
          </div>

          {/* Privacy & analytics */}
          <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-neutral-200 bg-neutral-50/60 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Privacy &amp; analytics</p>
              <ShieldCheck size={14} className="text-neutral-400" aria-hidden="true" />
            </div>
            <div className="px-5 py-4">
              <AnalyticsConsentControl />
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-neutral-100 pt-3 text-xs font-semibold">
                <Link href="/privacy" className="text-accent hover:underline">
                  Privacy Policy
                </Link>
                <Link href="/terms" className="text-accent hover:underline">
                  Terms of Service
                </Link>
                <Link href="/privacy#choices" className="text-accent hover:underline">
                  Your rights
                </Link>
                <Link href="/accessibility" className="text-accent hover:underline">
                  Accessibility
                </Link>
                <a
                  href={LEGAL_MAILTO}
                  title={`Email ${LEGAL_EMAIL}`}
                  className="text-accent hover:underline"
                >
                  DMCA / Legal Contact
                </a>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-neutral-200 bg-neutral-50/60">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Quick Links</p>
            </div>
            <div className="divide-y divide-neutral-100">
              {quickLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-neutral-50 group"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/[0.08] border border-accent/10 text-accent">
                    <link.icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold tracking-tight text-neutral-900">{link.label}</p>
                    <p className="text-xs font-medium text-neutral-400">{link.desc}</p>
                  </div>
                  <ChevronRight size={15} className="text-neutral-300 transition group-hover:text-neutral-500" />
                </Link>
              ))}
            </div>
          </div>

          {/* Sign out */}
          <div className="rounded-2xl border border-red-100 bg-red-50/40 px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-900">Sign out</p>
                <p className="text-xs font-medium text-red-500">You&apos;ll need to sign in again to manage your account</p>
              </div>
              <button
                onClick={async () => {
                  if (await handleSignOut()) router.push("/");
                }}
                className="shrink-0 inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-4 py-2.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
              >
                <LogOut size={13} aria-hidden="true" />
                Sign Out
              </button>
            </div>
            {signOutError && (
              <p role="alert" className="mt-3 text-xs font-medium text-red-600">
                {signOutError}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-red-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-red-700">Delete account</p>
                <p className="mt-0.5 text-xs font-medium leading-relaxed text-neutral-500">
                  Permanently remove your profile, saved songs, playlists, and listening history.
                </p>
              </div>
              {!showDelete && (
                <button
                  onClick={() => setShowDelete(true)}
                  className="shrink-0 rounded-full border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                >
                  Delete
                </button>
              )}
            </div>
            {showDelete && (
              <form onSubmit={handleDeleteAccount} className="mt-4 border-t border-red-100 pt-4">
                <label htmlFor="delete-password" className="text-xs font-semibold text-neutral-700">
                  Confirm your current password
                </label>
                <input
                  id="delete-password"
                  type="password"
                  autoComplete="current-password"
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                  required
                  className="mt-2 w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-red-400"
                />
                {deleteError && <p role="alert" className="mt-2 text-xs font-medium text-red-600">{deleteError}</p>}
                <div className="mt-3 flex gap-2">
                  <button
                    type="submit"
                    disabled={deleting || !deletePassword}
                    className="rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleting ? "Deleting…" : "Permanently delete account"}
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => {
                      setShowDelete(false);
                      setDeletePassword("");
                      setDeleteError("");
                    }}
                    className="rounded-full border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

// Owns its fetch so a user switch never gates the whole page behind a
// synchronous setState-in-effect; the parent renders it only when signed in.
function StatsCards() {
  const [stats, setStats] = useState({ saved: 0, playlists: 0 });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch("/api/data/saved_songs?count=true&head=true"),
      apiFetch("/api/data/playlists?count=true&head=true"),
    ])
      .then(([saved, playlists]) => {
        if (!cancelled) setStats({ saved: saved.count || 0, playlists: playlists.count || 0 });
      })
      .catch((error) => console.error("Unable to load account stats:", error));
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:border-neutral-300">
        <Heart size={18} className="text-accent" />
        <p className="mt-3 text-2xl font-bold tracking-tight text-neutral-900">{stats.saved}</p>
        <p className="mt-0.5 text-xs font-medium text-neutral-400">Saved songs</p>
      </div>
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:border-neutral-300">
        <Disc size={18} className="text-accent" />
        <p className="mt-3 text-2xl font-bold tracking-tight text-neutral-900">{stats.playlists}</p>
        <p className="mt-0.5 text-xs font-medium text-neutral-400">Playlists</p>
      </div>
    </div>
  );
}
