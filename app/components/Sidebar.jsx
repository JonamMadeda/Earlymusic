"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, ListMusic, LogOut, LogIn, Music, User } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";

const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
      icon: ListMusic,
      label: "Playlists",
      active: mounted && pathname.startsWith("/playlists"),
      href: "/playlists",
    },
  ];

  return (
    <aside className="sticky top-0 hidden h-full w-[240px] flex-shrink-0 md:flex lg:w-[260px] bg-neutral-50/50">
      <div className="flex h-full w-full flex-col p-6">
        
        {/* Brand Logo Header */}
        <div className="mb-8 flex items-center gap-3 px-1.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-xs font-black tracking-tight text-white shadow-sm shadow-accent/10">
            EM
          </div>
          <div className="min-w-0">
            <h2 className="text-[15px] font-extrabold tracking-[-0.04em] text-neutral-900 leading-none">
              earlymusic
            </h2>
            <span className="mt-1.5 block text-[9px] font-bold uppercase tracking-[0.22em] text-neutral-400">
              curated songs
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

        {/* Bottom Profile / Auth */}
        <div className="mt-auto pt-5">
          <div className="mb-3 border-t border-neutral-200/60" />
          <nav className="flex flex-col gap-y-1">
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
