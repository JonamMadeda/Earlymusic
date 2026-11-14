"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  Download,
  ExternalLink,
  Gavel,
  Loader2,
  Mail,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";

const STATUS_STYLES = {
  open: "bg-amber-50 text-amber-700 border-amber-200",
  reviewed: "bg-sky-50 text-sky-700 border-sky-200",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  dismissed: "bg-neutral-100 text-neutral-600 border-neutral-200",
};

const timeAgo = (iso) => {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "—";
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  const days = Math.floor(seconds / 86400);
  return days === 1 ? "yesterday" : `${days}d ago`;
};

const csvEscape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export default function AdminLegalPanel({ onToast, onTakedown }) {
  const [reports, setReports] = useState(null);
  const [takedowns, setTakedowns] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [confirmId, setConfirmId] = useState("");
  const [drafts, setDrafts] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [reportData, takedownData] = await Promise.all([
        apiFetch("/api/admin/dmca"),
        apiFetch("/api/admin/takedown-log"),
      ]);
      const list = Array.isArray(reportData.reports) ? reportData.reports : [];
      setReports(list);
      setTakedowns(Array.isArray(takedownData.entries) ? takedownData.entries : []);
      setDrafts((prev) => {
        const next = { ...prev };
        for (const report of list) {
          if (!next[report.id]) {
            next[report.id] = {
              status: report.status,
              note: report.resolution_note || "",
            };
          }
        }
        return next;
      });
    } catch (loadError) {
      setError(loadError.message || "Unable to load legal records.");
      setReports([]);
      setTakedowns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patchReport = async (id, patch) => {
    setBusyId(id);
    try {
      const data = await apiFetch("/api/admin/dmca", {
        method: "PATCH",
        body: JSON.stringify({ id, ...patch }),
      });
      setReports((prev) =>
        (prev || []).map((report) =>
          report.id === id ? { ...report, ...data.report } : report
        )
      );
      onToast?.("Report updated.");
      return data;
    } catch (patchError) {
      onToast?.(patchError.message || "Unable to update the report.", "error");
      return null;
    } finally {
      setBusyId("");
    }
  };

  const saveReport = async (report) => {
    const draft = drafts[report.id] || { status: report.status, note: "" };
    await patchReport(report.id, {
      status: draft.status,
      resolution_note: draft.note,
    });
  };

  const takeDown = async (report) => {
    if (confirmId !== report.id) {
      setConfirmId(report.id);
      setTimeout(() => setConfirmId((current) => (current === report.id ? "" : current)), 5000);
      return;
    }
    setConfirmId("");
    const draft = drafts[report.id] || {};
    const data = await patchReport(report.id, {
      action: "takedown",
      resolution_note: draft.note || "",
    });
    if (data?.takedown) {
      setDrafts((prev) => ({
        ...prev,
        [report.id]: { status: "resolved", note: data.report?.resolution_note || prev[report.id]?.note || "" },
      }));
      onTakedown?.(report.song_id);
      onToast?.("Track disabled and takedown logged.");
      load();
    }
  };

  const reply = (report) => {
    if (!report.reporter_email) return;
    const subject = `Re: your report about “${report.song_title || "a Luumbo track"}”`;
    const body = [
      `Hello ${report.reporter_name || "there"},`,
      "",
      `Thank you for your report (reference ${report.id}). We received it on ${new Date(report.created_at).toLocaleString()}.`,
      "",
      report.status === "resolved"
        ? "We have disabled access to the track while the claim is reviewed."
        : "We are reviewing the track and will follow up once we have an outcome.",
      "",
      "If you believe a removal was a mistake, you may send a counter-notice to our legal contact with your contact details, identification of the removed material, and a statement under penalty of perjury that you have a good-faith belief the material was removed by mistake.",
      "",
      "Luumbo",
    ].join("\n");

    // Opening a mailto draft is not a confirmed send, so reply_sent_at is
    // deliberately not stamped here.
    window.location.href = `mailto:${report.reporter_email}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  };

  const exportTakedowns = () => {
    const rows = takedowns || [];
    const header = ["id", "song_id", "song_title", "actor_email", "reason", "created_at"];
    const csv = [
      header.join(","),
      ...rows.map((row) =>
        header.map((key) => csvEscape(row[key])).join(",")
      ),
    ].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `luumbo-takedown-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const openCount = (reports || []).filter((report) => report.status === "open").length;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm md:p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <ShieldAlert size={14} className="text-accent" />
          <h2 className="text-base font-bold tracking-tight text-neutral-900">
            Copyright &amp; content reports
          </h2>
          {openCount > 0 && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
              {openCount} open
            </span>
          )}
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold text-neutral-400 transition hover:text-neutral-900 disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {error && (
          <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {error}
          </p>
        )}

        {loading && !reports ? (
          <p className="py-6 text-center text-xs text-neutral-400">Loading reports…</p>
        ) : (reports || []).length === 0 ? (
          <p className="py-6 text-center text-xs text-neutral-400">
            No reports yet. Reports submitted from a song row or the player appear here.
          </p>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => {
              const draft = drafts[report.id] || {
                status: report.status,
                note: report.resolution_note || "",
              };
              const busy = busyId === report.id;
              return (
                <article
                  key={report.id}
                  className="rounded-xl border border-neutral-200 bg-neutral-50/40 p-3.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${
                        report.report_type === "copyright"
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-neutral-200 bg-white text-neutral-600"
                      }`}
                    >
                      {report.report_type === "copyright" ? "Copyright" : "Other"}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${
                        STATUS_STYLES[report.status] || STATUS_STYLES.open
                      }`}
                    >
                      {report.status}
                    </span>
                    <span className="text-xs font-medium text-neutral-400">
                      {timeAgo(report.created_at)}
                    </span>
                    {report.song_id && (
                      <Link
                        href={`/share/${report.song_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline"
                      >
                        Open track <ExternalLink size={10} />
                      </Link>
                    )}
                  </div>

                  <p className="mt-2 text-sm font-bold text-neutral-900">
                    {report.song_title || `Song #${report.song_id}`}
                    {report.song_author && (
                      <span className="font-medium text-neutral-500"> · {report.song_author}</span>
                    )}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-neutral-600">
                    {report.reason}
                  </p>

                  {report.report_type === "copyright" && (
                    <dl className="mt-2 grid gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600 sm:grid-cols-2">
                      {report.copyrighted_work && (
                        <div>
                          <dt className="font-bold text-neutral-800">Work</dt>
                          <dd>{report.copyrighted_work}</dd>
                        </div>
                      )}
                      {report.infringing_url && (
                        <div className="min-w-0">
                          <dt className="font-bold text-neutral-800">URL</dt>
                          <dd className="truncate">{report.infringing_url}</dd>
                        </div>
                      )}
                      {report.reporter_address && (
                        <div>
                          <dt className="font-bold text-neutral-800">Address</dt>
                          <dd>{report.reporter_address}</dd>
                        </div>
                      )}
                      {report.reporter_phone && (
                        <div>
                          <dt className="font-bold text-neutral-800">Phone</dt>
                          <dd>{report.reporter_phone}</dd>
                        </div>
                      )}
                      {report.signature && (
                        <div>
                          <dt className="font-bold text-neutral-800">Signed</dt>
                          <dd>{report.signature}</dd>
                        </div>
                      )}
                    </dl>
                  )}

                  <p className="mt-2 text-xs font-medium text-neutral-500">
                    {report.reporter_name || "Anonymous"}
                    {report.reporter_email && (
                      <>
                        {" · "}
                        <a href={`mailto:${report.reporter_email}`} className="text-accent hover:underline">
                          {report.reporter_email}
                        </a>
                      </>
                    )}
                    {report.reply_sent_at && (
                      <span className="ml-1 text-emerald-600">· replied {timeAgo(report.reply_sent_at)}</span>
                    )}
                  </p>

                  <div className="mt-3 grid gap-2 sm:grid-cols-[130px_minmax(0,1fr)]">
                    <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider text-neutral-400">
                      Status
                      <select
                        value={draft.status}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [report.id]: { ...draft, status: event.target.value },
                          }))
                        }
                        className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs font-semibold text-neutral-700 outline-none focus:border-accent"
                      >
                        {["open", "reviewed", "resolved", "dismissed"].map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider text-neutral-400">
                      Resolution note (internal)
                      <textarea
                        value={draft.note}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [report.id]: { ...draft, note: event.target.value },
                          }))
                        }
                        rows={2}
                        maxLength={2000}
                        placeholder="What was decided and why"
                        className="resize-none rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-accent"
                      />
                    </label>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => saveReport(report)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-neutral-700 disabled:opacity-50"
                    >
                      {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      Save
                    </button>
                    {report.reporter_email && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => reply(report)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-bold text-neutral-700 transition hover:border-neutral-300 disabled:opacity-50"
                      >
                        <Mail size={12} /> Reply
                      </button>
                    )}
                    {report.song_status !== "rejected" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => takeDown(report)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        <Gavel size={12} />
                        {confirmId === report.id ? "Confirm takedown" : "Take down"}
                      </button>
                    )}
                    {report.song_status === "rejected" && (
                      <span className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-red-600">
                        Access disabled
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm md:p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Gavel size={14} className="text-accent" />
          <h2 className="text-base font-bold tracking-tight text-neutral-900">Takedown log</h2>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-bold text-neutral-500">
            {takedowns?.length || 0}
          </span>
          <button
            type="button"
            onClick={exportTakedowns}
            disabled={!takedowns?.length}
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold text-neutral-400 transition hover:text-neutral-900 disabled:opacity-50"
          >
            <Download size={12} /> Export CSV
          </button>
        </div>

        {!takedowns || takedowns.length === 0 ? (
          <p className="py-4 text-center text-xs text-neutral-400">
            No takedowns recorded. Deleting a track or actioning a report writes an entry here.
          </p>
        ) : (
          <div className="flex flex-col">
            {takedowns.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-3 border-b border-neutral-50 py-2.5 last:border-0"
              >
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-neutral-800">
                    {entry.song_title || `Song #${entry.song_id}`}
                  </p>
                  <p className="text-xs leading-relaxed text-neutral-500">{entry.reason}</p>
                  <p className="mt-0.5 text-xs text-neutral-400">
                    {entry.actor_email || "System"} · {timeAgo(entry.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
