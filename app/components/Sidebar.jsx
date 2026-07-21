"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Library, LogIn, User, Clock, ShieldCheck, Music } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { usePlayer } from "@/app/context/PlayerContext";
import { useState, useEffect } from "react";
import SongAvatar from "@/app/components/SongAvatar";

const Sidebar = () => {
  const pathname = usePathname();
  const { user, isAdmin } = useAuth();
  const { recentlyPlayed, setActiveSong, activeSong } = usePlayer();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const routes = [
    {
      icon: Home,
      label: "Home",
      active: mounted && pathname === "/",
      href: "/",
    },
    {
      icon: Music,
      label: "Songs",
      active: mounted && pathname === "/songs",
      href: "/songs",
    },
    {
      icon: Library,
      label: "Library",
      active: mounted && (pathname === "/library" || pathname.startsWith("/playlists/")),
      href: "/library",
    },
  ];

  return (
    <aside className="sticky top-0 hidden h-full w-[240px] flex-shrink-0 md:flex lg:w-[260px] bg-white border-r border-neutral-100 shadow-sm">
      <div className="flex h-full w-full flex-col p-5 pb-20">
        
        {/* Brand Logo Header */}
        <div className="mb-6 flex items-center gap-3 px-1">
          <img
            src="/icons/icon-192x192.png"
            alt="Early Music"
            className="h-9 w-9 rounded-xl object-cover shadow-sm shadow-accent/10"
          />
          <h2 className="text-[15px] font-black tracking-tight text-neutral-900 leading-none md:text-[17px]">
            Early Music
          </h2>
        </div>

        {/* Navigation Routes */}
        <nav className="flex flex-col gap-y-0.5">
          {routes.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`group flex items-center gap-x-3 rounded-xl px-3 py-2.5 text-sm font-semibold tracking-tight transition-all duration-200 ${
                item.active
                  ? "bg-neutral-100 text-neutral-900"
                  : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
              }`}
            >
              {item.active && <div className="h-4 w-0.5 rounded-full bg-accent -ml-0.5 mr-2" />}
              {!item.active && <div className="w-2.5" />}
              <item.icon size={17} strokeWidth={item.active ? 2.5 : 2} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Recently Played */}
        {recentlyPlayed.length > 0 && (
          <div className="mt-5 flex-1 overflow-hidden">
            <div className="mb-2 flex items-center gap-2 px-1">
              <Clock size={11} className="text-neutral-400" />
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-400">
                Recent
              </span>
            </div>
            <nav className="flex flex-col gap-y-0.5 overflow-y-auto max-h-[calc(100%-2rem)] no-scrollbar custom-scrollbar pr-1">
              {recentlyPlayed.slice(0, 7).map((song) => (
                <button
                  key={song.id}
                  type="button"
                  onClick={() => setActiveSong(song, recentlyPlayed)}
                  className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition ${
                    activeSong?.id === song.id
                      ? "bg-accent/8"
                      : "hover:bg-neutral-50"
                  }`}
                >
                  <SongAvatar title={song.title} size="xs" />
                  {activeSong?.id === song.id && (
                    <span className="absolute left-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
                  )}
                  <p className={`min-w-0 flex-1 truncate text-xs font-medium transition ${
                    activeSong?.id === song.id
                      ? "text-accent"
                      : "text-neutral-600 group-hover:text-neutral-900"
                  }`}>
                    {song.title}
                  </p>
                </button>
              ))}
            </nav>
          </div>
        )}

        {/* Bottom Profile / Auth */}
        <div className="mt-auto pt-4">
          <div className="mb-2 border-t border-neutral-100" />
          <div className="rounded-xl bg-neutral-50 p-1.5">
            <nav className="flex flex-col gap-y-0.5">
              {user && (
                <Link
                  href="/account"
                  className={`flex items-center gap-x-3 rounded-lg px-3 py-2 text-sm font-semibold tracking-tight transition-all duration-200 ${
                    mounted && pathname === "/account"
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-500 hover:bg-white/60 hover:text-neutral-900"
                  }`}
                >
                  <User size={17} />
                  <span>Account</span>
                </Link>
              )}
              {isAdmin && (
                <Link
                  href="/admin"
                  className={`flex items-center gap-x-3 rounded-lg px-3 py-2 text-sm font-semibold tracking-tight transition-all duration-200 ${
                    mounted && pathname === "/admin"
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-500 hover:bg-white/60 hover:text-neutral-900"
                  }`}
                >
                  <ShieldCheck size={17} />
                  <span>Admin</span>
                </Link>
              )}
              {!user && (
                <Link
                  href="/auth"
                  className="flex items-center gap-x-3 rounded-lg px-3 py-2 text-sm font-semibold tracking-tight text-neutral-500 transition-all duration-200 hover:bg-white/60 hover:text-neutral-900"
                >
                  <LogIn size={17} />
                  <span>Sign In</span>
                </Link>
              )}
            </nav>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
