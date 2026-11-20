"use client";

/**
 * The Library's single empty-state shape: one small icon, one sentence, one
 * action. Keeps the five previous near-identical blocks from competing with
 * each section's real content.
 */
export default function EmptyState({ icon: Icon, title, description, action, compact = false }) {
  return (
    <div
      className={`mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/40 px-4 text-center ${
        compact ? "py-8" : "py-12"
      }`}
    >
      {Icon && (
        <div className="mb-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-accent/10 bg-accent/[0.06] text-accent">
          <Icon size={20} aria-hidden="true" />
        </div>
      )}
      <h3 className="text-sm font-bold text-neutral-900">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-neutral-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
