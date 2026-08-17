"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Library, LogIn, User, ShieldCheck, Music, Settings, LogOut, ChevronRight } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { usePlayer } from "@/app/context/PlayerContext";
import { useState, useEffect } from "react";
import SongAvatar from "@/app/components/SongAvatar";

const Sidebar = () => {
  const pathname = usePathname();
  const { user, isAdmin, profile, signOut } = useAuth();
  const { activeSong } = usePlayer();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const mainRoutes = [
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
      active: mounted && (pathname === "/library" || pathname === "/playlists" || pathname.startsWith("/playlists/")),
      href: "/library",
    },
  ];

  const accountRoutes = [
    ...(user
      ? [{
          icon: Settings,
          label: "Settings",
          active: mounted && pathname === "/settings",
          href: "/settings",
        }]
      : []),
    ...(user
      ? [{
          icon: User,
          label: "Account",
          active: mounted && pathname === "/account",
          href: "/account",
        }]
      : []),
    ...(isAdmin
      ? [{
          icon: ShieldCheck,
          label: "Admin",
          active: mounted && pathname === "/admin",
          href: "/admin",
        }]
      : []),
  ];

  const NavItem = ({ item }) => (
    <Link
      href={item.href}
      aria-current={item.active ? "page" : undefined}
      className={`group relative flex items-center gap-x-3 rounded-xl px-3 py-2.5 text-sm font-semibold tracking-tight transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 ${
        item.active
          ? "bg-accent/8 text-neutral-900"
          : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
      }`}
    >
      <item.icon size={17} strokeWidth={item.active ? 2.5 : 2} />
      <span>{item.label}</span>
    </Link>
  );

  return (
    <aside className="sticky top-0 hidden h-full w-[240px] flex-shrink-0 md:flex lg:w-[260px] bg-white border-r border-neutral-100 shadow-sm">
      <div className="flex h-full w-full flex-col p-5 pb-5">

        {/* Brand Logo Header */}
        <Link href="/" className="mb-6 flex items-center gap-3 px-1 outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-lg">
          <img
            src="/icons/icon-192x192.png"
            alt="Early Music"
            className="h-9 w-9 rounded-xl object-cover shadow-sm shadow-accent/10"
          />
          <h2 className="text-[15px] font-black tracking-tight text-neutral-900 leading-none md:text-[17px]">
            Early Music
          </h2>
        </Link>

        {/* Main Navigation */}
        <nav aria-label="Main navigation" className="flex flex-col gap-y-0.5">
          {mainRoutes.map((item) => (
            <NavItem key={item.label} item={item} />
          ))}
        </nav>

        {/* Account Section */}
        {accountRoutes.length > 0 && (
          <>
            <div className="my-4 border-t border-neutral-100" />
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-400">
              Account
            </p>
            <nav aria-label="Account navigation" className="flex flex-col gap-y-0.5">
              {accountRoutes.map((item) => (
                <NavItem key={item.label} item={item} />
              ))}
            </nav>
          </>
        )}

        {/* Sign In (when logged out) */}
        {!user && (
          <>
            <div className="my-4 border-t border-neutral-100" />
            <Link
              href="/auth"
              className="group relative flex items-center gap-x-3 rounded-xl bg-accent/8 px-3 py-2.5 text-sm font-semibold tracking-tight text-accent transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2"
            >
              <LogIn size={17} />
              <span>Sign In</span>
            </Link>
          </>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Active Song Indicator */}
        {activeSong && (
          <div className="mb-3 rounded-xl bg-accent/5 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-accent mb-1.5">
              Now Playing
            </p>
            <div className="flex items-center gap-2.5">
              <SongAvatar title={activeSong.title} size="xs" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-neutral-900">{activeSong.title}</p>
                <p className="truncate text-[10px] text-neutral-400">{activeSong.author}</p>
              </div>
              <div className="waveform text-accent flex h-4 items-center"><span /><span /><span /><span /></div>
            </div>
          </div>
        )}

        {/* User Profile / Sign In */}
        {user && (
          <div className="rounded-xl bg-neutral-50 p-1.5">
            <Link
              href="/account"
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all duration-200 hover:bg-white/60 outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
                {profile?.first_name?.[0] || user.email?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-neutral-900">
                  {profile?.first_name || user.email?.split("@")[0] || "User"}
                </p>
                <p className="truncate text-[10px] text-neutral-400">
                  {isAdmin ? "Admin" : "Member"}
                </p>
              </div>
              <ChevronRight size={12} className="text-neutral-300" />
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
