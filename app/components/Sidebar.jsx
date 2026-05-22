"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Search, Library, ListMusic, LogOut, LogIn } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import LikedSongs from "./LikedSongs";

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
      icon: Search,
      label: "Search",
      active: mounted && pathname === "/search",
      href: "/search",
    },
    {
      icon: ListMusic,
      label: "Playlists",
      active: mounted && pathname.startsWith("/playlists"),
      href: "/playlists",
    },
  ];

  return (
    <aside className="hidden md:flex flex-col bg-[#fcfcfc] h-full w-[260px] lg:w-[280px] p-4 gap-y-3 sticky top-0">
      {/* Top Navigation Block */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100">
        <nav className="flex flex-col gap-y-5">
          {routes.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`
                flex items-center gap-x-4 transition-all cursor-pointer group
                ${
                  item.active
                    ? "text-red-600"
                    : "text-neutral-500 hover:text-neutral-900"
                }
              `}
            >
              <item.icon size={20} strokeWidth={item.active ? 2.5 : 2} />
              <span className="text-[14px] font-semibold tracking-tight">
                {item.label}
              </span>
            </Link>
          ))}
        </nav>
      </div>

      {/* Bottom Library & Liked Songs Block */}
      <div className="bg-white rounded-2xl p-5 flex-1 shadow-sm border border-neutral-100 overflow-hidden flex flex-col">
        <Link
          href="/library"
          className={`
            flex items-center gap-x-4 mb-6 transition-all cursor-pointer group
            ${
              mounted && pathname === "/library"
                ? "text-red-600"
                : "text-neutral-500 hover:text-neutral-900"
            }
          `}
        >
          <Library size={20} strokeWidth={mounted && pathname === "/library" ? 2.5 : 2} />
          <span className="text-[14px] font-semibold tracking-tight">
            Your Library
          </span>
        </Link>

        {/* Simple Section Label */}
        <p className="text-[11px] font-medium text-neutral-400 mb-4 px-1">
          Pinned Collection
        </p>

        <div className="flex-1 overflow-y-auto no-scrollbar">
          <LikedSongs />
        </div>
      </div>

      {/* CREDITS AT THE VERY BOTTOM */}
      <div className="px-5 py-2 flex items-center justify-between">
        <p className="text-[10px] text-neutral-400 font-medium tracking-wider uppercase opacity-60">
          Created by Jonam
        </p>
        {user ? (
          <button
            onClick={() => { signOut(); router.push("/"); }}
            className="text-neutral-300 hover:text-red-600 transition"
            title="Sign Out"
          >
            <LogOut size={14} />
          </button>
        ) : (
          <Link
            href="/auth"
            className="text-neutral-300 hover:text-red-600 transition"
            title="Sign In"
          >
            <LogIn size={14} />
          </Link>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
