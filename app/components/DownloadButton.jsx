"use client";

import { useState, useEffect, useRef } from "react";
import { Download, Check, Loader, XCircle } from "lucide-react";
import { downloadSong, removeDownload, isSongDownloaded } from "@/lib/downloadManager";

export default function DownloadButton({ song, className = "" }) {
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (isSongDownloaded(song.id)) {
      setStatus("downloaded");
      setErrorMsg("");
    }
  }, [song.id]);

  const showError = (msg) => {
    setStatus("error");
    setErrorMsg(msg);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setStatus("idle"), 3000);
  };

  const handleClick = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    clearTimeout(timeoutRef.current);

    if (status === "downloaded") {
      await removeDownload(song.id);
      setStatus("idle");
      return;
    }

    setStatus("downloading");
    setErrorMsg("");
    try {
      await downloadSong(song);
      setStatus("downloaded");
    } catch (err) {
      showError(err.message === "Storage is full" ? "Storage full" : "Download failed");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={status === "downloading"}
      className={`flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300 disabled:opacity-50 ${
        status === "downloaded"
          ? "bg-accent/10 text-accent hover:bg-accent/20"
          : status === "error"
          ? "bg-red-50 text-red-500"
          : "bg-neutral-100 text-neutral-400 hover:bg-accent hover:text-white"
      } ${className}`}
      title={
        status === "downloaded"
          ? "Remove download"
          : status === "downloading"
          ? "Downloading..."
          : errorMsg || "Download for offline"
      }
    >
      {status === "downloading" ? (
        <Loader size={14} className="animate-spin" />
      ) : status === "downloaded" ? (
        <Check size={14} strokeWidth={3} />
      ) : status === "error" ? (
        <XCircle size={14} />
      ) : (
        <Download size={14} />
      )}
    </button>
  );
}
