"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useNotificationFeed } from "@/lib/notificationFeed";

/**
 * Mobile entry point into announcements. Desktop gets a sidebar link instead,
 * so this hides itself above the md breakpoint rather than duplicating routes.
 */
const NotificationBell = () => {
  const { unread } = useNotificationFeed();

  return (
    <Link
      href="/notifications"
      aria-label={
        unread > 0
          ? `Announcements, ${unread} unread`
          : "Announcements"
      }
      className="relative flex md:hidden h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 active:scale-95 transition outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      <Bell size={16} />
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white"
        >
          {unread}
        </span>
      )}
    </Link>
  );
};

export default NotificationBell;
