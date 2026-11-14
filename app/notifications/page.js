"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  Disc3,
  Megaphone,
  RefreshCw,
  Wrench,
  X,
} from "lucide-react";
import {
  KIND_ACCENTS,
  KIND_LABELS,
  KIND_PILLS,
  NOTIFICATION_KINDS,
  normalizeNotificationKind,
} from "@/lib/notifications";
import {
  markNotificationsSeen,
  refreshNotifications,
  useNotificationFeed,
} from "@/lib/notificationFeed";

const KIND_ICONS = {
  news: Megaphone,
  update: Wrench,
  release: Disc3,
  warning: AlertTriangle,
};

const DISMISSED_KEY = "lumbo_notifications_dismissed";
const UNDO_TIMEOUT_MS = 4000;

const FILTERS = [
  { key: "all", label: "All" },
  ...NOTIFICATION_KINDS.map((kind) => ({ key: kind, label: KIND_LABELS[kind] })),
];

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

const groupByDate = (items) => {
  // Computed per render rather than at module load so the groups stay correct
  // when the page is left open across midnight.
  const now = new Date();
  const todayKey = now.toDateString();
  const yesterdayKey = new Date(now.getTime() - 86400000).toDateString();
  const today = [];
  const yesterday = [];
  const earlier = [];

  items.forEach((item) => {
    const key = new Date(item.created_at).toDateString();
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

export default function NotificationsPage() {
  const { items, loading, error, unreadIds } = useNotificationFeed();
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
  const undoTimerRef = useRef(null);
  const markedRef = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed]));
    } catch {}
  }, [dismissed]);

  // Opening the page clears the shared badge. The store keeps the unread ids so
  // the "new" styling stays visible instead of flashing once and vanishing.
  useEffect(() => {
    if (markedRef.current || loading || items.length === 0) return;
    markedRef.current = true;
    markNotificationsSeen();
  }, [loading, items.length]);

  // A dismissed announcement's undo timer must not outlive the page.
  useEffect(() => () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  }, []);

  const clearUndoTimer = () => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  };

  const counts = useMemo(() => {
    const next = { all: 0 };
    NOTIFICATION_KINDS.forEach((kind) => {
      next[kind] = 0;
    });
    items.forEach((item) => {
      if (dismissed.has(item.id)) return;
      next.all += 1;
      next[normalizeNotificationKind(item.kind)] += 1;
    });
    return next;
  }, [items, dismissed]);

  const visibleItems = items.filter((item) => {
    if (dismissed.has(item.id)) return false;
    if (filter === "all") return true;
    return normalizeNotificationKind(item.kind) === filter;
  });

  const unreadSet = useMemo(() => new Set(unreadIds), [unreadIds]);
  // Counted across the whole feed, not the filtered slice: switching to an
  // empty category should not hide the "Mark all read" action.
  const unreadCount = items.filter(
    (item) => !dismissed.has(item.id) && unreadSet.has(item.id)
  ).length;
  const hasUnread = unreadCount > 0;
  const filterLabel = FILTERS.find((entry) => entry.key === filter)?.label || "All";

  const handleDismiss = (item) => {
    clearUndoTimer();
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });
    undoTimerRef.current = setTimeout(() => {
      undoTimerRef.current = null;
      setUndo(null);
    }, UNDO_TIMEOUT_MS);
    setUndo({ item });
  };

  const handleUndo = () => {
    if (!undo) return;
    clearUndoTimer();
    setDismissed((prev) => {
      const next = new Set(prev);
      next.delete(undo.item.id);
      return next;
    });
    setUndo(null);
  };

  const dismissUndo = () => {
    clearUndoTimer();
    setUndo(null);
  };

  const handleMarkAllRead = () => {
    markNotificationsSeen({ clearHighlights: true });
  };

  const handleRetry = () => {
    refreshNotifications({ force: true });
  };

  return (
    <main className="min-h-[90vh] bg-transparent px-3 pb-36 pt-2 md:px-8 md:pt-6">
      <div className="mx-auto max-w-3xl">
        {undo && (
          <div
            role="status"
            aria-live="polite"
            className="sticky top-2 z-30 mb-4 flex items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-white shadow-lg"
          >
            <div className="flex min-w-0 items-center gap-2">
              <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
              <p className="truncate text-xs font-medium">
                Dismissed “{undo.item.title}”
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={handleUndo}
                className="rounded-lg px-2 py-1 text-xs font-bold text-emerald-300 transition hover:bg-white/10"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={dismissUndo}
                aria-label="Dismiss undo"
                className="flex h-6 w-6 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )}

        <header className="mb-5 md:mb-7">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-neutral-900 md:text-2xl">
                  Notifications
                </h1>
                {hasUnread && (
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-accent">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500 md:text-sm">
                New releases, app updates and news from the team.
              </p>
            </div>
            {hasUnread && !loading && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="shrink-0 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50 outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
            {FILTERS.map((entry) => {
              const active = filter === entry.key;
              const count = counts[entry.key] ?? 0;
              return (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => setFilter(entry.key)}
                  aria-pressed={active}
                  className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "border-accent bg-accent text-white shadow-sm"
                      : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50"
                  }`}
                >
                  {entry.label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-xs font-bold leading-none tabular-nums ${
                      active ? "bg-white/20 text-white" : "bg-neutral-100 text-neutral-500"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </header>

        {loading && visibleItems.length === 0 && (
          <div className="space-y-3" aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="animate-pulse rounded-2xl border border-neutral-100 bg-white p-4 md:p-5"
              >
                <div className="flex gap-3">
                  <div className="h-9 w-9 shrink-0 rounded-xl bg-neutral-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-24 rounded bg-neutral-100" />
                    <div className="h-4 w-3/4 rounded bg-neutral-100" />
                    <div className="h-3 w-full rounded bg-neutral-100" />
                  </div>
                </div>
              </div>
            ))}
            <span className="sr-only">Loading announcements…</span>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-700" />
              <p className="text-sm font-medium text-amber-900">{error}</p>
            </div>
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-amber-800 active:scale-95"
            >
              <RefreshCw size={12} />
              Retry
            </button>
          </div>
        )}

        {!loading && !error && visibleItems.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-white/70 px-6 py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
              {filter === "all" ? <CheckCircle2 size={22} /> : <Bell size={22} />}
            </div>
            <p className="mt-3 text-sm font-semibold text-neutral-700">
              {filter === "all"
                ? "You’re all caught up"
                : `No ${filterLabel.toLowerCase()} announcements`}
            </p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-neutral-400">
              {filter === "all"
                ? "New releases, app updates and news from the team will show up here."
                : "Try another category to see what you might have missed."}
            </p>
            {filter !== "all" && (
              <button
                type="button"
                onClick={() => setFilter("all")}
                className="mt-4 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50"
              >
                Show all
              </button>
            )}
          </div>
        )}

        {!loading && !error && visibleItems.length > 0 && (
          <div className="space-y-7">
            {groupByDate(visibleItems).map((group) => (
              <section key={group.label}>
                <div className="mb-3 flex items-center gap-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">
                    {group.label}
                  </h3>
                  <span className="h-px flex-1 bg-neutral-200/80" />
                  <span className="text-xs font-semibold tabular-nums text-neutral-400">
                    {group.items.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {group.items.map((item) => {
                    const kind = normalizeNotificationKind(item.kind);
                    const Icon = KIND_ICONS[kind];
                    const href = item.url || null;
                    const unread = unreadSet.has(item.id);

                    return (
                      <article
                        key={item.id}
                        className={`group relative overflow-hidden rounded-2xl border bg-white transition-all duration-200 hover:shadow-md ${
                          unread ? "border-neutral-200 shadow-sm" : "border-neutral-100"
                        }`}
                      >
                        {unread && (
                          <span
                            className={`absolute inset-y-0 left-0 w-1 ${KIND_ACCENTS[kind]}`}
                            aria-hidden="true"
                          />
                        )}

                        <div className="flex gap-3 p-4 md:gap-3.5 md:p-5">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${KIND_PILLS[kind]}`}
                          >
                            <Icon size={16} strokeWidth={2} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
                                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                                  {KIND_LABELS[kind]}
                                </span>
                                <span
                                  className="h-0.5 w-0.5 rounded-full bg-neutral-300"
                                  aria-hidden="true"
                                />
                                <time
                                  dateTime={item.created_at}
                                  className="text-xs font-medium text-neutral-400"
                                >
                                  {relativeTime(item.created_at)}
                                </time>
                                {unread && (
                                  <span className="rounded-full bg-accent px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                                    New
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDismiss(item)}
                                aria-label={`Dismiss announcement: ${item.title}`}
                                className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-neutral-300 transition hover:bg-neutral-100 hover:text-neutral-600"
                              >
                                <X size={14} />
                              </button>
                            </div>

                            <h2
                              className={`mt-1.5 text-sm font-bold leading-snug tracking-tight md:text-[15px] ${
                                unread ? "text-neutral-900" : "text-neutral-700"
                              }`}
                            >
                              {item.title}
                            </h2>

                            {item.body && (
                              <p
                                className={`mt-1.5 whitespace-pre-line text-[13px] leading-relaxed md:text-sm ${
                                  unread ? "text-neutral-600" : "text-neutral-500"
                                }`}
                              >
                                {item.body}
                              </p>
                            )}

                            {href && (
                              <div className="mt-3">
                                {isInternal(href) ? (
                                  <Link
                                    href={href}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-neutral-800 active:scale-95"
                                  >
                                    Open
                                    <ArrowUpRight size={12} />
                                  </Link>
                                ) : (
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-neutral-800 active:scale-95"
                                  >
                                    Learn more
                                    <ArrowUpRight size={12} />
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
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
