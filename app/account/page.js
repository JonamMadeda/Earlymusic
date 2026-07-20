"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Calendar, Disc, Heart, LogOut, LogIn, Save, Settings } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/app/context/AuthContext";
import Link from "next/link";

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
        <div className="max-w-5xl mx-auto flex items-center justify-center py-32">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-[90vh] bg-transparent px-4 pb-40 pt-2 md:px-8 md:pt-6">
        <div className="max-w-md mx-auto flex flex-col items-center justify-center text-center rounded-2xl bg-neutral-50/60 backdrop-blur-2xl px-8 py-16">
          <Disc className="mb-4 text-neutral-300" size={32} />
          <p className="text-sm font-semibold text-neutral-900 mb-2">Sign in to view your account</p>
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

  return (
    <main className="min-h-[90vh] bg-transparent px-4 pb-40 pt-2 md:px-8 md:pt-6">
      <div className="max-w-5xl mx-auto">
        <section className="mb-8">
          <div className="flex items-center gap-3">
            <div className="h-6 w-1 rounded-full bg-accent" />
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 md:text-2xl uppercase">
              Account
            </h1>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-400 max-w-xl">
            Manage your profile and see your activity.
          </p>
        </section>

        <div className="flex flex-col gap-6">
          {/* Profile card */}
          <div className="rounded-2xl bg-neutral-50/60 backdrop-blur-2xl p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <User size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold tracking-tight text-neutral-900">
                  {displayName}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Mail size={11} className="text-neutral-400" />
                  <p className="text-[11px] font-medium text-neutral-400 truncate">
                    {user.email}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Calendar size={11} className="text-neutral-400" />
                  <p className="text-[11px] font-medium text-neutral-400">
                    Joined {joinedDate}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 ml-1">
                  First name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First"
                  className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm font-medium text-neutral-900 outline-none transition focus:border-accent placeholder:text-neutral-300"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 ml-1">
                  Last name
                </label>
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
                className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-accent/90 disabled:opacity-50"
              >
                <Save size={13} />
                {saving ? "Saving..." : "Save"}
              </button>
              {saveMsg && (
                <span className="text-[11px] font-medium text-green-600">{saveMsg}</span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-neutral-50/60 backdrop-blur-2xl p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
              <Heart size={18} className="text-neutral-800" />
              <p className="mt-3 text-2xl font-bold tracking-tight text-neutral-900">
                {savedCount}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-neutral-400">
                Saved songs
              </p>
            </div>
            <div className="rounded-2xl bg-neutral-50/60 backdrop-blur-2xl p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
              <Disc size={18} className="text-neutral-800" />
              <p className="mt-3 text-2xl font-bold tracking-tight text-neutral-900">
                {playlistCount}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-neutral-400">
                Playlists
              </p>
            </div>
          </div>

          {/* Settings */}
          <div className="rounded-2xl bg-neutral-50/60 p-5">
            <Link
              href="/settings"
              className="flex items-center gap-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-200/60 text-neutral-500">
                <Settings size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold tracking-tight text-neutral-900">
                  Settings
                </p>
                <p className="text-[11px] font-medium text-neutral-400">
                  Storage, data, and app preferences
                </p>
              </div>
            </Link>
          </div>

          {/* Sign out */}
          <div className="border-t border-neutral-100 pt-6">
            <button
              onClick={() => { signOut(); router.push("/"); }}
              className="inline-flex items-center gap-2 rounded-full border border-neutral-200/80 bg-white px-4 py-2.5 text-xs font-medium text-neutral-500 transition hover:bg-accent hover:text-white"
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
