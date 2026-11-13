"use client";

import { useState, useEffect } from "react";

import { X, Plus, Trash2, ShieldCheck } from "lucide-react";

const EditModal = ({ isOpen, onClose, onSuccess, song }) => {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [originalSongs, setOriginalSongs] = useState([{ title: "", artist: "" }]);
  const [category, setCategory] = useState("Worship");
  const [duration, setDuration] = useState("Long");
  const [copyrightHolder, setCopyrightHolder] = useState("");
  const [licenseType, setLicenseType] = useState("");
  const [licenseUrl, setLicenseUrl] = useState("");
  const [rightsClearanceDate, setRightsClearanceDate] = useState("");
  const [status, setStatus] = useState("approved");
  const [regionRestricted, setRegionRestricted] = useState(false);
  const [allowedCountries, setAllowedCountries] = useState("");
  const [downloadAllowed, setDownloadAllowed] = useState(true);
  const [rightsAttested, setRightsAttested] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape" && !isLoading) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, isLoading, onClose]);

  useEffect(() => {
    if (song && isOpen) {
      setTitle(song.title || "");
      setAuthor(song.author || "");
      // Copy the entries: the song object is shared player/admin state, and
      // editing a draft must not rewrite the row behind the modal.
      setOriginalSongs(
        song.original_songs && song.original_songs.length > 0
          ? song.original_songs.map((entry) => ({ ...entry }))
          : [{ title: "", artist: "" }]
      );
      const normalizedCat = (song.category || "Worship").trim();
      setCategory(normalizedCat.charAt(0).toUpperCase() + normalizedCat.slice(1).toLowerCase());
      setDuration(song.duration || "Long");
      setCopyrightHolder(song.copyright_holder || "");
      setLicenseType(song.license_type || "");
      setLicenseUrl(song.license_url || "");
      setRightsClearanceDate(
        song.rights_clearance_date
          ? String(song.rights_clearance_date).slice(0, 10)
          : ""
      );
      setStatus(song.status || "pending");
      setRegionRestricted(Boolean(song.region_restricted));
      setAllowedCountries(
        Array.isArray(song.allowed_countries)
          ? song.allowed_countries.join(", ")
          : ""
      );
      setDownloadAllowed(song.download_allowed !== false);
      setRightsAttested(false);
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
    setOriginalSongs(
      originalSongs.map((entry, i) =>
        i === index ? { ...entry, [field]: value } : entry
      )
    );
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!title || !author) return alert("Please fill all required fields");

    const hasRightsMetadata =
      copyrightHolder.trim() ||
      licenseType.trim() ||
      licenseUrl.trim() ||
      rightsClearanceDate;
    if (status === "approved" && !hasRightsMetadata && !rightsAttested) {
      alert(
        "Add the rights holder, licence, or clearance date before approving this track, or confirm the self-owned / public-domain attestation."
      );
      return;
    }
    if (regionRestricted && !allowedCountries.trim()) {
      alert("Add at least one country code (for example US, GB) or turn off region restriction.");
      return;
    }

    try {
      setIsLoading(true);

      const res = await fetch(`/api/admin/songs/${song.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title,
          author: author,
          original_songs: originalSongs.filter(s => s.title || s.artist),
          category: category.trim(),
          duration: duration,
          copyright_holder: copyrightHolder.trim() || null,
          license_type: licenseType.trim() || null,
          license_url: licenseUrl.trim() || null,
          rights_clearance_date: rightsClearanceDate || null,
          status,
          region_restricted: regionRestricted,
          allowed_countries: allowedCountries,
          download_allowed: downloadAllowed,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || "Update failed");
      }
      const data = await res.json();

      if (data?.song) onSuccess(data.song);
      else if (data) onSuccess(data);
      onClose();
    } catch (error) {
      console.error("Update failed:", error);
      alert(error.message || "Error updating song.");
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    "p-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-accent/10 focus:border-accent focus:bg-white text-neutral-900 transition";
  const smallInputClass =
    "p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-accent focus:bg-white text-[13px] text-neutral-900 transition";

  return (
    <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-8 relative shadow-2xl border border-neutral-100 animate-fade-in max-h-[90vh] overflow-y-auto custom-scrollbar">
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
              className={inputClass}
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
              className={inputClass}
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
                className="text-accent hover:text-neutral-900 transition flex items-center gap-1 text-xs font-bold"
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
                        className="p-2 bg-white border border-neutral-200 rounded-lg outline-none focus:border-accent text-[13px] transition"
                      />
                    </div>
                    <div className="flex flex-col gap-y-1">
                      <input
                        type="text"
                        placeholder="Original Artist"
                        value={s.artist}
                        onChange={(e) => handleOriginalChange(index, "artist", e.target.value)}
                        className="p-2 bg-white border border-neutral-200 rounded-lg outline-none focus:border-accent text-[13px] transition"
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
                      ? "bg-white text-accent shadow-sm border border-neutral-100"
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
                      ? "bg-white text-accent shadow-sm border border-neutral-100"
                      : "text-neutral-400 hover:text-neutral-600"
                    }
                  `}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {/* Rights & availability */}
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck size={14} className="text-accent" />
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Rights &amp; availability
              </p>
            </div>

            <div className="flex flex-col gap-y-3">
              <div className="flex flex-col gap-y-1">
                <label className="text-xs font-medium text-neutral-500">
                  Copyright holder
                </label>
                <input
                  type="text"
                  placeholder="Label, publisher, artist, or church"
                  value={copyrightHolder}
                  onChange={(e) => setCopyrightHolder(e.target.value)}
                  className={smallInputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-y-1">
                  <label className="text-xs font-medium text-neutral-500">
                    Licence type
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CCLI, direct release"
                    value={licenseType}
                    onChange={(e) => setLicenseType(e.target.value)}
                    className={smallInputClass}
                  />
                </div>
                <div className="flex flex-col gap-y-1">
                  <label className="text-xs font-medium text-neutral-500">
                    Cleared on
                  </label>
                  <input
                    type="date"
                    value={rightsClearanceDate}
                    onChange={(e) => setRightsClearanceDate(e.target.value)}
                    className={smallInputClass}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-y-1">
                <label className="text-xs font-medium text-neutral-500">
                  Licence URL
                </label>
                <input
                  type="url"
                  placeholder="https://…"
                  value={licenseUrl}
                  onChange={(e) => setLicenseUrl(e.target.value)}
                  className={smallInputClass}
                />
              </div>

              <div className="flex flex-col gap-y-1">
                <label className="text-xs font-medium text-neutral-500">
                  Publication status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={smallInputClass}
                >
                  <option value="pending">Pending review</option>
                  <option value="approved">Approved (public)</option>
                  <option value="rejected">Rejected / taken down</option>
                </select>
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-neutral-600">
                <input
                  type="checkbox"
                  checked={downloadAllowed}
                  onChange={(e) => setDownloadAllowed(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 text-accent focus:ring-accent"
                />
                Allow offline downloads
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-neutral-600">
                <input
                  type="checkbox"
                  checked={regionRestricted}
                  onChange={(e) => setRegionRestricted(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 text-accent focus:ring-accent"
                />
                Restrict to specific countries
              </label>

              {regionRestricted && (
                <div className="flex flex-col gap-y-1">
                  <label className="text-xs font-medium text-neutral-500">
                    Allowed countries (ISO codes, comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="US, GB, KE"
                    value={allowedCountries}
                    onChange={(e) => setAllowedCountries(e.target.value)}
                    className={smallInputClass}
                  />
                </div>
              )}

              {status === "approved" &&
                !copyrightHolder.trim() &&
                !licenseType.trim() &&
                !licenseUrl.trim() &&
                !rightsClearanceDate && (
                  <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800">
                    <input
                      type="checkbox"
                      checked={rightsAttested}
                      onChange={(e) => setRightsAttested(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-amber-300 text-accent focus:ring-accent"
                    />
                    I confirm Luumbo owns this recording, or it is public domain
                    or covered by a licence that permits streaming.
                  </label>
                )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="bg-accent py-3.5 rounded-xl text-white font-bold hover:bg-accent/90 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed mt-1 text-sm uppercase tracking-tight"
          >
            {isLoading ? `Saving...` : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditModal;
