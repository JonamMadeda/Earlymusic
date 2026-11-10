import Link from "next/link";
import LegalPage from "@/app/components/LegalPage";
import { LEGAL_EMAIL, LEGAL_MAILTO, LEGAL_LAST_UPDATED } from "@/lib/legal";

export const metadata = {
  title: "Accessibility",
  description:
    "How Luumbo approaches keyboard access, screen readers, captions, motion, and reporting an accessibility barrier.",
};

const sections = [
  {
    id: "commitment",
    title: "Our commitment",
    content: (
      <>
        <p>
          Luumbo is a music player, so listening should not depend on being able
          to see or use a mouse. We aim to meet the{" "}
          <a
            href="https://www.w3.org/TR/WCAG22/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Web Content Accessibility Guidelines (WCAG) 2.2, Level AA
          </a>{" "}
          as the app evolves.
        </p>
        <p>
          We have not commissioned an independent audit, so we do not claim
          certified conformance. This page describes what is implemented today
          and how to tell us when something does not work.
        </p>
      </>
    ),
  },
  {
    id: "keyboard",
    title: "Keyboard and focus",
    content: (
      <>
        <p>
          Every interactive control can be reached with the Tab key and operated
          with Enter or Space. A &ldquo;Skip to content&rdquo; link is the first
          focusable element on each page. Focus outlines are visible against the
          white and neutral backgrounds used throughout the app.
        </p>
        <p>
          Dialogs close with Escape, move focus into the dialog when they open,
          and return focus to the control that opened them.
        </p>
      </>
    ),
  },
  {
    id: "screen-readers",
    title: "Screen readers and semantics",
    content: (
      <>
        <p>
          Pages use landmark elements, one top-level heading, labelled forms, and
          buttons with accessible names. Icon-only controls carry an{" "}
          <code>aria-label</code>. Playback state and toast messages are announced
          through live regions where they change without a page reload.
        </p>
        <p>
          The player exposes the current track, playback state, and progress as
          text, so the information is not conveyed by colour or position alone.
        </p>
      </>
    ),
  },
  {
    id: "media",
    title: "Audio, captions, and transcripts",
    content: (
      <>
        <p>
          The library is music and recorded worship sessions. Where a recording
          includes spoken teaching, a transcript is not yet published for every
          track. If you need a transcript or captions for a specific recording,
          write to us and we will tell you what is available.
        </p>
        <p>
          Playback can be paused, resumed, and seeked from the keyboard. Playback
          speed and volume are adjustable, and the sleep timer can stop playback
          without requiring the screen to stay on.
        </p>
      </>
    ),
  },
  {
    id: "visual",
    title: "Colour, contrast, and motion",
    content: (
      <>
        <p>
          Text is sized in relative units and the layout reflows on small screens.
          The interface respects the operating system&rsquo;s reduced-motion
          preference for non-essential animation, and it does not rely on colour
          alone to communicate status.
        </p>
        <p>
          If you use a high-contrast or forced-colours mode and find a control
          that disappears, please report it.
        </p>
      </>
    ),
  },
  {
    id: "report",
    title: "Report an accessibility barrier",
    content: (
      <>
        <p>
          Tell us the page, what you were trying to do, and the browser or
          assistive technology you used. We will acknowledge the report and tell
          you whether we can fix it, and when.
        </p>
        <p>
          Email{" "}
          <a href={LEGAL_MAILTO}>{LEGAL_EMAIL}</a> with the subject
          &ldquo;Accessibility&rdquo;. You can also use the report option on a
          song if the problem is with a specific track.
        </p>
      </>
    ),
  },
];

export default function AccessibilityPage() {
  return (
    <LegalPage
      title="Accessibility"
      description="How Luumbo approaches keyboard access, screen readers, media alternatives, contrast, motion, and reporting a barrier."
      effectiveDate="November 9, 2026"
      lastUpdated={LEGAL_LAST_UPDATED}
      summary="Luumbo aims to meet WCAG 2.2 AA. Keyboard navigation, visible focus, labelled controls, and reduced-motion support are built in. If something blocks you, email the legal contact and we will respond."
      sections={sections}
      related={[
        {
          href: "/terms",
          label: "Terms of Service",
          description: "The rules for using Luumbo and its content.",
        },
        {
          href: "/privacy",
          label: "Privacy Policy",
          description: "What we collect, why, and the choices you have.",
        },
        {
          href: "/settings#privacy",
          label: "Privacy choices",
          description: "Change analytics consent or clear local data.",
        },
      ]}
    />
  );
}
