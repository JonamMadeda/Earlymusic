"use client";

import { Home, Search, Library, ListMusic } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const BottomNav = () => {
  const pathname = usePathname();

  const navItems = [
    { icon: Home, label: "Home", href: "/" },
    { icon: Search, label: "Search", href: "/search" },
    { icon: ListMusic, label: "Playlists", href: "/playlists" },
    { icon: Library, label: "Library", href: "/library" },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-100 h-20 flex items-center justify-around px-4 z-50 pb-4">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.label}
            href={item.href}
            className="flex flex-col items-center gap-y-1 w-full"
          >
            <item.icon
              size={24}
              className={isActive ? "text-red-600" : "text-neutral-400"}
              strokeWidth={isActive ? 2.5 : 2}
            />
            <span
              className={`text-[10px] font-bold ${
                isActive ? "text-red-600" : "text-neutral-400"
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
