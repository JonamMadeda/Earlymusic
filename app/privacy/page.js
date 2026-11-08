import Link from "next/link";
import LegalPage from "@/app/components/LegalPage";
import {
  LEGAL_EFFECTIVE_DATE,
  LEGAL_LAST_UPDATED,
} from "@/lib/legal";

export const metadata = {
  title: "Privacy Policy · Luumbo",
  description:
    "What Luumbo collects, why we collect it, how long we keep it, and how to access, export, or delete your data.",
};

const sections = [
  {
    id: "intro",
    title: "Who we are and what this covers",
    content: (
      <>
        <p>
          Luumbo (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is a
          worship-music streaming app operated by the organisation that runs it.
          This Privacy Policy explains what personal information we collect, why
          we collect it, how long we keep it, and the choices you have.
        </p>
        <p>
          It covers the App and these legal pages. It does not cover third-party
          sites we link to, which have their own policies.
        </p>
      </>
    ),
  },
  {
    id: "collect",
    title: "What we collect",
    content: (
      <>
        <p>
          <strong>Account details.</strong> Your email address, first and last
          name, and the timestamps when you accepted these Terms and this
          Policy. Passwords are handled by our authentication provider, Neon
          Auth; we never receive or store your plaintext password.
        </p>
        <p>
          <strong>Your library.</strong> Songs you save, playlists you create,
          recently played tracks, and your playback position so playback can
          resume where you left off.
        </p>
        <p>
          <strong>Downloads.</strong> A list of tracks you saved for offline
          listening. The audio itself stays in your browser&rsquo;s storage on
          your device and is not uploaded to us.
        </p>
        <p>
          <strong>Technical and security data.</strong> IP address,
          browser/user-agent, and authentication events such as sign-in,
          sign-out, password reset, and account deletion. We collect this
          whether or not you accept analytics, because we need it to keep
          accounts secure and to prevent abuse.
        </p>
        <p>
          <strong>Error diagnostics.</strong> If the App crashes or a request
          fails, we receive the error message, a stack trace, the page you were
          on, your IP address, and your user-agent. This helps us find and fix
          bugs.
        </p>
        <p>
          <strong>Reports you send.</strong> The description you submit through
          &ldquo;Report this song&rdquo; and, if you choose to provide them, your
          name and email address.
        </p>
        <p>
          <strong>Analytics (only with your consent).</strong> Aggregated usage
          and performance data from Vercel Analytics and Speed Insights, such as
          page views and loading speed. We do not use it to identify you.
        </p>
        <p>
          <strong>Local preferences on your device.</strong> Consent choices,
          playback position, recently played songs, the download list, dismissed
          notifications, and whether you dismissed the install prompt. These stay
          in your browser and are not sent to us.
        </p>
      </>
    ),
  },
  {
    id: "use",
    title: "How and why we use it",
    content: (
      <>
        <ul>
          <li>
            <strong>Provide the service</strong> &mdash; create your account,
            authenticate you, stream music, and keep your library and downloads
            working.
          </li>
          <li>
            <strong>Keep it secure</strong> &mdash; detect abuse, apply rate
            limits, investigate suspicious sign-ins, and diagnose crashes.
          </li>
          <li>
            <strong>Improve the App</strong> &mdash; understand which features
            are used and how the App performs, using analytics only when you
            consent.
          </li>
          <li>
            <strong>Communicate</strong> &mdash; send verification and
            password-reset emails, and reply to reports or requests you send.
          </li>
          <li>
            <strong>Comply with the law</strong> &mdash; keep copyright and
            takedown records, and respond to valid legal requests.
          </li>
        </ul>
        <p>
          We do not sell your personal information, and we do not use it for
          advertising or cross-site behavioural tracking.
        </p>
      </>
    ),
  },
  {
    id: "legal-bases",
    title: "Legal bases for processing",
    content: (
      <p>
        If you are in the European Economic Area or the United Kingdom, we rely
        on: performance of a contract (providing the App and your account);
        legitimate interests (security, abuse prevention, and improving the
        service); consent (analytics); and legal obligation (records we are
        required to keep). You can withdraw consent at any time without
        affecting processing that already happened.
      </p>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and local storage",
    content: (
      <>
        <p>
          <strong>Essential cookie.</strong> <code>lumbo_session</code> keeps
          you signed in. It is HttpOnly, SameSite=Lax, lasts up to seven days,
          and is renewed while you are active. The App cannot work without it.
          Our authentication provider may also set its own secure session cookie
          while you sign in.
        </p>
        <p>
          <strong>Local storage and cache.</strong> These are not cookies and
          stay on your device: your analytics choice, notification read state,
          recently played songs, playback position, the download list, the
          offline audio cache, and install-prompt dismissal.
        </p>
        <p>
          We do not use advertising cookies or cross-site trackers. You can
          clear local data at any time in <Link href="/settings">Settings</Link>{" "}
          &rarr; Reset App Data.
        </p>
      </>
    ),
  },
  {
    id: "providers",
    title: "Who we share it with",
    content: (
      <>
        <p>
          We use trusted providers to run the App and share only what each one
          needs:
        </p>
        <ul>
          <li>
            <strong>Neon Auth</strong> &mdash; authentication, account
            management, and session storage.
          </li>
          <li>
            <strong>Neon (PostgreSQL)</strong> &mdash; the application database
            for accounts, songs, playlists, saved songs, reports, and audit
            logs.
          </li>
          <li>
            <strong>Cloudflare R2</strong> &mdash; audio file storage and
            delivery.
          </li>
          <li>
            <strong>Vercel</strong> &mdash; application hosting, plus Analytics
            and Speed Insights only when you consent.
          </li>
        </ul>
        <p>
          We may also disclose information if required by law, to respond to a
          valid legal request, or to protect the rights, safety, and security of
          listeners, rights holders, or the service. We do not sell personal
          information.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    content: (
      <>
        <ul>
          <li>
            <strong>Account and library data</strong> &mdash; while your account
            exists.
          </li>
          <li>
            <strong>Authentication events and app error logs</strong> &mdash; up
            to 90 days, then deleted. Passwords and raw session tokens are never
            logged.
          </li>
          <li>
            <strong>Copyright reports and takedown records</strong> &mdash; kept
            as long as needed to handle the report and meet legal obligations.
          </li>
          <li>
            <strong>After you delete your account</strong> &mdash; your profile,
            saved songs, playlists, recently played history, and download list
            are deleted. Security audit rows that recorded the deletion
            (including your email) may be kept for up to 90 days without a link
            to a live account, and copyright/takedown records may be retained
            for legal compliance.
          </li>
          <li>
            <strong>Local data</strong> &mdash; stays on your device until you
            clear it in Settings or clear your browser storage.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "choices",
    title: "Your choices and rights",
    content: (
      <>
        <p>
          Depending on where you live, you may have the right to access,
          correct, delete, restrict, or object to our processing of your
          information, and to receive a portable copy of it.
        </p>
        <ul>
          <li>
            <strong>Analytics</strong> &mdash; accept or decline on first visit,
            and change your choice at any time in{" "}
            <Link href="/settings#privacy">Settings &rarr; Privacy</Link>.
          </li>
          <li>
            <strong>Access and correction</strong> &mdash; review and update
            your name and profile details from the{" "}
            <Link href="/account">Account page</Link>. To change the email
            address on your account, contact us.
          </li>
          <li>
            <strong>Deletion</strong> &mdash; delete your account from the{" "}
            <Link href="/account">Account page</Link>; you will need your
            current password.
          </li>
          <li>
            <strong>Local data</strong> &mdash; clear downloads and cached data
            in <Link href="/settings">Settings</Link>.
          </li>
          <li>
            <strong>Other requests</strong> &mdash; email the legal contact
            below. We may need to verify your identity before acting.
          </li>
        </ul>
        <p>
          You also have the right to complain to your local data-protection
          authority. We would appreciate the chance to resolve the issue first.
        </p>
      </>
    ),
  },
  {
    id: "deletion",
    title: "Deleting your account",
    content: (
      <>
        <p>
          Account deletion is permanent. When it completes, we delete your
          account record, profile, saved songs, playlists, and recently played
          history from our database. Downloads stored in your browser are
          cleared when you sign out or reset app data.
        </p>
        <p>
          A small number of records are kept for the periods described in{" "}
          <a href="#retention">How long we keep it</a>. If you need a copy of
          your data before deleting, contact us first &mdash; we cannot recover
          an account after deletion.
        </p>
      </>
    ),
  },
  {
    id: "children",
    title: "Children’s privacy",
    content: (
      <p>
        The App is not directed to children under 13, and we do not knowingly
        collect personal information from them. If you believe a child under 13
        has created an account or sent us information, contact us and we will
        delete it.
      </p>
    ),
  },
  {
    id: "security",
    title: "Security",
    content: (
      <p>
        We use HTTPS, HttpOnly and SameSite cookies, password hashing through
        Neon Auth, rate limiting, and restricted access to production systems.
        No method of transmission or storage is completely secure, so we cannot
        guarantee absolute security. Tell us immediately if you suspect
        unauthorised access to your account.
      </p>
    ),
  },
  {
    id: "transfers",
    title: "International transfers",
    content: (
      <p>
        Our providers may process information outside your country, including in
        the United States. Where required, we rely on appropriate safeguards such
        as standard contractual clauses approved by the relevant authority.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this Policy",
    content: (
      <p>
        We may update this Privacy Policy. If a change is material, we will make
        it clear in the App and update the &ldquo;last updated&rdquo; date above.
        Continued use after a change takes effect means you accept the revised
        Policy.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    content: (
      <p>
        Questions or requests about this Policy or your personal data can be
        sent to the legal contact in the card below. Include the email address
        on your account so we can find your records.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      description="What Luumbo collects, why we collect it, who processes it, how long we keep it, and how you can access or delete it."
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      lastUpdated={LEGAL_LAST_UPDATED}
      summary="We collect what an account and a music library need: your email and name, your saved songs and playlists, and security logs. Analytics only runs if you say yes, and you can turn it off again in Settings. We do not sell your data."
      sections={sections}
      related={[
        {
          href: "/terms",
          label: "Terms of Service",
          description: "The rules for using Luumbo and its content.",
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
