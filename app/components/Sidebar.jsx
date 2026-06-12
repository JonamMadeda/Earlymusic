"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ListMusic, LogOut, LogIn, Music, User, Clock, Download, Settings } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { usePlayer } from "@/app/context/PlayerContext";

const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { recentlyPlayed, setActiveSong, allSongs } = usePlayer();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const routes = [
    {
      icon: Music,
      label: "Songs",
      active: mounted && pathname === "/songs",
      href: "/songs",
    },
    {
      icon: ListMusic,
      label: "Playlists",
      active: mounted && pathname.startsWith("/playlists"),
      href: "/playlists",
    },
    {
      icon: Download,
      label: "Downloads",
      active: mounted && pathname === "/downloads",
      href: "/downloads",
    },
  ];

  return (
    <aside className="sticky top-0 hidden h-full w-[240px] flex-shrink-0 md:flex lg:w-[260px] bg-neutral-50/50">
      <div className="flex h-full w-full flex-col p-6">
        
        {/* Brand Logo Header */}
        <div className="mb-8 flex items-center gap-3 px-1.5">
          <img
            src="/icons/icon-192x192.png"
            alt="Early Music"
            className="h-9 w-9 rounded-xl object-cover shadow-sm shadow-accent/10"
          />
          <div className="min-w-0">
            <h2 className="text-[15px] font-black tracking-tight text-neutral-900 leading-none md:text-[17px]">
              Early Music
            </h2>
            <span className="mt-1 block text-[8px] font-semibold uppercase tracking-[0.28em] text-neutral-400">
              Curated Collection
            </span>
          </div>
        </div>

        {/* Navigation Routes */}
        <nav className="flex flex-col gap-y-1">
          {routes.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-x-3.5 rounded-xl px-4 py-3 text-sm font-semibold tracking-tight transition-all duration-200 ${
                item.active
                  ? "bg-accent text-white shadow-sm shadow-accent/10"
                  : "text-neutral-550 hover:bg-neutral-200/50 hover:text-neutral-900"
              }`}
            >
              <item.icon size={18} strokeWidth={item.active ? 2.5 : 2} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Recently Played */}
        {recentlyPlayed.length > 0 && (
          <div className="mt-6 flex-1 overflow-hidden">
            <div className="mb-2 flex items-center gap-2 px-1.5">
              <div className="h-3 w-0.5 rounded-full bg-accent/60" />
              <Clock size={11} className="text-neutral-400" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
                Recent
              </span>
            </div>
            <nav className="flex flex-col gap-y-0.5 overflow-y-auto max-h-[calc(100%-2rem)] no-scrollbar">
              {recentlyPlayed.slice(0, 7).map((song) => (
                <button
                  key={song.id}
                  type="button"
                  onClick={() => setActiveSong(song, allSongs)}
                  className="group flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition hover:bg-accent/10"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-400 transition group-hover:bg-accent/15 group-hover:text-accent">
                    <Music size={11} />
                  </div>
                  <p className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-600 transition group-hover:text-accent">
                    {song.title}
                  </p>
                </button>
              ))}
            </nav>
          </div>
        )}

        {/* Bottom Profile / Auth */}
        <div className="mt-auto pt-5">
          <div className="mb-3 border-t border-neutral-200/60" />
          <nav className="flex flex-col gap-y-1">
            <Link
              href="/settings"
              className={`flex items-center gap-x-3.5 rounded-xl px-4 py-3 text-sm font-semibold tracking-tight transition-all duration-200 ${
                pathname === "/settings"
                  ? "bg-accent text-white shadow-sm shadow-accent/10"
                  : "text-neutral-550 hover:bg-neutral-200/50 hover:text-neutral-900"
              }`}
            >
              <Settings size={18} />
              <span>Settings</span>
            </Link>
            {user && (
              <Link
                href="/account"
                className={`flex items-center gap-x-3.5 rounded-xl px-4 py-3 text-sm font-semibold tracking-tight transition-all duration-200 ${
                  pathname === "/account"
                    ? "bg-accent text-white shadow-sm shadow-accent/10"
                    : "text-neutral-550 hover:bg-neutral-200/50 hover:text-neutral-900"
                }`}
              >
                <User size={18} />
                <span>Account</span>
              </Link>
            )}
          </nav>
          {!user && (
            <Link
              href="/auth"
              className="mt-1 flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-left text-sm font-semibold tracking-tight text-neutral-550 transition-all duration-200 hover:bg-neutral-200/50 hover:text-neutral-900"
              title="Sign In"
            >
              <LogIn size={18} />
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
