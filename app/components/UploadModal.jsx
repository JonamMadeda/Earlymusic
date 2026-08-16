"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { X, UploadCloud, Plus, Trash2 } from "lucide-react";

const cleanupOrphanedUpload = async (accessToken, publicStorageUrl) => {
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

const resetForm = (setters) => {
  setters.setTitle("");
  setters.setAuthor("Pastor Marita Mbae");
  setters.setOriginalSongs([{ title: "", artist: "" }]);
  setters.setSongFile(null);
  setters.setUploadProgress(0);
};

const UploadModal = ({ isOpen, onClose, onSuccess }) => {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("Pastor Marita Mbae");
  const [originalSongs, setOriginalSongs] = useState([{ title: "", artist: "" }]);
  const [category, setCategory] = useState("Worship");
  const [duration, setDuration] = useState("Long");
  const [songFile, setSongFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape" && !isLoading) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, isLoading, onClose]);

  const handleClose = () => {
    if (isLoading) return;
    resetForm({ setTitle, setAuthor, setOriginalSongs, setSongFile, setUploadProgress });
    onClose();
  };

  if (!isOpen) return null;

  const handleAddOriginal = () => {
    setOriginalSongs([...originalSongs, { title: "", artist: "" }]);
  };

  const handleRemoveOriginal = (index) => {
    setOriginalSongs(originalSongs.filter((_, i) => i !== index));
  };

  const handleOriginalChange = (index, field, value) => {
    const updated = [...originalSongs];
    updated[index][field] = value;
    setOriginalSongs(updated);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!songFile || !title || !author) return alert("Please fill all fields");

    let uploadedStorageUrl = null;

    try {
      setIsLoading(true);
      setUploadProgress(0);

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Sign in before uploading a track.");

      const signingResponse = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          filename: songFile.name,
          contentType: songFile.type,
          contentLength: songFile.size,
        }),
      });
      const signingBody = await signingResponse.json();
      if (!signingResponse.ok) throw new Error(signingBody.error || "Could not prepare the upload.");

      const uploadResponse = await fetch(signingBody.presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": songFile.type },
        body: songFile,
      });
      if (!uploadResponse.ok) throw new Error("Cloudflare R2 rejected the audio upload.");
      uploadedStorageUrl = signingBody.publicStorageUrl;

      // DATABASE INSERT
      const { error: dbError } = await supabase.from("songs").insert({
        title: title,
        author: author,
        original_songs: originalSongs.filter(s => s.title || s.artist),
        category: category.trim(),
        duration: duration,
        song_path: signingBody.publicStorageUrl,
      });

      if (dbError) throw dbError;

      // Clear cache so other pages see the new song
      localStorage.removeItem("earlymusic_songs_cache");
      setUploadProgress(100);
      onSuccess();
      onClose();
      resetForm({ setTitle, setAuthor, setOriginalSongs, setSongFile, setUploadProgress });
    } catch (error) {
      console.error("Upload failed:", error);
      if (uploadedStorageUrl) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.access_token) {
          await cleanupOrphanedUpload(sessionData.session.access_token, uploadedStorageUrl);
        }
      }
      alert(error.message || "Error uploading song.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-8 relative shadow-2xl border border-neutral-100 animate-fade-in">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-900 transition"
        >
          <X size={24} />
        </button>

        <h2 className="text-2xl font-semibold mb-1 text-neutral-900 tracking-tight">
          Upload Track
        </h2>
        <p className="text-neutral-500 mb-6 text-sm">
          Add a new song to your library.
        </p>

        <form onSubmit={handleUpload} className="flex flex-col gap-y-5">
          <div className="flex flex-col gap-y-1">
            <label className="text-xs font-medium text-neutral-500 ml-1">
              Track Title
            </label>
            <input
              type="text"
              placeholder="e.g., Ujazaye"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-red-600/10 focus:border-red-600 focus:bg-white text-neutral-900 transition"
              required
            />
          </div>

          <div className="flex flex-col gap-y-1">
            <label className="text-xs font-medium text-neutral-500 ml-1">
              Artist Name
            </label>
            <input
              type="text"
              placeholder="e.g., Pastor Marita Mbae"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-red-600/10 focus:border-red-600 focus:bg-white text-neutral-900 transition"
              required
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                Original Songs (Compilation)
              </label>
              <button
                type="button"
                onClick={handleAddOriginal}
                className="text-red-600 hover:text-neutral-900 transition flex items-center gap-1 text-[11px] font-bold"
              >
                <Plus size={14} /> Add Song
              </button>
            </div>

            <div className="max-h-[200px] overflow-y-auto pr-2 flex flex-col gap-y-3 custom-scrollbar">
              {originalSongs.map((s, index) => (
                <div key={index} className="flex flex-col gap-y-2 p-3 bg-neutral-50 rounded-xl border border-neutral-100 relative group/item">
                  <div className="grid grid-cols-2 gap-x-3">
                    <div className="flex flex-col gap-y-1">
                      <input
                        type="text"
                        placeholder="Original Title"
                        value={s.title}
                        onChange={(e) => handleOriginalChange(index, "title", e.target.value)}
                        className="p-2 bg-white border border-neutral-200 rounded-lg outline-none focus:border-red-600 text-[13px] transition"
                      />
                    </div>
                    <div className="flex flex-col gap-y-1">
                      <input
                        type="text"
                        placeholder="Original Artist"
                        value={s.artist}
                        onChange={(e) => handleOriginalChange(index, "artist", e.target.value)}
                        className="p-2 bg-white border border-neutral-200 rounded-lg outline-none focus:border-red-600 text-[13px] transition"
                      />
                    </div>
                  </div>
                  {originalSongs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOriginal(index)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-neutral-200 rounded-full flex items-center justify-center text-neutral-400 hover:text-red-600 hover:border-red-200 shadow-sm transition opacity-0 group-hover/item:opacity-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-y-1">
            <label className="text-xs font-medium text-neutral-500 ml-1">
              Category
            </label>
            <div className="flex items-center gap-x-2 p-1 bg-neutral-50 border border-neutral-200 rounded-xl">
              {["Worship", "Praise"].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={`
                    flex-1 py-2 rounded-lg text-sm font-semibold transition-all
                    ${category === item
                      ? "bg-white text-red-600 shadow-sm border border-neutral-100"
                      : "text-neutral-400 hover:text-neutral-600"
                    }
                  `}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-y-1">
            <label className="text-xs font-medium text-neutral-500 ml-1">
              Duration
            </label>
            <div className="flex items-center gap-x-2 p-1 bg-neutral-50 border border-neutral-200 rounded-xl">
              {["Long", "Short"].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setDuration(item)}
                  className={`
                    flex-1 py-2 rounded-lg text-sm font-semibold transition-all
                    ${duration === item
                      ? "bg-white text-red-600 shadow-sm border border-neutral-100"
                      : "text-neutral-400 hover:text-neutral-600"
                    }
                  `}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 border-2 border-dashed border-neutral-200 rounded-xl bg-neutral-50 hover:border-red-300 transition cursor-pointer relative group">
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => {
                const file = e.target.files[0];
                setSongFile(file);
                if (file) {
                  const fileNameWithoutExt = file.name.split('.').slice(0, -1).join('.');
                  setTitle(fileNameWithoutExt);
                }
              }}
              className="absolute inset-0 opacity-0 cursor-pointer z-10"
              required={!isLoading}
              disabled={isLoading}
            />
            <div className="text-center flex flex-col items-center">
              <UploadCloud
                className={`mb-2 ${songFile
                  ? "text-red-600"
                  : "text-neutral-300 group-hover:text-red-400"
                  } transition-colors`}
                size={32}
              />
              <p className="text-sm text-neutral-600 truncate max-w-full px-2">
                {songFile ? songFile.name : "Select MP3 File"}
              </p>
            </div>
          </div>

          {/* PROGRESS BAR SECTION */}
          {isLoading && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex justify-between items-center text-xs font-medium text-red-600">
                <span>
                  {uploadProgress === 100
                    ? "Finalizing..."
                    : "Uploading track..."}
                </span>
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <span className="tabular-nums">{uploadProgress}%</span>
                )}
              </div>
              <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-red-600 transition-all duration-300 ease-out ${
                    uploadProgress === 0 ? "w-1/3 animate-pulse" : ""
                  }`}
                  style={uploadProgress === 0 ? {} : { width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="bg-red-600 py-3.5 rounded-xl text-white font-bold hover:bg-neutral-900 transition-all shadow-lg shadow-red-100 disabled:opacity-50 disabled:cursor-not-allowed mt-2 text-sm uppercase tracking-tight"
          >
            {isLoading ? `Publishing...` : "Publish Track"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default UploadModal;
