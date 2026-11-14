"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";

/**
 * Shared save/result feedback. Errors render red with role="alert" so they
 * are announced and never mistaken for success; success is a quiet status.
 */
const StatusMessage = ({ tone = "success", children, className = "" }) => {
  if (!children) return null;
  const isError = tone === "error";
  const Icon = isError ? AlertCircle : CheckCircle2;
  return (
    <p
      role={isError ? "alert" : "status"}
      className={`inline-flex items-center gap-1.5 text-sm font-medium ${
        isError ? "text-red-600" : "text-green-600"
      } ${className}`}
    >
      <Icon size={15} className="shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
};

export default StatusMessage;