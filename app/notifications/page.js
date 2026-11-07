"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Disc3,
  Megaphone,
  Wrench,
  X,
} from "lucide-react";
import {
  KIND_ACCENTS,
  KIND_LABELS,
  KIND_PILLS,
  normalizeNotificationKind,
} from "@/lib/notifications";
import { markNotificationsSeen, useNotificationFeed } from "@/lib/notificationFeed";

const KIND_ICONS = {
  news: Megaphone,
  update: Wrench,
  release: Disc3,
  warning: AlertTriangle,
};

const DISMISSED_KEY = "lumbo_notifications_dismissed";
const UNDO_TIMEOUT_MS = 4000;

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

const todayKey = new Date().toDateString();
const yesterdayKey = new Date(Date.now() - 86400000).toDateString();

const dayKey = (value) => new Date(value).toDateString();

const groupByDate = (items) => {
  const today = [];
  const yesterday = [];
  const earlier = [];
  items.forEach((item) => {
    const key = dayKey(item.created_at);
    if (key === todayKey) today.push(item);
    else if (key === yesterdayKey) yesterday.push(item);
    else earlier.push(item);
  });
  return [
    { label: "Today", items: today },
    { label: "Yesterday", items: yesterday },
    { label: "Earlier", items: earlier },
  ].filter((group) => group.items.length > 0);
};

const KIND_FILTERS = [
  { key: "all", label: "All" },
  { key: "release", label: "New release" },
  { key: "news", label: "Updates" },
];

export default function NotificationsPage() {
  const { items, loading, error, seenAt } = useNotificationFeed();
  const [filter, setFilter] = useState("all");
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]"));
    } catch {
      return new Set();
    }
  });
  const [undo, setUndo] = useState(null);
  const markedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed]));
    } catch {}
  }, [dismissed]);

  useEffect(() => {
    if (markedRef.current) return;
    if (loading || items.length === 0) return;
    markedRef.current = true;
    markNotificationsSeen();
  }, [loading, items.length]);

  const visibleItems = items.filter(
    (item) => {
      if (dismissed.has(item.id)) return false;
      const kind = normalizeNotificationKind(item.kind);
      if (filter === "all") return true;
      if (filter === "release") return kind === "release";
      return kind !== "release";
    }
  );

  const isUnread = (item) => {
    if (!seenAt) return true;
    const seen = Date.parse(seenAt);
    if (!Number.isFinite(seen)) return true;
    return Date.parse(item.created_at) > seen;
  };

  const hasUnread = visibleItems.some((item) => isUnread(item));

  const handleDismiss = (item) => {
    setUndo(null);
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });
    const timer = setTimeout(() => setUndo(null), UNDO_TIMEOUT_MS);
    setUndo({ item, timer });
  };

  const handleUndo = () => {
    if (!undo) return;
    clearTimeout(undo.timer);
    setDismissed((prev) => {
      const next = new Set(prev);
      next.delete(undo.item.id);
      return next;
    });
    setUndo(null);
  };

  const handleMarkAllRead = () => {
    markNotificationsSeen();
  };

  return (
    <main className="min-h-[90vh] bg-transparent px-3 pb-36 pt-2 md:px-8 md:pt-6">
      <div className="mx-auto max-w-3xl">
        {undo && (
          <div
            className="mb-4 flex items-center justify-between rounded-xl border border-neutral-100 bg-white px-3 py-2.5 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-neutral-500" />
              <p className="text-xs font-medium text-neutral-900">
                Dismissed “{undo.item.title}”
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleUndo}
                className="text-xs font-semibold text-accent hover:underline"
              >
                Undo
              </button>
              <button
                onClick={() => setUndo(null)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        )}

        <section className="mb-6 md:mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold uppercase tracking-tight text-neutral-900 md:text-2xl">
              Notifications
            </h1>
            {hasUnread && !loading && (
              <button
                onClick={handleMarkAllRead}
                className="ml-auto flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50/60 px-2.5 py-1 text-[11px] font-semibold text-neutral-600 hover:bg-neutral-100 transition outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {KIND_FILTERS.map((kind) => (
              <button
                key={kind.key}
                onClick={() => setFilter(kind.key)}
                className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition whitespace-nowrap ${
                  filter === kind.key
                    ? "border-accent bg-accent text-white"
                    : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50"
                }`}
              >
                {kind.label}
              </button>
            ))}
          </div>
        </section>

        {loading && visibleItems.length === 0 && (
          <p className="py-2 text-xs text-neutral-400">Loading announcements…</p>
        )}

        {!loading && error && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-700" />
              <p className="text-xs font-medium text-amber-800">{error}</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="text-xs font-semibold text-amber-700 hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && visibleItems.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-white py-32 text-neutral-200 shadow-sm">
            <Bell size={28} strokeWidth={1.5} />
            <p className="mt-3 text-[13px] font-medium text-neutral-400">
              Nothing to report right now.
            </p>
          </div>
        )}

        {!loading && !error && visibleItems.length > 0 && (
          <div className="space-y-6">
            {groupByDate(visibleItems).map((group) => (
              <section key={group.label}>
                <h3 className="mb-3 flex items-center gap-2">
                  <span className="h-0.5 w-6 bg-neutral-200 shrink-0" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                    {group.label}
                  </span>
                </h3>
                <div className="space-y-3">
                  {group.items.map((item) => {
                    const kind = normalizeNotificationKind(item.kind);
                    const Icon = KIND_ICONS[kind];
                    const href = item.url || null;
                    const unread = isUnread(item);

                    return (
                      <article
                        key={item.id}
                        className={`relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 pl-5 shadow-sm transition ${
                          unread
                            ? "bg-white border-neutral-100 shadow-md"
                            : "bg-neutral-50/40 border-neutral-100"
                        } hover:border-neutral-300 md:p-5 md:pl-6`}
                      >
                        <span
                          aria-hidden="true"
                          className={`absolute inset-y-0 left-0 w-1 ${KIND_ACCENTS[kind]}`} />
                        {unread && (
                          <span
                            className="absolute top-2 right-2 h-2 w-2 rounded-full bg-accent ring-2 ring-white"
                            aria-hidden="true"
                          />
                        )}

                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${KIND_PILLS[kind]}`}
                            >
                              <Icon size={10} strokeWidth={2.5} />
                              {KIND_LABELS[kind]}
                            </span>
                            <span className={`text-[11px] font-medium ${unread ? "text-neutral-600" : "text-neutral-400"}`}>
                              {relativeTime(item.created_at)}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDismiss(item);
                            }}
                            className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition"
                            aria-label="Dismiss announcement"
                          >
                            <X size={12} />
                          </button>
                        </div>

                        <h2 className={`mt-2 text-sm font-bold tracking-tight ${unread ? "text-neutral-900" : "text-neutral-700"} md:text-base`}>
                          {item.title}
                        </h2>

                        {item.body && (
                          <p className={`mt-1.5 whitespace-pre-line text-sm leading-relaxed ${unread ? "text-neutral-600" : "text-neutral-500"}`}>
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
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
