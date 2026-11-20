"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  ChevronRight,
  Disc,
  Download,
  Heart,
  KeyRound,
  Library,
  LogIn,
  LogOut,
  Mail,
  MonitorSmartphone,
  Save,
  ShieldCheck,
  Trash2,
  UserRoundPlus,
} from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useAuth } from "@/app/context/AuthContext";
import StatusMessage from "@/app/components/StatusMessage";
import AnalyticsConsentControl from "@/app/components/AnalyticsConsentControl";
import AndroidDownloadSection from "@/app/components/AndroidDownloadSection";
import ConfirmModal from "@/app/components/ConfirmModal";
import { LEGAL_EMAIL, LEGAL_MAILTO } from "@/lib/legal";

const ACCOUNT_SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "library", label: "Library" },
  { id: "security", label: "Security" },
  { id: "privacy", label: "Data & privacy" },
  { id: "app", label: "Android app" },
  { id: "danger", label: "Danger zone" },
];

function describeDevice(ua = "") {
  if (/iPhone|iPad/i.test(ua)) return "iPhone / iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Macintosh|Mac OS X/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown device";
}

function describeBrowser(ua = "") {
  if (/Edg\//.test(ua)) return "Edge";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return "";
}

function formatTimestamp(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SectionCard({ id, title, description, icon: Icon, children }) {
  return (
    <section
      id={id}
      className="scroll-mt-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-50/60 px-5 py-3.5 sm:px-6">
        <div className="min-w-0">
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs font-medium text-neutral-400">{description}</p>
          )}
        </div>
        {Icon && <Icon size={16} className="shrink-0 text-neutral-400" aria-hidden="true" />}
      </div>
      {children}
    </section>
  );
}

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
  const [showSignOutEverywhereConfirm, setShowSignOutEverywhereConfirm] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [signOutError, setSignOutError] = useState("");

  useEffect(() => {
    return () => {
      clearTimeout(saveMsgTimeoutRef.current);
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
    setShowSignOutEverywhereConfirm(false);
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

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await apiFetch("/api/auth/delete-account", {
        method: "POST",
        body: JSON.stringify({ password: deletePassword }),
      });
      setShowDeleteConfirm(false);
      await signOut();
      router.replace("/");
    } catch (error) {
      setShowDeleteConfirm(false);
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

  const isDirty =
    firstName.trim() !== (profile?.first_name || "").trim() ||
    lastName.trim() !== (profile?.last_name || "").trim();

  const handleSaveProfile = async (event) => {
    event.preventDefault();
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
      <div className="mx-auto flex w-full max-w-4xl items-center justify-center px-4 py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto flex w-full max-w-md justify-center px-4 py-16 sm:py-24">
        <div className="flex w-full flex-col items-center rounded-2xl border border-neutral-200 bg-white px-6 py-12 text-center shadow-sm sm:px-8">
          <Disc className="mb-4 text-neutral-300" size={32} aria-hidden="true" />
          <h1 className="text-base font-bold text-neutral-900">Sign in to view your account</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Your profile, security settings, and saved data live here.
          </p>
          <Link href="/auth" className="btn-primary mt-6">
            <LogIn size={15} aria-hidden="true" />
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const joinedDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Unknown";

  // The email already appears in the meta row, so the title falls back to a
  // placeholder rather than repeating it when no name has been saved.
  const nameParts = [firstName, lastName].filter(Boolean);
  const displayName = nameParts.join(" ") || "Your account";
  const initials = nameParts.map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Your Luumbo account
        </p>
        <h1 className="page-title mt-1">Account</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Manage your profile, security, and personal data in one place.
        </p>
        <nav
          aria-label="Account sections"
          className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1"
        >
          {ACCOUNT_SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="shrink-0 rounded-full border border-neutral-200 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900"
            >
              {section.label}
            </a>
          ))}
        </nav>
      </header>

      <div className="flex flex-col gap-5">
        {/* Profile */}
        <section
          id="profile"
          className="scroll-mt-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
        >
          <div className="h-16 border-b border-neutral-200 bg-accent/[0.04] sm:h-20" />
          <div className="px-5 pb-5 sm:px-6">
            <div className="-mt-9 mb-5 flex flex-col gap-4 sm:-mt-10 sm:flex-row sm:items-end sm:gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-accent/10 bg-accent/[0.08] text-xl font-bold text-accent shadow-sm ring-4 ring-white">
                {initials || <UserRoundPlus size={26} className="text-accent/50" aria-hidden="true" />}
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <h2 className="break-words text-lg font-bold tracking-tight text-neutral-900 sm:text-xl">
                  {displayName}
                </h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-xs font-medium text-neutral-500">
                    <Mail size={13} className="shrink-0 text-neutral-400" aria-hidden="true" />
                    <span className="break-all">{user.email}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                    <Calendar size={13} className="shrink-0 text-neutral-400" aria-hidden="true" />
                    <span>Joined {joinedDate}</span>
                  </span>
                </div>
              </div>
            </div>

            {!firstName && !lastName && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-accent/15 bg-accent/[0.04] px-3.5 py-3">
                <UserRoundPlus size={16} className="mt-px shrink-0 text-accent" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-neutral-900">Add your name</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-neutral-500">
                    The home page greets you by name. Add yours below so we know what to call you.
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="mt-1">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <label
                    htmlFor="account-first-name"
                    className="block text-xs font-semibold uppercase tracking-wider text-neutral-400"
                  >
                    First name
                  </label>
                  <input
                    id="account-first-name"
                    type="text"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder="First"
                    autoComplete="given-name"
                    className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm font-medium text-neutral-900 outline-none transition focus:border-accent placeholder:text-neutral-300"
                  />
                </div>
                <div className="min-w-0">
                  <label
                    htmlFor="account-last-name"
                    className="block text-xs font-semibold uppercase tracking-wider text-neutral-400"
                  >
                    Last name
                  </label>
                  <input
                    id="account-last-name"
                    type="text"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    placeholder="Last"
                    autoComplete="family-name"
                    className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm font-medium text-neutral-900 outline-none transition focus:border-accent placeholder:text-neutral-300"
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                <button type="submit" disabled={saving || !isDirty} className="btn-primary">
                  <Save size={15} aria-hidden="true" />
                  {saving ? "Saving..." : "Save name"}
                </button>
                {saveStatus && (
                  <StatusMessage
                    tone={saveStatus.tone}
                    className="max-w-full [&>span]:break-words"
                  >
                    {saveStatus.text}
                  </StatusMessage>
                )}
              </div>
            </form>
          </div>
        </section>

        {/* Library at a glance — the stats double as shortcuts into Library. */}
        <section id="library" className="scroll-mt-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
            <h2 className="section-title flex items-center gap-2">
              <Library size={17} className="text-accent" aria-hidden="true" />
              Your library
            </h2>
            <Link
              href="/library"
              className="text-xs font-semibold text-accent transition hover:underline"
            >
              Open library
            </Link>
          </div>
          <StatsCards />
        </section>

        {/* Security */}
        <SectionCard
          id="security"
          title="Security"
          description="Your password and active sessions"
          icon={ShieldCheck}
        >
          <div className="divide-y divide-neutral-100">
            <Link
              href="/auth?mode=update-password&redirectTo=/account"
              className="group flex items-center gap-3 px-5 py-4 transition hover:bg-neutral-50 sm:px-6"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/10 bg-accent/[0.08] text-accent">
                <KeyRound size={17} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-neutral-900">Change password</span>
                <span className="mt-0.5 block text-sm text-neutral-500">
                  Update it with your current password
                </span>
              </span>
              <ChevronRight
                size={16}
                className="shrink-0 text-neutral-300 transition group-hover:text-neutral-500"
                aria-hidden="true"
              />
            </Link>

            <div className="px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/10 bg-accent/[0.08] text-accent">
                    <MonitorSmartphone size={17} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-neutral-900">Active sessions</h3>
                    <p className="mt-0.5 text-sm text-neutral-500">Where you&rsquo;re signed in</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSignOutEverywhereConfirm(true)}
                  disabled={signingOutEverywhere}
                  className="btn-destructive-outline w-full sm:w-auto"
                >
                  {signingOutEverywhere ? "Signing out…" : "Sign out everywhere"}
                </button>
              </div>

              {sessionsError && (
                <p role="alert" className="mt-3 text-sm font-medium text-red-600">
                  {sessionsError}
                </p>
              )}

              <div className="mt-4 space-y-2">
                {sessions === null && !sessionsError && (
                  <p className="text-sm text-neutral-400">Loading sessions…</p>
                )}
                {Array.isArray(sessions) && sessions.length === 0 && (
                  <p className="text-sm text-neutral-400">No active sessions.</p>
                )}
                {Array.isArray(sessions) &&
                  sessions.map((session) => {
                    const browser = describeBrowser(session.user_agent);
                    const device = describeDevice(session.user_agent);
                    return (
                      <div
                        key={session.id}
                        className="flex flex-wrap items-start gap-3 rounded-xl border border-neutral-100 bg-neutral-50/60 px-3 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p className="break-words text-sm font-semibold text-neutral-800">
                              {device}
                              {browser && (
                                <span className="font-medium text-neutral-500"> · {browser}</span>
                              )}
                            </p>
                            {session.current && (
                              <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-accent">
                                This device
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs font-medium text-neutral-400">
                            Last active {formatTimestamp(session.last_seen_at)}
                          </p>
                        </div>
                        {!session.current && (
                          <button
                            type="button"
                            onClick={() => handleRevokeSession(session.id)}
                            aria-label={`Sign out of ${device}${browser ? ` on ${browser}` : ""}`}
                            title="Sign out of this session"
                            className="tap-sm shrink-0 rounded-lg p-2 text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-neutral-900">Sign out of this device</h3>
                <p className="mt-0.5 text-sm text-neutral-500">
                  You can sign back in whenever you like.
                </p>
                {signOutError && (
                  <p role="alert" className="mt-2 text-sm font-medium text-red-600">
                    {signOutError}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (await handleSignOut()) router.push("/");
                }}
                className="btn-secondary w-full sm:w-auto"
              >
                <LogOut size={15} aria-hidden="true" />
                Sign out
              </button>
            </div>
          </div>
        </SectionCard>

        {/* Data & privacy */}
        <SectionCard
          id="privacy"
          title="Data & privacy"
          description="Your export, analytics choice, and legal links"
          icon={Download}
        >
          <div className="px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-neutral-900">
                  Download a copy of your data
                </h3>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-neutral-500">
                  Export your profile, saved songs, playlists, listening history, reports you
                  filed, and consent records as JSON. Your password and session tokens are never
                  included.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                className="btn-primary w-full shrink-0 sm:w-auto"
              >
                <Download size={15} aria-hidden="true" />
                {exporting ? "Preparing…" : "Download my data"}
              </button>
            </div>
            {exportError && (
              <p role="alert" className="mt-3 text-sm font-medium text-red-600">
                {exportError}
              </p>
            )}
          </div>

          <div className="border-t border-neutral-100 px-5 py-5 sm:px-6">
            <h3 className="text-sm font-semibold text-neutral-900">Analytics</h3>
            <div className="mt-3">
              <AnalyticsConsentControl />
            </div>
          </div>

          <div className="border-t border-neutral-100 px-5 py-4 sm:px-6">
            <h3 className="text-sm font-semibold text-neutral-900">Legal &amp; support</h3>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
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
              <a href={LEGAL_MAILTO} title={`Email ${LEGAL_EMAIL}`} className="text-accent hover:underline">
                DMCA / Legal Contact
              </a>
            </div>
          </div>
        </SectionCard>

        {/* Android app */}
        <div id="app" className="scroll-mt-6">
          <AndroidDownloadSection />
        </div>

        {/* Danger zone — account deletion is the only destructive surface here. */}
        <section
          id="danger"
          className="scroll-mt-6 rounded-2xl border border-red-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0 text-red-600" aria-hidden="true" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-red-700">
                  Danger zone
                </h2>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-neutral-900">Delete account</h3>
              <p
                id="account-delete-description"
                className="mt-1 max-w-2xl text-sm leading-relaxed text-neutral-500"
              >
                Permanently remove your profile, saved songs, playlists, listening history,
                reports, and consent records. This cannot be undone.
              </p>
            </div>
            {!showDelete && (
              <button
                type="button"
                onClick={() => setShowDelete(true)}
                className="btn-destructive-outline w-full shrink-0 sm:w-auto"
              >
                Delete account
              </button>
            )}
          </div>

          {showDelete && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setShowDeleteConfirm(true);
              }}
              className="mt-5 border-t border-red-100 pt-5"
            >
              <label htmlFor="delete-password" className="block text-sm font-semibold text-neutral-700">
                Confirm your current password
              </label>
              <p className="mt-1 text-sm text-neutral-500">
                We need it once to make sure it&rsquo;s really you.
              </p>
              <input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
                aria-describedby="account-delete-description"
                required
                className="mt-3 w-full max-w-sm rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-red-400"
              />
              {deleteError && (
                <p role="alert" className="mt-2 text-sm font-medium text-red-600">
                  {deleteError}
                </p>
              )}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="submit"
                  disabled={deleting || !deletePassword}
                  className="btn-destructive w-full sm:w-auto"
                >
                  {deleting ? "Deleting…" : "Continue to delete"}
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => {
                    setShowDelete(false);
                    setShowDeleteConfirm(false);
                    setDeletePassword("");
                    setDeleteError("");
                  }}
                  className="btn-secondary w-full sm:w-auto"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      </div>

      <ConfirmModal
        isOpen={showSignOutEverywhereConfirm}
        title="Sign out everywhere?"
        message="This ends your session on this device and every other device. You’ll need to sign in again."
        confirmLabel="Sign out everywhere"
        busy={signingOutEverywhere}
        onConfirm={handleSignOutEverywhere}
        onClose={() => setShowSignOutEverywhereConfirm(false)}
      />

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete your account permanently?"
        message="This cannot be undone. Please confirm that you want to erase your account and its data."
        details={{
          removed: [
            "Profile and name",
            "Saved songs",
            "Playlists",
            "Listening history",
            "Reports you filed",
            "Consent records",
          ],
        }}
        confirmLabel="Yes, delete my account"
        busy={deleting}
        onConfirm={handleDeleteAccount}
        onClose={() => setShowDeleteConfirm(false)}
      />
    </div>
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
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = [
    {
      href: "/library?tab=saved",
      icon: Heart,
      label: "Saved songs",
      value: stats.saved,
    },
    {
      href: "/library?tab=playlists",
      icon: Disc,
      label: "Playlists",
      value: stats.playlists,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {cards.map(({ href, icon: Icon, label, value }) => (
        <Link
          key={label}
          href={href}
          className="card group flex min-w-0 items-center gap-4 p-4 transition hover:border-neutral-300 hover:shadow-md"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/10 bg-accent/[0.08] text-accent">
            <Icon size={18} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-2xl font-bold tabular-nums tracking-tight text-neutral-900">
              {value}
            </span>
            <span className="mt-0.5 block truncate text-sm font-medium text-neutral-500">
              {label}
            </span>
          </span>
          <ChevronRight
            size={16}
            className="shrink-0 text-neutral-300 transition group-hover:text-neutral-500"
            aria-hidden="true"
          />
        </Link>
      ))}
    </div>
  );
}
