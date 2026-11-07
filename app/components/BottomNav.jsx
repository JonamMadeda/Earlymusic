"use client";

import { Home, Library, Music, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNotificationFeed } from "@/lib/notificationFeed";

const BottomNav = () => {
  const pathname = usePathname();
  const { unread } = useNotificationFeed();

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
    if (href === "/notifications") {
      return pathname === "/notifications";
    }
    return pathname === href;
  };

  return (
    <nav
      aria-label="Bottom navigation"
      className="fixed bottom-0 left-0 right-0 z-50 flex h-[calc(3.5rem+env(safe-area-inset-bottom,0px))] items-center justify-around border-t border-neutral-200/80 bg-white/95 px-4 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-xl md:hidden"
    >
      {navItems.map((item) => {
        const isActive = isPathActive(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            aria-label={isActive ? `${item.label}, current page` : item.label}
            className={`relative flex w-full flex-col items-center justify-center gap-y-0.5 py-2 px-1.5 min-h-[44px] transition-transform duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:rounded-lg ${
              isActive ? "scale-[1.02]" : ""
            }`}
          >
            <div className={`relative flex items-center justify-center rounded-xl px-3 py-0.5 transition-colors duration-200 ${
              isActive ? "bg-accent/10" : "hover:bg-neutral-50"
            }`}>
              <Icon
                size={20}
                className={`transition-colors duration-200 ${
                  isActive ? "text-accent" : "text-neutral-500 hover:text-neutral-700"
                }`}
                strokeWidth={isActive ? 2.5 : 1.75}
              />
              {item.label === "Notifications" && unread > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute top-1 right-1 flex h-3 min-w-3 items-center justify-center rounded-full bg-accent px-0.5 text-[8px] font-bold leading-none text-white ring-2 ring-white"
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </div>
            <span
              className={`text-[10px] font-semibold tracking-tight leading-none transition-colors duration-200 ${
                isActive ? "text-accent font-bold" : "text-neutral-500"
              }`}
            >
              {item.label}
            </span>
            {isActive && (
              <span
                className="absolute bottom-[calc(env(safe-area-inset-bottom,0px)+0.25rem)] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent transition-opacity duration-200"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
};

export default BottomNav;
