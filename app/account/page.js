"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mail, Calendar, Disc, Heart, LogOut, LogIn, Save, Settings, Download, Library, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/app/context/AuthContext";
import Link from "next/link";
import { pastelGradient } from "@/app/components/SongAvatar";

export default function AccountPage() {
  const { user, profile, loading: authLoading, signOut, updateProfile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [savedCount, setSavedCount] = useState(0);
  const [playlistCount, setPlaylistCount] = useState(0);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || "");
      setLastName(profile.last_name || "");
    }
  }, [profile]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }

    Promise.all([
      supabase.from("saved_songs").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("playlists").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]).then(([savedRes, plRes]) => {
      setSavedCount(savedRes.count || 0);
      setPlaylistCount(plRes.count || 0);
    }).finally(() => setLoading(false));
  }, [user, authLoading]);

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveMsg("");
    const { error } = await updateProfile({ first_name: firstName, last_name: lastName });
    setSaving(false);
    if (error) {
      setSaveMsg("Failed to save");
    } else {
      setSaveMsg("Saved");
      setTimeout(() => setSaveMsg(""), 2000);
    }
  };

  if (authLoading || loading) {
    return (
      <main className="min-h-[90vh] bg-transparent px-4 pb-40 pt-2 md:px-8 md:pt-6">
        <div className="mx-auto max-w-3xl flex items-center justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-[90vh] bg-transparent px-4 pb-40 pt-2 md:px-8 md:pt-6">
        <div className="mx-auto max-w-md flex flex-col items-center justify-center text-center rounded-2xl bg-neutral-50/60 backdrop-blur-2xl px-8 py-16">
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

  const displayName = [firstName, lastName].filter(Boolean).join(" ") || user.email;
  const initials = (displayName.match(/[a-zA-Z]/g) || ["?"]).slice(0, 2).join("").toUpperCase();

  const quickLinks = [
    { icon: Settings, label: "Settings", desc: "Storage, data, and app preferences", href: "/settings" },
    { icon: Download, label: "Downloads", desc: "Manage your offline tracks", href: "/downloads" },
    { icon: Library, label: "Library", desc: "View your saved songs and playlists", href: "/library" },
  ];

  return (
    <main className="min-h-[90vh] bg-transparent px-4 pb-40 pt-2 md:px-8 md:pt-6">
      <div className="mx-auto max-w-3xl">
        {/* Page header */}
        <div className="mb-8 flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 md:text-2xl">Account</h1>
        </div>

        <div className="flex flex-col gap-6">
          {/* Profile card */}
          <div className="rounded-2xl bg-neutral-50/60 backdrop-blur-2xl overflow-hidden">
            <div className="h-20 bg-gradient-to-r from-accent/10 via-accent/5 to-transparent" />
            <div className="px-5 pb-5">
              <div className="-mt-10 mb-4 flex items-end gap-4">
                <div
                  className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-md ring-4 ring-white"
                  style={{ background: pastelGradient(user.email || "account") }}
                >
                  {initials}
                </div>
                <div className="min-w-0 pb-1">
                  <p className="truncate text-base font-bold tracking-tight text-neutral-900">{displayName}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <div className="flex items-center gap-1">
                      <Mail size={11} className="text-neutral-400" />
                      <span className="text-[11px] font-medium text-neutral-400 truncate">{user.email}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar size={11} className="text-neutral-400" />
                      <span className="text-[11px] font-medium text-neutral-400">Joined {joinedDate}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">First name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First"
                    className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm font-medium text-neutral-900 outline-none transition focus:border-accent placeholder:text-neutral-300"
                  />
                </div>
                <div>
                  <label className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Last name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last"
                    className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm font-medium text-neutral-900 outline-none transition focus:border-accent placeholder:text-neutral-300"
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-accent/90 disabled:opacity-50"
                >
                  <Save size={13} />
                  {saving ? "Saving..." : "Save"}
                </button>
                {saveMsg && (
                  <span className="text-[11px] font-medium text-green-600">{saveMsg}</span>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-neutral-50/60 backdrop-blur-2xl p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
              <Heart size={18} className="text-accent" />
              <p className="mt-3 text-2xl font-bold tracking-tight text-neutral-900">{savedCount}</p>
              <p className="mt-0.5 text-[11px] font-medium text-neutral-400">Saved songs</p>
            </div>
            <div className="rounded-2xl bg-neutral-50/60 backdrop-blur-2xl p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
              <Disc size={18} className="text-accent" />
              <p className="mt-3 text-2xl font-bold tracking-tight text-neutral-900">{playlistCount}</p>
              <p className="mt-0.5 text-[11px] font-medium text-neutral-400">Playlists</p>
            </div>
          </div>

          {/* Quick Links */}
          <div className="rounded-2xl bg-neutral-50/60 backdrop-blur-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-neutral-100/80">
              <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Quick Links</p>
            </div>
            <div className="divide-y divide-neutral-100/80">
              {quickLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-neutral-100/50 group"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <link.icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold tracking-tight text-neutral-900">{link.label}</p>
                    <p className="text-[11px] font-medium text-neutral-400">{link.desc}</p>
                  </div>
                  <ChevronRight size={15} className="text-neutral-300 transition group-hover:text-neutral-500" />
                </Link>
              ))}
            </div>
          </div>

          {/* Sign out */}
          <div className="flex items-center justify-between rounded-2xl border border-red-100 bg-red-50/40 px-5 py-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-900">Sign out</p>
              <p className="text-[11px] font-medium text-red-500">You&apos;ll need to sign in again to manage your account</p>
            </div>
            <button
              onClick={() => { signOut(); router.push("/"); }}
              className="shrink-0 inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-4 py-2.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
            >
              <LogOut size={13} />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
