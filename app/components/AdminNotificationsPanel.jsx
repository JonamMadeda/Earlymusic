"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Megaphone, Trash2 } from "lucide-react";
import ConfirmModal from "./ConfirmModal";
import { refreshNotifications } from "@/lib/notificationFeed";
import {
  BODY_MAX_LENGTH,
  KIND_DOTS,
  KIND_LABELS,
  MAX_NOTIFICATIONS,
  NOTIFICATION_KINDS,
  TITLE_MAX_LENGTH,
  normalizeNotificationKind,
} from "@/lib/notifications";

const authedFetch = (url, opts = {}) =>
  fetch(url, {
    ...opts,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...opts.headers },
  });

const emptyDraft = { kind: "news", title: "", body: "", url: "" };

/**
 * Admin composer and list for the public announcements feed. Mounted only when
 * the Notifications tab is active, so its fetch runs on first visit instead of
 * adding another request to the dashboard's mount burst.
 */
export default function AdminNotificationsPanel({ onToast }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");

  const [draft, setDraft] = useState(emptyDraft);
  const [isPosting, setIsPosting] = useState(false);
  const [formError, setFormError] = useState("");

  const [pendingDelete, setPendingDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await authedFetch("/api/admin/notifications");
      if (!response.ok) throw new Error(`Unable to load announcements (${response.status}).`);
      const body = await response.json().catch(() => ({}));
      setItems(Array.isArray(body?.notifications) ? body.notifications : []);
      setListError("");
    } catch (error) {
      console.error("Unable to load announcements:", error);
      setListError("Unable to load announcements. Is lib/migration-notifications.sql applied?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const atCap = items.length >= MAX_NOTIFICATIONS;
  const titleLeft = TITLE_MAX_LENGTH - draft.title.length;
  const bodyLeft = BODY_MAX_LENGTH - draft.body.length;
  const canPost = draft.title.trim().length > 0 && !isPosting && titleLeft >= 0 && bodyLeft >= 0;

  const handlePost = async (event) => {
    event.preventDefault();
    setFormError("");
    setIsPosting(true);
    try {
      const response = await authedFetch("/api/admin/notifications", {
        method: "POST",
        body: JSON.stringify(draft),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to post the announcement.");

      setDraft(emptyDraft);
      // The bell and the sidebar link read the shared feed store, so posting has
      // to refresh it or the admin's own chrome keeps yesterday's announcements.
      await Promise.all([load(), refreshNotifications({ force: true })]);
      if (body.evicted > 0) {
        onToast?.(`Posted. Dropped ${body.evicted} oldest to hold the ${MAX_NOTIFICATIONS} limit.`, "error");
      } else {
        onToast?.("Announcement posted.");
      }
    } catch (error) {
      console.error("Unable to post announcement:", error);
      setFormError(error.message || "Unable to post the announcement.");
    } finally {
      setIsPosting(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      const response = await authedFetch("/api/admin/notifications", {
        method: "DELETE",
        body: JSON.stringify({ id: pendingDelete.id }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to delete the announcement.");

      onToast?.("Announcement removed.");
      setPendingDelete(null);
      await Promise.all([load(), refreshNotifications({ force: true })]);
    } catch (error) {
      console.error("Unable to delete announcement:", error);
      setFormError(error.message || "Unable to delete the announcement.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm md:p-5">
      <div className="mb-3 flex items-center gap-2">
        <BellRing size={14} className="text-accent" />
        <h2 className="text-sm font-bold tracking-tight text-neutral-900">Announcements</h2>
        <span className="ml-auto rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-bold text-neutral-500">
          {items.length}/{MAX_NOTIFICATIONS}
        </span>
      </div>

      <p className="mb-3 text-xs leading-relaxed text-neutral-500">
        Anything posted here appears in the app for signed-out listeners too. The feed
        holds {MAX_NOTIFICATIONS} announcements: once it is full, the next post removes the
        oldest one.
      </p>

      <form onSubmit={handlePost} className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Announcement type"
            value={draft.kind}
            onChange={(event) => setDraft((prev) => ({ ...prev, kind: event.target.value }))}
            disabled={isPosting}
            className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-600 outline-none transition focus:border-accent"
          >
            {NOTIFICATION_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {KIND_LABELS[kind]}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={draft.title}
            onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Headline — what listeners see first"
            maxLength={TITLE_MAX_LENGTH}
            required
            disabled={isPosting}
            className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:bg-white"
          />
        </div>

        <textarea
          aria-label="Announcement message"
          value={draft.body}
          onChange={(event) => setDraft((prev) => ({ ...prev, body: event.target.value }))}
          placeholder="Details (optional). Line breaks are kept."
          rows={3}
          maxLength={BODY_MAX_LENGTH}
          disabled={isPosting}
          className="w-full resize-y rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:bg-white"
        />

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={draft.url}
            onChange={(event) => setDraft((prev) => ({ ...prev, url: event.target.value }))}
            placeholder="Link (optional) — /songs or https://…"
            disabled={isPosting}
            className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:bg-white"
          />
          <button
            type="submit"
            disabled={!canPost}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-accent/90 active:scale-95 disabled:opacity-50"
          >
            <Megaphone size={13} />
            {isPosting ? "Posting…" : "Post"}
          </button>
        </div>

        <p className="text-[11px] font-medium text-neutral-400">
          {titleLeft} characters left in the headline · {bodyLeft} in the message
        </p>

        {formError && <p className="text-xs font-medium text-red-600">{formError}</p>}

        {atCap && draft.title.trim() && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5">
            <p className="text-xs font-medium text-amber-800">
              The feed is full. Posting this drops &ldquo;{items[items.length - 1]?.title}&rdquo;.
            </p>
          </div>
        )}
      </form>

      <div className="mt-4 border-t border-neutral-100 pt-3">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
          Live feed
        </p>

        {loading && <p className="py-2 text-xs text-neutral-400">Loading announcements…</p>}

        {!loading && listError && <p className="py-2 text-xs font-medium text-red-600">{listError}</p>}

        {!loading && !listError && items.length === 0 && (
          <p className="py-2 text-xs text-neutral-400">Nothing posted yet.</p>
        )}

        {!loading &&
          items.map((item) => {
            const kind = normalizeNotificationKind(item.kind);
            return (
              <div
                key={item.id}
                className="flex items-start gap-2 border-b border-neutral-50 py-2 last:border-0"
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${KIND_DOTS[kind]}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-neutral-800">
                    {KIND_LABELS[kind]} · {item.title}
                  </p>
                  <p className="text-[11px] text-neutral-400">
                    {new Date(item.created_at).toLocaleString()}
                    {item.url ? ` · ${item.url}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingDelete(item)}
                  aria-label={`Delete announcement: ${item.title}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
      </div>

      <ConfirmModal
        isOpen={!!pendingDelete}
        title="Remove this announcement?"
        message={pendingDelete ? `“${pendingDelete.title}” disappears from every listener's feed.` : ""}
        confirmLabel="Remove"
        busy={isDeleting}
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />
    </section>
  );
}
