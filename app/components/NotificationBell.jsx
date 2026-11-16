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
      className="tap-sm relative flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 transition hover:bg-neutral-200 active:scale-95 md:hidden"
    >
      <Bell size={18} />
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white"
        >
          {unread}
        </span>
      )}
    </Link>
  );
};

export default NotificationBell;
