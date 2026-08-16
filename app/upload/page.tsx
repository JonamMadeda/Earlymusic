"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type UploadUrlResponse = {
  presignedUrl: string;
  publicStorageUrl: string;
};

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("Pastor Marita Mbae");
  const [category, setCategory] = useState("Worship");
  const [duration, setDuration] = useState("Long");
  const [status, setStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || !title.trim()) {
      setStatus("Choose an audio file and enter a track title.");
      return;
    }

    let uploadedStorageUrl: string | null = null;

    setIsUploading(true);
    setStatus("Preparing secure upload…");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Sign in with an administrator account before uploading a track.");

      const signingResponse = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ filename: file.name, contentType: file.type, contentLength: file.size }),
      });
      const signingBody = await signingResponse.json();
      if (!signingResponse.ok) throw new Error(signingBody.error || "Could not prepare the upload.");

      const { presignedUrl, publicStorageUrl } = signingBody as UploadUrlResponse;
      setStatus("Uploading audio to secure storage…");
      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadResponse.ok) throw new Error("Cloudflare R2 rejected the audio upload.");
      uploadedStorageUrl = publicStorageUrl;

      setStatus("Saving track metadata…");
      const { error } = await supabase.from("songs").insert({
        title: title.trim(),
        author: author.trim(),
        category: category,
        duration: duration,
        song_path: publicStorageUrl,
      });
      if (error) throw error;

      localStorage.removeItem("earlymusic_songs_cache");
      setFile(null);
      setTitle("");
      setStatus("Track uploaded successfully.");
    } catch (error) {
      if (uploadedStorageUrl) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session?.access_token) {
            await fetch("/api/admin/storage", {
              method: "DELETE",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${sessionData.session.access_token}`,
              },
              body: JSON.stringify({ publicStorageUrl: uploadedStorageUrl }),
            });
          }
        } catch (cleanupError) {
          console.error("Unable to clean up orphaned upload:", cleanupError);
        }
      }
      setStatus(error instanceof Error ? error.message : "The upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <main className="min-h-[90vh] bg-transparent px-3 pb-36 pt-2 md:px-8 md:pt-6">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center gap-2">
          <div className="h-6 w-1 rounded-full bg-accent" />
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 uppercase">Upload</h1>
        </div>
        <p className="mt-1 text-sm text-neutral-500">Upload audio files directly to Cloudflare R2.</p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-5 rounded-2xl bg-neutral-50/60 p-6">
          <label className="block text-xs font-medium text-neutral-500">
            Track title
            <input value={title} onChange={(event) => setTitle(event.target.value)} required className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-accent" />
          </label>
          <label className="block text-xs font-medium text-neutral-500">
            Artist name
            <input value={author} onChange={(event) => setAuthor(event.target.value)} required className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-accent" />
          </label>
          <div className="flex gap-3">
            <label className="block flex-1 text-xs font-medium text-neutral-500">
              Category
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-accent">
                <option>Worship</option>
                <option>Praise</option>
              </select>
            </label>
            <label className="block flex-1 text-xs font-medium text-neutral-500">
              Duration
              <select value={duration} onChange={(event) => setDuration(event.target.value)} className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-accent">
                <option>Long</option>
                <option>Short</option>
              </select>
            </label>
          </div>
          <label className="block text-xs font-medium text-neutral-500">
            Audio file
            <input type="file" accept="audio/*" required disabled={isUploading} onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full text-sm rounded-xl border border-neutral-200 bg-white px-3 py-2.5 file:mr-2 file:rounded-full file:border-0 file:bg-accent file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white" />
          </label>
          <button type="submit" disabled={isUploading} className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accent/90 disabled:opacity-50">
            {isUploading ? "Uploading…" : "Upload track"}
          </button>
          {status && <p role="status" className="text-sm text-neutral-600">{status}</p>}
        </form>
      </div>
    </main>
  );
}