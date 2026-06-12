"use client";

import { Home, Library, Music, Download, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const BottomNav = () => {
  const pathname = usePathname();

  const navItems = [
    { icon: Home, label: "Home", href: "/songs" },
    { icon: Download, label: "Downloads", href: "/downloads" },
    { icon: Library, label: "Library", href: "/library" },
    { icon: User, label: "Account", href: "/account" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center justify-around border-t border-white/70 bg-white/85 px-4 backdrop-blur-xl md:hidden">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.label}
            href={item.href}
            className={`flex w-full flex-col items-center gap-y-0.5 rounded-xl py-1 transition ${
              isActive ? "bg-accent/10 text-accent" : "text-neutral-400"
            }`}
          >
      <item.icon
              size={20}
              className={isActive ? "text-accent" : "text-neutral-400"}
              strokeWidth={isActive ? 2.5 : 2}
            />
            <span
              className={`text-[9px] font-bold ${
                isActive ? "text-accent" : "text-neutral-400"
              }`}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
};

export default BottomNav;
