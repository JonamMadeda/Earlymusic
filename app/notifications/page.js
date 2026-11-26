"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  KIND_LABELS,
  KIND_PILLS,
  NOTIFICATION_KINDS,
  TARGET_LABELS,
  normalizeNotificationId,
  normalizeNotificationKind,
  normalizeNotificationTarget,
} from "@/lib/notifications";
import {
  dismissNotification,
  markNotificationRead,
  markNotificationsSeen,
  refreshNotifications,
  undismissNotification,
  useNotificationFeed,
} from "@/lib/notificationFeed";

const KIND_ICONS = {
  news: Megaphone,
  update: Wrench,
  release: Disc3,
  warning: AlertTriangle,
};

// The kind chip already says "Release", so the card does not need to repeat
// "new" beside a "new" rail and a "new" badge.
const KIND_CARD_LABELS = { ...KIND_LABELS, release: "Release" };

const UNDO_TIMEOUT_MS = 4000;
const BODY_CLAMP_LENGTH = 200;

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
  const groups = [];

  items.forEach((item) => {
    const date = new Date(item.created_at);
    const key = date.toDateString();
    const label = key === todayKey
      ? "Today"
      : key === yesterdayKey
        ? "Yesterday"
        : Number.isNaN(date.getTime())
          ? "Earlier"
          : date.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
            });
    const existing = groups.find((group) => group.key === key);
    if (existing) existing.items.push(item);
    else groups.push({ key, label, items: [item] });
  });

  return groups;
};

const filterFromUrl = () => {
  const value = new URLSearchParams(window.location.search).get("filter");
  return FILTERS.some((entry) => entry.key === value) ? value : "all";
};

const NotificationBody = ({ body, unread }) => {
  const [expanded, setExpanded] = useState(false);
  const long = body.length > BODY_CLAMP_LENGTH;

  return (
    <>
      <p
        className={`mt-1 break-words whitespace-pre-line text-[13px] leading-snug md:text-sm ${
          unread ? "text-neutral-600" : "text-neutral-500"
        } ${long && !expanded ? "line-clamp-3" : ""}`}
      >
        {body}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="tap-sm relative z-10 mt-1 inline-flex min-h-9 items-center rounded text-xs font-semibold text-neutral-600 transition hover:text-neutral-900 outline-none focus-visible:ring-2 focus-visible:ring-accent/50 md:min-h-8"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </>
  );
};

