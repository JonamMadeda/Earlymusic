"use client";

import { Home, Library, Music, Download, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const BottomNav = () => {
  const pathname = usePathname();
  const [activePath, setActivePath] = useState(null);

  useEffect(() => {
    setActivePath(pathname);
  }, [pathname]);

  const navItems = [
    { icon: Home, label: "Home", href: "/" },
    { icon: Music, label: "Songs", href: "/songs" },
    { icon: Download, label: "Downloads", href: "/downloads" },
    { icon: Library, label: "Library", href: "/library" },
    { icon: User, label: "Account", href: "/account" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center justify-around border-t border-white/70 bg-white/85 px-4 backdrop-blur-xl md:hidden">
      {navItems.map((item) => {
        const isActive = activePath === item.href;
        return (
          <Link
            key={item.label}
            href={item.href}
            className={`relative flex w-full flex-col items-center gap-y-0.5 rounded-xl py-1 transition ${
              isActive ? "text-accent" : "text-neutral-400"
            }`}
          >
            <div className={`rounded-xl px-3 py-1 transition-colors ${isActive ? "bg-accent/10" : ""}`}>
              <item.icon
                size={20}
                className={isActive ? "text-accent" : "text-neutral-400"}
                strokeWidth={isActive ? 2.5 : 2}
              />
            </div>
            <span className={`text-[9px] font-bold ${isActive ? "text-accent" : "text-neutral-400"}`}>
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
