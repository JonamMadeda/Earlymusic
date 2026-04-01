"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { X, UploadCloud, Plus, Trash2 } from "lucide-react";

const UploadModal = ({ isOpen, onClose, onSuccess }) => {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("Pastor Marita Mbae");
  const [originalSongs, setOriginalSongs] = useState([{ title: "", artist: "" }]);
  const [category, setCategory] = useState("Worship");
  const [songFile, setSongFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

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

    try {
      setIsLoading(true);
      setUploadProgress(0);

      const fileExt = songFile.name.split(".").pop();
      // Using a timestamp for better uniqueness
      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;

      // UPLOAD WITH PROGRESS HANDLING
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("songs")
        .upload(filePath, songFile, {
          cacheControl: "3600",
          upsert: false,
          // Use the native progress event
          onUploadProgress: (progressEvent) => {
            const percent = (progressEvent.loaded / progressEvent.total) * 100;
            // Use Math.floor to avoid jittery 100% before completion
            setUploadProgress(Math.floor(percent));
          },
        });

      if (uploadError) throw uploadError;

      // DATABASE INSERT
      const { error: dbError } = await supabase.from("songs").insert({
        title: title,
        author: author,
        original_songs: originalSongs.filter(s => s.title || s.artist),
        category: category.trim(),
        song_path: filePath,
      });

      if (dbError) throw dbError;

      // Clear cache so other pages see the new song
      localStorage.removeItem("earlymusic_songs_cache");
      onSuccess();
      onClose();
      // Reset form
      setTitle("");
      setAuthor("Pastor Marita Mbae");
      setOriginalSongs([{ title: "", artist: "" }]);
      setSongFile(null);
      setUploadProgress(0);
    } catch (error) {
      console.error("Upload failed:", error);
      alert(error.message || "Error uploading song.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-8 relative shadow-2xl border border-neutral-100 animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
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

          <div className="p-6 border-2 border-dashed border-neutral-200 rounded-xl bg-neutral-50 hover:border-red-300 transition cursor-pointer relative group">
            <input
              type="file"
              accept="audio/mpeg, audio/mp3"
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
            <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
              <div className="flex justify-between items-center text-xs font-medium text-red-600">
                <span>
                  {uploadProgress === 100
                    ? "Finalizing..."
                    : "Uploading track..."}
                </span>
                <span className="tabular-nums">{uploadProgress}%</span>
              </div>
              <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-600 transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="bg-red-600 py-3.5 rounded-xl text-white font-medium hover:bg-neutral-900 transition-all shadow-lg shadow-red-100 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {isLoading ? `Publishing...` : "Publish Track"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default UploadModal;