export default function NotificationsPage() {
  const { items, loading, error, unreadIds, dismissedIds } = useNotificationFeed();
  const router = useRouter();
  const pathname = usePathname();
  const [filter, setFilter] = useState("all");
  const dismissed = useMemo(() => new Set(dismissedIds), [dismissedIds]);
  const [undo, setUndo] = useState(null);
  const undoTimerRef = useRef(null);
  const markedRef = useRef(false);

  // Re-render once a minute so "23m ago" does not stay frozen on an open tab.
  const [, setClock] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setClock((value) => value + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const syncFilter = () => setFilter(filterFromUrl());
    syncFilter();
    window.addEventListener("popstate", syncFilter);
    return () => window.removeEventListener("popstate", syncFilter);
  }, []);

  // Opening the page clears the shared unread badge. The store keeps the ids so
  // the "new" rail stays visible instead of flashing once and vanishing; the
  // explicit "Mark all as read" action removes them in one step.
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
      if (dismissed.has(normalizeNotificationId(item.id))) return;
      next.all += 1;
      next[normalizeNotificationKind(item.kind)] += 1;
    });
    return next;
  }, [items, dismissed]);

  const visibleItems = items.filter((item) => {
    if (dismissed.has(normalizeNotificationId(item.id))) return false;
    if (filter === "all") return true;
    return normalizeNotificationKind(item.kind) === filter;
  });

  const unreadSet = useMemo(() => new Set(unreadIds), [unreadIds]);
  // Counted across the whole feed, not the filtered slice: switching to an
  // empty category should not hide the "Mark all as read" action.
  const unreadCount = items.filter((item) => {
    const id = normalizeNotificationId(item.id);
    return id !== null && !dismissed.has(id) && unreadSet.has(id);
  }).length;
  const hasUnread = unreadCount > 0;
  const filterLabel = FILTERS.find((entry) => entry.key === filter)?.label || "All";

  const handleDismiss = (item) => {
    clearUndoTimer();
    dismissNotification(item.id);
    undoTimerRef.current = setTimeout(() => {
      undoTimerRef.current = null;
      setUndo(null);
    }, UNDO_TIMEOUT_MS);
    setUndo({ item });
  };

  const handleUndo = () => {
    if (!undo) return;
    clearUndoTimer();
    undismissNotification(undo.item.id);
    setUndo(null);
  };

  const dismissUndo = () => {
    clearUndoTimer();
    setUndo(null);
  };

  const handleFilterChange = (nextFilter) => {
    if (nextFilter === filter) return;
    setFilter(nextFilter);
    const params = new URLSearchParams(window.location.search);
    if (nextFilter === "all") params.delete("filter");
    else params.set("filter", nextFilter);
    const query = params.toString();
    router.push(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  };

  const handleMarkAllRead = () => {
    markNotificationsSeen({ clearHighlights: true });
  };

  const handleRetry = () => {
    refreshNotifications({ force: true });
  };

  return (
    <section aria-labelledby="notifications-heading" className="min-h-[90vh] bg-transparent px-3 pb-36 pt-2 md:px-8 md:pt-6">
      <div className="mx-auto max-w-3xl">
        {undo && (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-[calc(9.5rem+env(safe-area-inset-bottom,0px))] left-3 right-3 z-[950] md:bottom-24 md:left-[calc(260px+2rem)] md:right-8"
          >
            <div className="mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-white shadow-lg">
              <div className="flex min-w-0 items-center gap-2">
                <CheckCircle2 size={15} className="shrink-0 text-emerald-400" aria-hidden="true" />
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
                  className="flex h-7 w-7 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        )}

        <header className="mb-5 md:mb-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 id="notifications-heading" className="text-xl font-bold tracking-tight text-neutral-900 md:text-2xl">
                  What&rsquo;s new
                </h1>
                {hasUnread && (
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-accent">
                    {unreadCount} new
                  </span>
                )}
              </div>
            </div>
            {hasUnread && !loading && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="min-h-11 shrink-0 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50 outline-none focus-visible:ring-2 focus-visible:ring-accent/50 md:min-h-9"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div
            role="group"
            aria-label="Filter notifications"
            className="mt-3 flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {FILTERS.map((entry) => {
              const active = filter === entry.key;
              const count = counts[entry.key] ?? 0;
              const disabled = count === 0 && !active;
              return (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => handleFilterChange(entry.key)}
                  aria-pressed={active}
                  aria-label={`${entry.label}, ${count} ${count === 1 ? "notification" : "notifications"}`}
                  disabled={disabled}
                  className={`tap-sm flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold transition disabled:pointer-events-none disabled:opacity-45 ${
                    active
                      ? "border-accent bg-accent text-white shadow-sm"
                      : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50"
                  }`}
                >
                  {entry.label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none tabular-nums ${
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
                className="animate-pulse rounded-xl border border-neutral-100 bg-white p-3"
              >
                <div className="flex gap-2.5">
                  <div className="h-8 w-8 shrink-0 rounded-xl bg-neutral-100" />
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

        {error && (
          <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <AlertTriangle size={16} className="shrink-0 text-amber-700" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-amber-900">{error}</p>
                {items.length > 0 && (
                  <p className="mt-0.5 text-xs text-amber-800">Showing previously loaded announcements.</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-amber-800 active:scale-95 md:min-h-9"
            >
              <RefreshCw size={12} aria-hidden="true" />
              Retry
            </button>
          </div>
        )}

        {!loading && !error && visibleItems.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-white/70 px-6 py-12 text-center md:py-16">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
              {filter === "all" ? <CheckCircle2 size={22} aria-hidden="true" /> : <Bell size={22} aria-hidden="true" />}
            </div>
            <p className="mt-3 text-sm font-semibold text-neutral-700">
              {filter === "all"
                ? "You’re all caught up"
                : `No ${filterLabel.toLowerCase()} announcements`}
            </p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-neutral-500">
              {filter === "all"
                ? "New releases, app updates and news from the team will show up here."
                : "Try another category to see what you might have missed."}
            </p>
            {filter !== "all" && (
              <button
                type="button"
                onClick={() => handleFilterChange("all")}
                className="mt-4 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50"
              >
                Show all
              </button>
            )}
          </div>
        )}

        {visibleItems.length > 0 && (
          <div className="space-y-4">
            {groupByDate(visibleItems).map((group) => (
              <section key={group.key}>
                <div className="mb-2.5 flex items-center gap-2.5">
                  <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-500">
                    {group.label}
                  </h2>
                  <span className="h-px flex-1 bg-neutral-200/80" />
                  <span className="text-xs font-semibold tabular-nums text-neutral-500">
                    {group.items.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {group.items.map((item) => {
                    const kind = normalizeNotificationKind(item.kind);
                    const Icon = KIND_ICONS[kind];
                    const href = item.url || null;
                    const external = href ? !isInternal(href) : false;
                    const unread = unreadSet.has(normalizeNotificationId(item.id));
                    const actionLabel =
                      kind === "release" || kind === "update" ? "Listen to" : "Read";
                    const titleClass = `mt-1 text-sm font-bold leading-snug tracking-tight ${
                      unread ? "text-neutral-900" : "text-neutral-700"
                    }`;
                    const linkClass =
                      "rounded outline-none transition hover:text-accent focus-visible:ring-2 focus-visible:ring-accent/50 after:absolute after:inset-0 after:rounded-xl";

                    return (
                      <article
                        key={item.id}
                        className={`group relative overflow-hidden rounded-xl border bg-white transition-all duration-200 focus-within:border-neutral-300 hover:border-neutral-300 hover:shadow-sm ${
                          unread ? "border-neutral-200 bg-neutral-50/40" : "border-neutral-100"
                        }`}
                      >
                        {unread && (
                          <span
                            className="absolute inset-y-0 left-0 w-1 bg-accent"
                            aria-hidden="true"
                          />
                        )}

                        <div className="flex gap-2.5 p-2.5 md:gap-3 md:p-3">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${KIND_PILLS[kind]}`}
                          >
                            <Icon size={15} strokeWidth={2} aria-hidden="true" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pt-0.5">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                                  {unread && <span className="sr-only">New · </span>}
                                  {KIND_CARD_LABELS[kind]}
                                </span>
                                {normalizeNotificationTarget(item.target) !== "general" && (
                                  <span className="rounded-full bg-accent/8 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                                    {TARGET_LABELS[normalizeNotificationTarget(item.target)]}
                                  </span>
                                )}
                                <span
                                  className="h-0.5 w-0.5 rounded-full bg-neutral-300"
                                  aria-hidden="true"
                                />
                                <time
                                  dateTime={item.created_at}
                                  title={new Date(item.created_at).toLocaleString()}
                                  suppressHydrationWarning
                                  className="text-[11px] font-medium text-neutral-500"
                                >
                                  {relativeTime(item.created_at)}
                                </time>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDismiss(item)}
                                aria-label={`Dismiss announcement: ${item.title}`}
                                className="tap-sm relative z-10 -mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700 outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                              >
                                <X size={14} aria-hidden="true" />
                              </button>
                            </div>

                            <h3 className={titleClass}>
                              {href ? (
                                external ? (
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => markNotificationRead(item.id)}
                                    className={linkClass}
                                  >
                                    <span className="sr-only">{actionLabel}: </span>
                                    {item.title}
                                    <ArrowUpRight
                                      size={13}
                                      className="ml-0.5 inline-block align-baseline text-neutral-400 transition group-hover:text-neutral-700"
                                      aria-hidden="true"
                                    />
                                  </a>
                                ) : (
                                  <Link
                                    href={href}
                                    onClick={() => markNotificationRead(item.id)}
                                    className={linkClass}
                                  >
                                    <span className="sr-only">{actionLabel}: </span>
                                    {item.title}
                                    <ArrowUpRight
                                      size={13}
                                      className="ml-0.5 inline-block align-baseline text-neutral-400 transition group-hover:text-neutral-700"
                                      aria-hidden="true"
                                    />
                                  </Link>
                                )
                              ) : (
                                item.title
                              )}
                            </h3>

                            {item.body && (
                              <NotificationBody body={item.body} unread={unread} />
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
    </section>
  );
}
