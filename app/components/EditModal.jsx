"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { X, Plus, Trash2 } from "lucide-react";

const EditModal = ({ isOpen, onClose, onSuccess, song }) => {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [originalSongs, setOriginalSongs] = useState([{ title: "", artist: "" }]);
  const [category, setCategory] = useState("Worship");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (song && isOpen) {
      setTitle(song.title || "");
      setAuthor(song.author || "");
      setOriginalSongs(song.original_songs && song.original_songs.length > 0 ? song.original_songs : [{ title: "", artist: "" }]);
      const normalizedCat = (song.category || "Worship").trim();
      setCategory(normalizedCat.charAt(0).toUpperCase() + normalizedCat.slice(1).toLowerCase());
    }
  }, [song, isOpen]);

  if (!isOpen || !song) return null;

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

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!title || !author) return alert("Please fill all required fields");

    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from("songs")
        .update({
          title: title,
          author: author,
          original_songs: originalSongs.filter(s => s.title || s.artist),
          category: category.trim(),
        })
        .eq("id", song.id)
        .select();

      if (error) throw error;

      // Clear cache so other pages see the update
      localStorage.removeItem("earlymusic_songs_cache");
      onSuccess(data[0]); // pass the updated song back if needed
      onClose();
    } catch (error) {
      console.error("Update failed:", error);
      alert(error.message || "Error updating song.");
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
          Edit Track
        </h2>
        <p className="text-neutral-500 mb-6 text-sm">
          Update the metadata for this song.
        </p>

        <form onSubmit={handleUpdate} className="flex flex-col gap-y-5">
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

          <button
            type="submit"
            disabled={isLoading}
            className="bg-red-600 py-3.5 rounded-xl text-white font-bold hover:bg-neutral-900 transition-all shadow-lg shadow-red-100 disabled:opacity-50 disabled:cursor-not-allowed mt-4 text-sm uppercase tracking-tight"
          >
            {isLoading ? `Saving...` : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditModal;
