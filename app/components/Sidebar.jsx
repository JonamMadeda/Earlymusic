"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Library, LogIn, ShieldCheck, Music, ChevronRight } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { usePlayer } from "@/app/context/PlayerContext";
import { useState, useEffect } from "react";
import SongAvatar from "@/app/components/SongAvatar";

const Sidebar = () => {
  const pathname = usePathname();
  const { user, isAdmin, profile } = useAuth();
  const { activeSong, recentlyPlayed, setActiveSong } = usePlayer();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const navRoutes = [
    { icon: Home, label: "Home", active: mounted && pathname === "/", href: "/" },
    { icon: Music, label: "Songs", active: mounted && pathname === "/songs", href: "/songs" },
    { icon: Library, label: "Library", active: mounted && (pathname === "/library" || pathname === "/playlists" || pathname.startsWith("/playlists/")), href: "/library" },
    ...(isAdmin ? [{ icon: ShieldCheck, label: "Admin", active: mounted && pathname === "/admin", href: "/admin" }] : []),
  ];

  return (
    <aside className="sticky top-0 hidden h-full w-[240px] flex-shrink-0 md:flex lg:w-[260px] bg-white border-r border-neutral-200">
      <div className="flex h-full w-full flex-col p-5 pb-20">

        {/* Brand */}
        <Link href="/" className="mb-5 flex items-center px-1 outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-lg">
          <h2 className="text-[18px] font-bold tracking-tight text-neutral-900 leading-none">
            Luumbo
          </h2>
        </Link>

        {/* Navigation */}
        <nav aria-label="Navigation" className="flex flex-col gap-y-0.5">
          {navRoutes.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={`flex items-center gap-x-3 rounded-lg px-3 py-2 text-sm font-semibold tracking-tight transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                item.active
                  ? "bg-accent/8 text-accent"
                  : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
              }`}
            >
              <item.icon size={16} strokeWidth={item.active ? 2.5 : 2} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Recently Played */}
        {recentlyPlayed.length > 0 && (
          <>
            <div className="my-3 border-t border-neutral-100" />
            <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              Recent
            </p>
            <div className="flex flex-col gap-y-0.5">
              {recentlyPlayed.slice(0, 4).map((song) => (
                <button
                  key={song.id}
                  type="button"
                  onClick={() => setActiveSong(song, recentlyPlayed)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                    activeSong?.id === song.id
                      ? "bg-accent/8 text-neutral-900 font-semibold"
                      : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                  }`}
                >
                  <SongAvatar title={song.title} size="xs" variant="mono" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{song.title}</p>
                    <p className="truncate text-[11px] text-neutral-500">{song.author}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom — User Profile or Sign In */}
        <div className="border-t border-neutral-100 pt-2.5">
          {user ? (
            <Link
              href="/account"
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all duration-200 hover:bg-neutral-50 outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[11px] font-bold text-accent">
                {profile?.first_name?.[0] || user.email?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-neutral-900">
                  {profile?.first_name || user.email?.split("@")[0] || "User"}
                </p>
                <p className="truncate text-[11px] text-neutral-500 font-medium">
                  {isAdmin ? "Admin" : "Member"}
                </p>
              </div>
              <ChevronRight size={13} className="text-neutral-400" />
            </Link>
          ) : (
            <Link
              href="/auth"
              className="flex items-center gap-x-2.5 rounded-lg px-3 py-2 text-sm font-semibold tracking-tight text-neutral-600 transition-all duration-200 hover:bg-neutral-50 hover:text-neutral-900 outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              <LogIn size={16} />
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
