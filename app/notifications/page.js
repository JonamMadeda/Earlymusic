"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Disc3,
  Megaphone,
  Wrench,
} from "lucide-react";
import {
  KIND_ACCENTS,
  KIND_LABELS,
  KIND_PILLS,
  MAX_NOTIFICATIONS,
  normalizeNotificationKind,
} from "@/lib/notifications";
import { markNotificationsSeen, useNotificationFeed } from "@/lib/notificationFeed";

const KIND_ICONS = {
  news: Megaphone,
  update: Wrench,
  release: Disc3,
  warning: AlertTriangle,
};

const relativeTime = (value) => {
  const then = Date.parse(value);
  if (!Number.isFinite(then)) return "";
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const isInternal = (href) => typeof href === "string" && href.startsWith("/");

export default function NotificationsPage() {
  const { items, loading, error } = useNotificationFeed();
  const markedRef = useRef(false);

  // Opening the page is what clears the bell badge, so it happens once the feed
  // has actually arrived — marking during the empty first render would leave a
  // notification that lands a second later looking read.
  useEffect(() => {
    if (markedRef.current) return;
    if (loading || items.length === 0) return;
    markedRef.current = true;
    markNotificationsSeen();
  }, [loading, items.length]);

  return (
    <main className="min-h-[90vh] bg-transparent px-3 pb-36 pt-2 md:px-8 md:pt-6">
      <div className="mx-auto max-w-3xl">
        <section className="mb-6 md:mb-8">
          <div className="flex items-center gap-3">
            <div className="h-6 w-1 rounded-full bg-accent" />
            <h1 className="text-xl font-bold uppercase tracking-tight text-neutral-900 md:text-2xl">
              Notifications
            </h1>
          </div>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-neutral-400">
            App updates, new releases and service warnings from the Luumbo team.
            Only the {MAX_NOTIFICATIONS} most recent announcements stay listed.
          </p>
        </section>

        {loading && items.length === 0 && (
          <p className="py-2 text-xs text-neutral-400">Loading announcements…</p>
        )}

        {!loading && error && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5">
            <AlertTriangle size={14} className="text-amber-700" />
            <p className="text-xs font-medium text-amber-800">{error}</p>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-white py-32 text-neutral-200 shadow-sm">
            <Bell size={28} strokeWidth={1.5} />
            <p className="mt-3 text-[13px] font-medium text-neutral-400">
              Nothing to report right now.
            </p>
          </div>
        )}

        {items.length > 0 && (
          <div className="space-y-3">
            {items.map((item) => {
              const kind = normalizeNotificationKind(item.kind);
              const Icon = KIND_ICONS[kind];
              const href = item.url || null;

              return (
                <article
                  key={item.id}
                  className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 pl-5 shadow-sm transition hover:border-neutral-300 md:p-5 md:pl-6"
                >
                  <span
                    aria-hidden="true"
                    className={`absolute inset-y-0 left-0 w-1 ${KIND_ACCENTS[kind]}`}
                  />

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${KIND_PILLS[kind]}`}
                      >
                        <Icon size={10} strokeWidth={2.5} />
                        {KIND_LABELS[kind]}
                      </span>
                      <span className="text-[11px] font-medium text-neutral-400">
                        {relativeTime(item.created_at)}
                      </span>
                    </div>
                  </div>

                  <h2 className="mt-2 text-sm font-bold tracking-tight text-neutral-900 md:text-base">
                    {item.title}
                  </h2>

                  {item.body && (
                    <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-neutral-600">
                      {item.body}
                    </p>
                  )}

                  {href && (
                    <div className="mt-3">
                      {isInternal(href) ? (
                        <Link
                          href={href}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-accent/90 active:scale-95"
                        >
                          Open
                          <ArrowUpRight size={12} />
                        </Link>
                      ) : (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-accent/90 active:scale-95"
                        >
                          Learn more
                          <ArrowUpRight size={12} />
                        </a>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
