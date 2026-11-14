"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Flag, Loader2, ShieldAlert, X } from "lucide-react";

/**
 * Shared "Report this song" dialog used by song rows and the player menu.
 *
 * Copyright reports collect the elements of a statutory notice
 * (17 U.S.C. 512(c)(3)): the work, the infringing URL, contact details, a
 * signature, and the good-faith / accuracy / authority statements. Other
 * reports stay short. The API re-validates everything server-side.
 */
export default function ReportSongDialog({ open, onClose, song, onSubmitted }) {
  const [type, setType] = useState("copyright");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const dialogRef = useRef(null);
  const closeTimer = useRef(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    onCloseRef.current = onClose;
    busyRef.current = busy;
  });

  // Reset only when the dialog opens. Depending on `busy` here used to clear
  // the submitting flag mid-request, and an inline `onClose` re-ran the reset
  // on every parent render.
  useEffect(() => {
    if (!open) return;
    setType("copyright");
    setError("");
    setSubmitted(false);
    setBusy(false);
    const onKey = (event) => {
      if (event.key === "Escape" && !busyRef.current) onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    const focusTimer = setTimeout(() => {
      dialogRef.current?.querySelector("input, textarea, button")?.focus();
    }, 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(focusTimer);
      clearTimeout(closeTimer.current);
    };
  }, [open]);

  if (!open || !song || !mounted) return null;

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/share/${song.id}`
      : `/share/${song.id}`;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    const form = new FormData(event.currentTarget);
    const value = (name) => String(form.get(name) || "").trim();

    const payload = {
      song_id: song.id,
      report_type: type,
      reason: value("reason"),
      reporter_name: value("reporter_name") || null,
      reporter_email: value("reporter_email") || null,
    };

    if (type === "copyright") {
      Object.assign(payload, {
        copyrighted_work: value("copyrighted_work"),
        infringing_url: value("infringing_url") || shareUrl,
        reporter_address: value("reporter_address"),
        reporter_phone: value("reporter_phone") || null,
        signature: value("signature"),
        good_faith: form.get("good_faith") === "on",
        accuracy_penalty: form.get("accuracy_penalty") === "on",
        authorized_agent: form.get("authorized_agent") === "on",
      });
      if (!payload.copyrighted_work || !payload.reporter_name || !payload.reporter_email || !payload.reporter_address || !payload.signature) {
        setError("Fill in the work, your name, email, address, and signature.");
        return;
      }
      if (!payload.good_faith || !payload.accuracy_penalty || !payload.authorized_agent) {
        setError("Confirm all three statements before submitting a copyright notice.");
        return;
      }
    } else if (!payload.reason) {
      setError("Please describe the issue.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/dmca/report", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to submit the report.");
      setSubmitted(true);
      onSubmitted?.("Report submitted. Thank you.");
      closeTimer.current = setTimeout(() => onClose(), 2200);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit the report.");
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none transition placeholder:text-neutral-300 focus:border-accent focus:bg-white";
  const labelClass = "text-xs font-semibold text-neutral-500";

  return createPortal(
    <div
      className="fixed inset-0 z-[1200] flex items-end justify-center bg-neutral-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-song-title"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-neutral-200 bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="report-song-title" className="flex items-center gap-2 text-base font-bold tracking-tight text-neutral-900">
              <Flag size={16} className="text-red-500" />
              Report this song
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">
              {song.title}
              {song.author ? ` · ${song.author}` : ""}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close report form"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center">
            <ShieldAlert size={26} className="mx-auto mb-2 text-emerald-600" />
            <p className="text-sm font-bold text-emerald-900">Report received</p>
            <p className="mt-1 text-xs leading-relaxed text-emerald-700">
              We review every notice. If you left an email address, we will reply
              there.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
            <div role="group" aria-label="Report type" className="grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1">
              {[
                { key: "copyright", label: "Copyright" },
                { key: "other", label: "Other issue" },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={type === option.key}
                  onClick={() => {
                    setType(option.key);
                    setError("");
                  }}
                  className={`rounded-lg py-2 text-xs font-bold transition ${
                    type === option.key
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {type === "copyright" ? (
              <>
                <p className="text-xs leading-relaxed text-neutral-500">
                  A copyright notice needs the work, the link, your contact
                  details, a signature, and the statements below.{" "}
                  <Link
                    href="/terms#copyright"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-accent hover:underline"
                  >
                    What a notice needs
                  </Link>
                  .
                </p>

                <div className="flex flex-col gap-1">
                  <label htmlFor="report-work" className={labelClass}>
                    Copyrighted work
                  </label>
                  <input
                    id="report-work"
                    name="copyrighted_work"
                    required
                    maxLength={300}
                    placeholder="Song title, recording, or other work"
                    className={inputClass}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="report-url" className={labelClass}>
                    Link to the infringing content
                  </label>
                  <input
                    id="report-url"
                    name="infringing_url"
                    type="url"
                    defaultValue={shareUrl}
                    maxLength={500}
                    className={inputClass}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="report-reason" className={labelClass}>
                    Describe the infringement
                  </label>
                  <textarea
                    id="report-reason"
                    name="reason"
                    required
                    rows={3}
                    maxLength={1000}
                    placeholder="Explain how this track uses your work without permission."
                    className={`${inputClass} resize-none`}
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="report-name" className={labelClass}>
                      Full legal name
                    </label>
                    <input id="report-name" name="reporter_name" required maxLength={120} className={inputClass} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="report-email" className={labelClass}>
                      Email
                    </label>
                    <input id="report-email" name="reporter_email" type="email" required maxLength={254} className={inputClass} />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="report-address" className={labelClass}>
                    Postal address
                  </label>
                  <input id="report-address" name="reporter_address" required maxLength={300} className={inputClass} />
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="report-phone" className={labelClass}>
                      Phone (optional)
                    </label>
                    <input id="report-phone" name="reporter_phone" type="tel" maxLength={40} className={inputClass} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="report-signature" className={labelClass}>
                      Electronic signature
                    </label>
                    <input
                      id="report-signature"
                      name="signature"
                      required
                      maxLength={120}
                      placeholder="Type your full name"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                  {[
                    {
                      name: "good_faith",
                      label:
                        "I have a good-faith belief that the use is not authorised by the rights holder, its agent, or the law.",
                    },
                    {
                      name: "accuracy_penalty",
                      label:
                        "I declare, under penalty of perjury, that this notice is accurate and I am the rights holder or authorised to act for them.",
                    },
                    {
                      name: "authorized_agent",
                      label:
                        "I understand that a copy of this notice may be sent to the person who uploaded the track.",
                    },
                  ].map((statement) => (
                    <label key={statement.name} className="flex items-start gap-2 text-xs leading-relaxed text-neutral-600">
                      <input
                        type="checkbox"
                        name={statement.name}
                        required
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-300 text-accent focus:ring-accent"
                      />
                      <span>{statement.label}</span>
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <label htmlFor="report-other-reason" className={labelClass}>
                    What is the issue?
                  </label>
                  <textarea
                    id="report-other-reason"
                    name="reason"
                    required
                    rows={4}
                    maxLength={1000}
                    placeholder="Offensive content, incorrect attribution, broken audio…"
                    className={`${inputClass} resize-none`}
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="report-other-name" className={labelClass}>
                      Your name (optional)
                    </label>
                    <input id="report-other-name" name="reporter_name" maxLength={120} className={inputClass} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="report-other-email" className={labelClass}>
                      Email (for a reply)
                    </label>
                    <input id="report-other-email" name="reporter_email" type="email" maxLength={254} className={inputClass} />
                  </div>
                </div>
              </>
            )}

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-accent/90 disabled:opacity-50"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              {type === "copyright" ? "Submit copyright notice" : "Submit report"}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
