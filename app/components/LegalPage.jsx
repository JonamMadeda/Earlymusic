import Link from "next/link";
import {
  ArrowUp,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  Mail,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { LEGAL_EMAIL, LEGAL_MAILTO } from "@/lib/legal";

/**
 * Shared shell for the Terms and Privacy pages. Keeping one layout means the
 * two documents cannot drift apart in structure, and a reader always gets the
 * same table of contents, dates, and contact block.
 */
export default function LegalPage({
  title,
  description,
  effectiveDate,
  lastUpdated,
  summary,
  sections,
  related = [],
}) {
  return (
    <main
      id="top"
      className="min-h-[90vh] bg-transparent px-3 pb-36 pt-2 md:px-8 md:pt-6"
    >
      <div className="mx-auto max-w-5xl">
        <header className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-accent/[0.04]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -left-16 h-44 w-44 rounded-full bg-accent/[0.03]"
          />

          <div className="relative">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500">
              <Scale size={13} aria-hidden="true" />
              Legal
            </div>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-neutral-900 md:text-3xl">
              {title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-500 md:text-[15px]">
              {description}
            </p>

            <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2.5 text-[11px] font-medium text-neutral-600">
              <div className="flex items-center gap-1.5">
                <CalendarDays size={13} className="text-neutral-400" aria-hidden="true" />
                <dt className="sr-only">Effective date</dt>
                <dd>
                  Effective{" "}
                  <span className="font-semibold text-neutral-700">{effectiveDate}</span>
                </dd>
              </div>
              <div className="flex items-center gap-1.5">
                <RefreshCw size={13} className="text-neutral-400" aria-hidden="true" />
                <dt className="sr-only">Last updated</dt>
                <dd>
                  Updated{" "}
                  <span className="font-semibold text-neutral-700">{lastUpdated}</span>
                </dd>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-neutral-400" aria-hidden="true" />
                <dd>{sections.length} sections</dd>
              </div>
            </dl>
          </div>
        </header>

        <section
          aria-labelledby="legal-summary-title"
          className="mt-4 rounded-2xl border border-accent/15 bg-accent/[0.035] p-4 md:p-5"
        >
          <h2
            id="legal-summary-title"
            className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-accent"
          >
            <Sparkles size={13} aria-hidden="true" />
            The short version
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600">{summary}</p>
        </section>

        {/* Mobile table of contents: collapsed by default so it never pushes
            the actual document below the fold. */}
        <details className="group mt-4 rounded-2xl border border-neutral-200 bg-white lg:hidden">
          <summary className="cursor-pointer list-none px-4 py-3 text-xs font-bold text-neutral-700 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-3">
              On this page
              <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                {sections.length} sections
                <ChevronDown
                  size={14}
                  aria-hidden="true"
                  className="transition-transform group-open:rotate-180"
                />
              </span>
            </span>
          </summary>
          <nav aria-label="On this page" className="border-t border-neutral-100 px-2 py-2">
            <ol className="space-y-0.5">
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="flex items-baseline gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-900"
                  >
                    <span className="w-4 shrink-0 text-[10px] font-bold tabular-nums text-neutral-500">
                      {index + 1}
                    </span>
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </details>

        <div className="mt-5 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
          <nav aria-label="On this page" className="hidden lg:block">
            <div className="sticky top-4 rounded-2xl border border-neutral-200 bg-white p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">
                On this page
              </p>
              <ol className="mt-3 space-y-0.5">
                {sections.map((section, index) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="flex items-baseline gap-2 rounded-lg px-2 py-1.5 text-[12px] font-medium leading-snug text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-900"
                    >
                      <span className="w-4 shrink-0 text-[10px] font-bold tabular-nums text-neutral-500">
                        {index + 1}
                      </span>
                      {section.title}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>

          <div className="min-w-0">
            <div className="space-y-3">
              {sections.map((section, index) => (
                <section
                  key={section.id}
                  id={section.id}
                  aria-labelledby={`${section.id}-title`}
                  className="scroll-mt-24 rounded-2xl border border-neutral-200 bg-white p-4 transition-shadow hover:shadow-sm md:p-6"
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent/[0.07] text-[11px] font-bold tabular-nums text-accent"
                    >
                      {index + 1}
                    </span>
                    <h2
                      id={`${section.id}-title`}
                      className="text-[15px] font-bold leading-snug tracking-tight text-neutral-900 md:text-base"
                    >
                      {section.title}
                    </h2>
                  </div>
                  <div className="mt-3 space-y-3 pl-0 text-[13px] leading-relaxed text-neutral-600 md:pl-9 md:text-sm [&_a]:font-semibold [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-accent/80 [&_code]:rounded [&_code]:bg-neutral-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_code]:font-medium [&_code]:text-neutral-800 [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-neutral-800 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
                    {section.content}
                  </div>
                </section>
              ))}
            </div>

            <section
              aria-labelledby="legal-contact-title"
              className="mt-4 rounded-2xl border border-neutral-900 bg-neutral-900 p-5 text-white md:p-6"
            >
              <h2
                id="legal-contact-title"
                className="flex items-center gap-2 text-sm font-bold tracking-tight"
              >
                <Mail size={15} aria-hidden="true" />
                Contact
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-white/70">
                Questions about this document, a data request, or a copyright
                complaint? Email the legal contact and include enough detail for
                us to find the account or song.
              </p>
              <a
                href={LEGAL_MAILTO}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-neutral-900 transition hover:bg-white/90 active:scale-95"
              >
                {LEGAL_EMAIL}
                <ArrowUpRight size={13} aria-hidden="true" />
              </a>
            </section>

            {related.length > 0 && (
              <nav aria-label="Related documents" className="mt-4 grid gap-3 sm:grid-cols-2">
                {related.map((entry) => (
                  <Link
                    key={entry.href}
                    href={entry.href}
                    className="group rounded-2xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-300 hover:shadow-sm"
                  >
                    <span className="flex items-center justify-between gap-2 text-sm font-bold tracking-tight text-neutral-900">
                      {entry.label}
                      <ArrowUpRight
                        size={14}
                        className="text-neutral-300 transition group-hover:text-accent"
                        aria-hidden="true"
                      />
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-neutral-500">
                      {entry.description}
                    </span>
                  </Link>
                ))}
              </nav>
            )}

            <div className="mt-5 flex justify-center">
              <a
                href="#top"
                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-neutral-500 transition hover:border-neutral-300 hover:text-neutral-800"
              >
                <ArrowUp size={12} aria-hidden="true" />
                Back to top
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
