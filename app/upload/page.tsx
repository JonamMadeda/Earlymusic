"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import {
  ArrowLeft,
  UploadCloud,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Music,
} from "lucide-react";

type OriginalSong = { title: string; artist: string };

type UploadUrlResponse = {
  presignedUrl: string;
  publicStorageUrl: string;
};

type QueueItem = {
  key: string;
  file: File;
  title: string;
  phase: "queued" | "working" | "done" | "error";
  note: string;
};

const cleanupOrphanedUpload = async (accessToken: string, publicStorageUrl: string) => {
  try {
    await fetch("/api/admin/storage", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ publicStorageUrl }),
    });
  } catch (error) {
    console.error("Unable to clean up orphaned upload:", error);
  }
};

const titleFromFilename = (name: string) =>
  name.split(".").slice(0, -1).join(".") || name;

export default function UploadPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAdmin, roleLoading } = useAuth();

  const [author, setAuthor] = useState("Pastor Marita Mbae");
  const [originalSongs, setOriginalSongs] = useState<OriginalSong[]>([{ title: "", artist: "" }]);
  const [category, setCategory] = useState("Worship");
  const [duration, setDuration] = useState("Long");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [publishTotal, setPublishTotal] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  if (authLoading || roleLoading) {
    return (
      <main className="flex min-h-[90vh] items-center justify-center bg-neutral-50/60">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (!user || !isAdmin) {
    return (
      <main className="flex min-h-[90vh] items-center justify-center bg-neutral-50/60 px-6">
        <section className="max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <ShieldCheck className="mx-auto mb-4 text-neutral-400" size={32} />
          <h1 className="text-xl font-bold text-neutral-900">Administrator access required</h1>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500">Sign in with an account assigned the administrator role to upload tracks.</p>
          <button onClick={() => router.push(user ? "/admin" : "/auth?redirectTo=/upload")} className="mt-6 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accent/90">
            {user ? "Return to Vault" : "Sign in"}
          </button>
        </section>
      </main>
    );
  }

  const patchItem = (key: string, patch: Partial<QueueItem>) =>
    setQueue((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const handleFilesSelect = (files: FileList | null) => {
    if (!files || isPublishing) return;
    setSummary(null);
    setFormError(null);
    setQueue((prev) => {
      const existing = new Set(prev.map((item) => item.key));
      const additions: QueueItem[] = [];
      for (const file of Array.from(files)) {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (existing.has(key)) continue;
        existing.add(key);
        additions.push({
          key,
          file,
          title: titleFromFilename(file.name),
          phase: "queued",
          note: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        });
      }
      return [...prev, ...additions];
    });
  };

  const handleAddOriginal = () => {
    setOriginalSongs([...originalSongs, { title: "", artist: "" }]);
  };

  const handleRemoveOriginal = (index: number) => {
    setOriginalSongs(originalSongs.filter((_, i) => i !== index));
  };

  const handleOriginalChange = (index: number, field: keyof OriginalSong, value: string) => {
    const updated = [...originalSongs];
    updated[index][field] = value;
    setOriginalSongs(updated);
  };

  const publishOne = async (
    item: QueueItem,
    accessToken: string,
    shared: { author: string; originals: OriginalSong[]; category: string; duration: string }
  ) => {
    let uploadedStorageUrl: string | null = null;
    try {
      patchItem(item.key, { phase: "working", note: "Preparing secure upload…" });
      const signingResponse = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          filename: item.file.name,
          contentType: item.file.type,
          contentLength: item.file.size,
        }),
      });
      const signingBody = await signingResponse.json();
      if (!signingResponse.ok) throw new Error(signingBody.error || "Could not prepare the upload.");

      const { presignedUrl, publicStorageUrl } = signingBody as UploadUrlResponse;
      patchItem(item.key, { note: "Uploading audio…" });
      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": item.file.type },
        body: item.file,
      });
      if (!uploadResponse.ok) throw new Error("Cloudflare R2 rejected the audio upload.");
      uploadedStorageUrl = publicStorageUrl;

      patchItem(item.key, { note: "Saving metadata…" });
      const { error } = await supabase.from("songs").insert({
        title: item.title.trim(),
        author: shared.author,
        original_songs: shared.originals,
        category: shared.category,
        duration: shared.duration,
        song_path: publicStorageUrl,
      });
      if (error) throw error;

      patchItem(item.key, { phase: "done", note: "Live" });
      return true;
    } catch (error) {
      if (uploadedStorageUrl) {
        await cleanupOrphanedUpload(accessToken, uploadedStorageUrl);
      }
      patchItem(item.key, {
        phase: "error",
        note: error instanceof Error ? error.message : "Upload failed.",
      });
      return false;
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const pending = queue.filter((item) => item.phase !== "done");
    if (pending.length === 0) {
      setFormError("Add at least one audio file to publish.");
      return;
    }
    if (!author.trim()) {
      setFormError("An artist name is required.");
      return;
    }
    const untitled = pending.find((item) => !item.title.trim());
    if (untitled) {
      setFormError(`Give “${untitled.file.name}” a track title first.`);
      return;
    }

    setIsPublishing(true);
    setFormError(null);
    setSummary(null);
    setDoneCount(0);
    setPublishTotal(pending.length);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Sign in again before uploading tracks.");

      const shared = {
        author: author.trim(),
        originals: originalSongs.filter((s) => s.title || s.artist),
        category: category.trim(),
        duration,
      };

      let succeeded = 0;
      for (const item of pending) {
        const ok = await publishOne(item, accessToken, shared);
        if (ok) succeeded += 1;
        setDoneCount((n) => n + 1);
      }

      localStorage.removeItem("lumbo_songs_cache");
      const failed = pending.length - succeeded;
      setSummary(
        failed === 0
          ? `Published ${succeeded} track${succeeded === 1 ? "" : "s"}.`
          : `Published ${succeeded} of ${pending.length} — ${failed} failed. Fix the titles or retry them.`
      );
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Publishing failed. Please try again.");
    } finally {
      setIsPublishing(false);
    }
  };

  const resetAll = () => {
    setQueue([]);
    setAuthor("Pastor Marita Mbae");
    setOriginalSongs([{ title: "", artist: "" }]);
    setDoneCount(0);
    setPublishTotal(0);
    setFormError(null);
    setSummary(null);
  };

  const pendingCount = queue.filter((item) => item.phase !== "done").length;

  return (
    <main className="min-h-[90vh] bg-neutral-50/60 px-3 pb-36 pt-2 md:px-8 md:pt-6">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6 flex items-start gap-3">
          <Link
            href="/admin"
            aria-label="Back to Vault"
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 shadow-sm transition hover:text-neutral-900"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 md:text-2xl">Upload Tracks</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Queue one file or a whole batch — artist, category, and compilation details apply to every track.
            </p>
          </div>
        </div>

        {/* Summary banner */}
        {summary && !isPublishing && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 shadow-sm">
            <CheckCircle2 size={20} className="shrink-0 text-green-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-green-900">{summary}</p>
              <p className="text-xs text-green-700">Queue more files below, or head back to the Vault.</p>
            </div>
            <Link
              href="/admin"
              className="shrink-0 rounded-full bg-neutral-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-neutral-700"
            >
              View Vault
            </Link>
          </div>
        )}

        {/* Form card */}
        <form onSubmit={handleSubmit} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm md:p-8">
          {/* Queue */}
          {queue.length > 0 && (
            <div className="mb-5 flex flex-col gap-y-2">
              <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Queue ({queue.length})
              </p>
              <div className="flex max-h-[280px] flex-col gap-y-2 overflow-y-auto pr-1 custom-scrollbar">
                {queue.map((item) => (
                  <div
                    key={item.key}
                    className={`flex items-center gap-3 rounded-xl border p-3 ${
                      item.phase === "done"
                        ? "border-green-200 bg-green-50/60"
                        : item.phase === "error"
                          ? "border-red-200 bg-red-50/60"
                          : "border-neutral-100 bg-neutral-50"
                    }`}
                  >
                    <Music size={16} className={`shrink-0 ${item.phase === "done" ? "text-green-600" : item.phase === "error" ? "text-red-500" : "text-neutral-300"}`} />
                    <div className="min-w-0 flex-1">
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => patchItem(item.key, { title: e.target.value })}
                        disabled={isPublishing || item.phase === "done"}
                        aria-label={`Title for ${item.file.name}`}
                        className="w-full truncate rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-sm font-bold text-neutral-900 outline-none transition focus:border-accent focus:bg-white disabled:opacity-70"
                      />
                      <p className={`truncate text-xs ${item.phase === "error" ? "font-semibold text-red-600" : item.phase === "done" ? "font-semibold text-green-700" : "text-neutral-400"}`}>
                        {item.phase === "working" ? `${item.note}…` : item.note}
                      </p>
                    </div>
                    {item.phase === "done" ? (
                      <CheckCircle2 size={16} className="shrink-0 text-green-600" />
                    ) : item.phase === "error" ? (
                      <XCircle size={16} className="shrink-0 text-red-500" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setQueue((prev) => prev.filter((q) => q.key !== item.key))}
                        disabled={isPublishing}
                        aria-label={`Remove ${item.file.name}`}
                        className="shrink-0 rounded-full p-1.5 text-neutral-400 transition hover:bg-white hover:text-red-600 disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-y-1.5">
            <label htmlFor="upload-author" className="text-xs font-semibold text-neutral-500">
              Artist Name (applies to all)
            </label>
            <input
              id="upload-author"
              type="text"
              placeholder="e.g., Pastor Marita Mbae"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              disabled={isPublishing}
              required
              className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm font-medium text-neutral-900 outline-none transition placeholder:text-neutral-300 focus:border-accent focus:bg-white disabled:opacity-60"
            />
          </div>

          {/* Category + Duration */}
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-y-1.5">
              <span className="text-xs font-semibold text-neutral-500">Category</span>
              <div className="flex items-center gap-x-2 rounded-xl border border-neutral-200 bg-neutral-50 p-1">
                {["Worship", "Praise"].map((item) => (
                  <button
                    key={item}
                    type="button"
                    disabled={isPublishing}
                    onClick={() => setCategory(item)}
                    className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all disabled:opacity-60 ${
                      category === item
                        ? "border border-neutral-100 bg-white text-accent shadow-sm"
                        : "text-neutral-400 hover:text-neutral-600"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-y-1.5">
              <span className="text-xs font-semibold text-neutral-500">Duration</span>
              <div className="flex items-center gap-x-2 rounded-xl border border-neutral-200 bg-neutral-50 p-1">
                {["Long", "Short"].map((item) => (
                  <button
                    key={item}
                    type="button"
                    disabled={isPublishing}
                    onClick={() => setDuration(item)}
                    className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all disabled:opacity-60 ${
                      duration === item
                        ? "border border-neutral-100 bg-white text-accent shadow-sm"
                        : "text-neutral-400 hover:text-neutral-600"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Original songs */}
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Original Songs (Compilation)
              </span>
              <button
                type="button"
                onClick={handleAddOriginal}
                disabled={isPublishing}
                className="flex items-center gap-1 text-[11px] font-bold text-accent transition hover:text-neutral-900 disabled:opacity-60"
              >
                <Plus size={14} /> Add Song
              </button>
            </div>
            <div className="flex max-h-[240px] flex-col gap-y-3 overflow-y-auto pr-1 custom-scrollbar">
              {originalSongs.map((s, index) => (
                <div key={index} className="group/item relative flex flex-col gap-y-2 rounded-xl border border-neutral-100 bg-neutral-50 p-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      placeholder="Original Title"
                      value={s.title}
                      onChange={(e) => handleOriginalChange(index, "title", e.target.value)}
                      disabled={isPublishing}
                      className="rounded-lg border border-neutral-200 bg-white p-2.5 text-[13px] outline-none transition focus:border-accent disabled:opacity-60"
                    />
                    <input
                      type="text"
                      placeholder="Original Artist"
                      value={s.artist}
                      onChange={(e) => handleOriginalChange(index, "artist", e.target.value)}
                      disabled={isPublishing}
                      className="rounded-lg border border-neutral-200 bg-white p-2.5 text-[13px] outline-none transition focus:border-accent disabled:opacity-60"
                    />
                  </div>
                  {originalSongs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOriginal(index)}
                      disabled={isPublishing}
                      aria-label="Remove original song"
                      className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-400 shadow-sm transition hover:border-red-200 hover:text-red-600 md:opacity-0 md:group-hover/item:opacity-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Dropzone */}
          <div className="relative mt-6 cursor-pointer rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50 p-8 text-center transition hover:border-accent/30 md:p-10">
            <input
              type="file"
              accept="audio/*"
              multiple
              onChange={(e) => {
                handleFilesSelect(e.target.files);
                e.target.value = "";
              }}
              disabled={isPublishing}
              className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
            />
            <UploadCloud size={32} className="mx-auto mb-2 text-neutral-300" />
            <p className="text-sm font-bold text-neutral-700">Drop MP3s here, or tap to browse</p>
            <p className="mt-1 text-xs text-neutral-400">Select multiple files at once · MP3, M4A, WAV, OGG, FLAC up to 100 MB each</p>
          </div>

          {/* Progress + status */}
          {isPublishing && (
            <div className="mt-5 space-y-2">
              <p className="text-xs font-semibold text-accent">
                Publishing {doneCount} of {publishTotal}…
              </p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full bg-accent transition-all duration-300 ease-out"
                  style={{ width: `${publishTotal > 0 ? (doneCount / publishTotal) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
          {formError && !isPublishing && (
            <p role="alert" className="mt-4 text-sm font-medium text-red-600">
              {formError}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              disabled={isPublishing || pendingCount === 0}
              className="flex-1 rounded-xl bg-accent py-3.5 text-sm font-bold uppercase tracking-tight text-white shadow-sm transition-all hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPublishing
                ? `Publishing… (${doneCount}/${publishTotal})`
                : pendingCount > 0
                  ? `Publish ${pendingCount} track${pendingCount === 1 ? "" : "s"}`
                  : "Publish Tracks"}
            </button>
            {queue.length > 0 && !isPublishing && (
              <button
                type="button"
                onClick={resetAll}
                className="rounded-xl border border-neutral-200 bg-white px-5 py-3.5 text-sm font-bold text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-900"
              >
                Start over
              </button>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}
