"use client";

import { Home, Library, Music, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const BottomNav = () => {
  const pathname = usePathname();

  const navItems = [
    { icon: Home, label: "Home", href: "/" },
    { icon: Music, label: "Songs", href: "/songs" },
    { icon: Library, label: "Library", href: "/library" },
    { icon: User, label: "Account", href: "/account" },
  ];

  const isPathActive = (href) => {
    if (href === "/library") {
      return pathname === "/library" || pathname === "/playlists" || pathname.startsWith("/playlists/");
    }
    return pathname === href;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-[calc(3.5rem+env(safe-area-inset-bottom,0px))] items-center justify-around border-t border-neutral-200/80 bg-white/95 px-4 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-xl md:hidden">
      {navItems.map((item) => {
        const isActive = isPathActive(item.href);
        return (
          <Link
            key={item.label}
            href={item.href}
            className={`relative flex w-full flex-col items-center gap-y-0.5 rounded-xl py-1 transition ${
              isActive ? "text-accent" : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            <div className={`rounded-xl px-3 py-0.5 transition-colors ${isActive ? "bg-accent/10" : ""}`}>
              <item.icon
                size={20}
                className={isActive ? "text-accent" : "text-neutral-500"}
                strokeWidth={isActive ? 2.5 : 1.75}
              />
            </div>
            <span className={`text-[10px] font-semibold tracking-tight ${isActive ? "text-accent font-bold" : "text-neutral-500"}`}>
              {item.label}
            </span>
            {isActive && (
              <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent" />
            )}
          </Link>
        );
      })}
    </nav>
  );
};

export default BottomNav;