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
  const [status, setStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || !title.trim()) {
      setStatus("Choose an audio file and enter a track title.");
      return;
    }

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

      setStatus("Saving track metadata…");
      const { error } = await supabase.from("audio_tracks").insert({
        title: title.trim(),
        public_storage_url: publicStorageUrl,
        user_id: sessionData.session.user.id,
      });
      if (error) throw error;

      setFile(null);
      setTitle("");
      setStatus("Track uploaded successfully.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-xl px-6 py-16">
      <h1 className="text-3xl font-bold text-neutral-900">Upload audio</h1>
      <p className="mt-2 text-sm text-neutral-500">Audio uploads go directly to Cloudflare R2.</p>
      <form onSubmit={handleSubmit} className="mt-8 space-y-5 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <label className="block text-sm font-medium text-neutral-700">
          Track title
          <input value={title} onChange={(event) => setTitle(event.target.value)} required className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2" />
        </label>
        <label className="block text-sm font-medium text-neutral-700">
          Audio file
          <input type="file" accept="audio/*" required disabled={isUploading} onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full text-sm" />
        </label>
        <button type="submit" disabled={isUploading} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {isUploading ? "Uploading…" : "Upload track"}
        </button>
        {status && <p role="status" className="text-sm text-neutral-600">{status}</p>}
      </form>
    </main>
  );
}
