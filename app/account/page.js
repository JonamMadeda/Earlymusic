"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Calendar, Disc, Heart, LogOut, LogIn } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/app/context/AuthContext";
import Link from "next/link";

export default function AccountPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [savedCount, setSavedCount] = useState(0);
  const [playlistCount, setPlaylistCount] = useState(0);

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

  if (authLoading || loading) {
    return (
      <main className="min-h-[90vh] bg-transparent px-4 py-6 pb-40 md:px-8 md:py-10">
        <div className="max-w-5xl mx-auto flex items-center justify-center py-32">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-[90vh] bg-transparent px-4 py-6 pb-40 md:px-8 md:py-10">
        <div className="max-w-5xl mx-auto flex flex-col items-center justify-center py-32 text-center">
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

  return (
    <main className="min-h-[90vh] bg-transparent px-4 py-6 pb-40 md:px-8 md:py-10">
      <div className="max-w-5xl mx-auto">
        <section className="mb-8">
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900 md:text-2xl">
            Account
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-neutral-400 max-w-xl">
            Manage your profile and see your activity.
          </p>
        </section>

        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4 rounded-2xl bg-neutral-50/60 p-5">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <User size={24} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight text-neutral-900">
                {user.email}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Calendar size={11} className="text-neutral-400" />
                <p className="text-[11px] font-medium text-neutral-400">
                  Joined {joinedDate}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-neutral-50/60 p-5">
              <Heart size={18} className="text-neutral-800" />
              <p className="mt-3 text-2xl font-bold tracking-tight text-neutral-900">
                {savedCount}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-neutral-400">
                Saved songs
              </p>
            </div>
            <div className="rounded-2xl bg-neutral-50/60 p-5">
              <Disc size={18} className="text-neutral-800" />
              <p className="mt-3 text-2xl font-bold tracking-tight text-neutral-900">
                {playlistCount}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-neutral-400">
                Playlists
              </p>
            </div>
          </div>

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
