"use client";

import React, { useState } from "react";
import Link from "next/link";
import { FileText, ShieldCheck, UserRoundCheck } from "lucide-react";

const CONSENT_KEY = "lumbo_terms_consent";

export default function TermsConsentModal({ onAccept, isOpen }) {
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

  if (!isOpen) return null;

  const handleAccept = () => {
    try {
      window.localStorage.setItem(
        CONSENT_KEY,
        JSON.stringify({ terms: true, privacy: true, at: new Date().toISOString() })
      );
    } catch {}
    onAccept();
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-consent-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onAccept}
      />
      {/* Modal panel */}
      <div className="relative w-full max-w-lg mx-auto p-6 md:p-8">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 id="terms-consent-title" className="text-lg font-bold tracking-tight text-neutral-900">
                Almost done — please review our terms
              </h2>
              <p className="mt-0.5 text-sm text-neutral-500">
                We need your consent before creating your account.
              </p>
            </div>
          </div>

          {/* Consent items */}
          <div className="space-y-4">
            <ConsentItem
              key="terms"
              icon={<FileText size={18} />}
              title="Terms of Service"
              description="Governs your use of the app, accounts, content, and conduct."
              checked={acceptedTerms}
              onToggle={setAcceptedTerms}
            />
            <ConsentItem
              key="privacy"
              icon={<UserRoundCheck size={18} />}
              title="Privacy Policy"
              description="Explains what data we collect, how we use it, and your rights."
              checked={acceptedPrivacy}
              onToggle={setAcceptedPrivacy}
            />
          </div>

          {/* Links row */}
          <div className="flex items-center justify-end gap-2 text-xs">
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline font-medium"
            >
              Read full Terms of Service
            </Link>
            <span className="text-neutral-300">•</span>
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline font-medium"
            >
              Read full Privacy Policy
            </Link>
          </div>

          {/* Action button */}
          <button
            onClick={handleAccept}
            disabled={!acceptedTerms || !acceptedPrivacy}
            className={`w-full flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-xs font-bold transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${
              acceptedTerms && acceptedPrivacy
                ? "bg-accent text-white hover:bg-accent/90"
                : "bg-neutral-100 text-neutral-400"
            }`}
          >
            {acceptedTerms && acceptedPrivacy ? (
              <>
                <UserRoundCheck size={14} />
                Create Account
              </>
            ) : (
              <>
                <ShieldCheck size={14} />
                I accept
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConsentItem({ icon, title, description, checked, onToggle }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle(!checked);
      }}
      className={`flex items-start gap-3 rounded-xl border p-3 transition-all hover:bg-neutral-50 ${
        checked
          ? "border-accent bg-accent/5 shadow-sm"
          : "border-neutral-200 bg-white"
      }`}
    >
      <div className="mt-1 shrink-0">
        {React.isValidElement(icon)
          ? React.cloneElement(icon, {
              className: `text-${checked ? "accent" : "neutral-400"}`,
            })
          : icon}
      </div>
      <div className="flex-1 leading-relaxed">
        <div className="flex items-baseline gap-1.5">
          <span className="font-semibold text-neutral-900">{title}</span>
          {checked && <span className="text-xs text-accent font-bold">✓ Accepted</span>}
        </div>
        <p className="mt-0.5 text-[12px] text-neutral-500">{description}</p>
      </div>
      <div className="shrink-0">
        <input
          type="checkbox"
          checked={checked}
          readOnly
          className={`w-4 h-4 rounded border-neutral-300 text-accent focus:ring-accent ${
            checked ? "bg-accent border-accent" : ""
          }`}
          aria-hidden="true"
        />
      </div>
    </button>
  );
}
