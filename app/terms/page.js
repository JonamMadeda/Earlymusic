import Link from "next/link";
import LegalPage from "@/app/components/LegalPage";
import {
  LEGAL_EFFECTIVE_DATE,
  LEGAL_LAST_UPDATED,
} from "@/lib/legal";

export const metadata = {
  title: "Terms of Service",
  description:
    "The rules for using Luumbo: accounts, streaming, offline downloads, acceptable use, copyright complaints, and liability.",
};

const sections = [
  {
    id: "acceptance",
    title: "Acceptance of these Terms",
    content: (
      <>
        <p>
          By creating an account, streaming a song, or otherwise using Luumbo
          (the &ldquo;App&rdquo;), you agree to these Terms of Service and our{" "}
          <Link href="/privacy">Privacy Policy</Link>. If you do not agree, do
          not use the App.
        </p>
        <p>
          If you use the App on behalf of an organisation, you confirm that you
          have authority to accept these Terms for it.
        </p>
      </>
    ),
  },
  {
    id: "eligibility",
    title: "Who can use the App",
    content: (
      <>
        <p>
          You must be at least 13 years old to create an account. If you are
          under 18, you must have permission from a parent or guardian. The App
          is not directed to children under 13, and we may close an account if
          we reasonably believe it belongs to someone below that age.
        </p>
        <p>
          You must provide accurate registration details and may not create an
          account to evade a suspension or impersonate someone else.
        </p>
      </>
    ),
  },
  {
    id: "service",
    title: "The service",
    content: (
      <>
        <p>
          Luumbo is a music streaming app for worship and praise recordings
          uploaded by the app&rsquo;s administrators. Audio is stored on
          Cloudflare R2 and streamed to your device.
        </p>
        <p>
          Where the App offers downloads, you can save tracks for offline
          listening. Offline copies live in your browser&rsquo;s storage on your
          device, are playable only inside the App, and are not files you can
          export. Removing a track from the catalogue, clearing the App&rsquo;s
          data, or deleting your account can remove your offline copies.
        </p>
        <p>
          We may add, change, or remove features and content at any time. We do
          not guarantee that a particular song will stay available.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Your account",
    content: (
      <>
        <p>
          You need an account to save songs, build playlists, and download
          tracks. Keep your password secure and tell us promptly if you believe
          someone else has accessed your account. You are responsible for
          activity that happens under your account.
        </p>
        <p>
          You may delete your account at any time from the{" "}
          <Link href="/account">Account page</Link>. Deleting your account
          removes your profile, saved songs, playlists, recently played
          history, and the download list stored on your device. Some security
          and legal records are kept for a limited time after deletion; the{" "}
          <Link href="/privacy#retention">Privacy Policy</Link> explains which
          ones and for how long.
        </p>
      </>
    ),
  },
  {
    id: "content",
    title: "Content and ownership",
    content: (
      <>
        <p>
          Songs, artwork, metadata, and other content are owned by their
          respective rights holders and are made available by the app&rsquo;s
          administrators. The administrators represent that they hold the
          rights, licences, or permissions needed to host and stream each
          recording. Copyright and licence information is shown where available.
        </p>
        <p>
          We grant you a personal, non-exclusive, non-transferable, revocable
          licence to stream songs and, where offered, save them for offline
          listening inside the App. You may not reproduce, distribute, publicly
          perform, modify, or create derivative works from any content, or
          bypass any technical protection, without permission from the rights
          holder.
        </p>
      </>
    ),
  },
  {
    id: "downloads",
    title: "Downloads and offline use",
    content: (
      <>
        <p>
          Downloads are for your personal listening only. You may not extract
          audio from the App&rsquo;s storage, copy it to another device or
          service, share it, or use it commercially. Downloaded content remains
          subject to these Terms and to the rights holder&rsquo;s rights.
        </p>
        <p>
          Downloads may stop working if a track is removed, if your account is
          closed, or if you clear the App&rsquo;s data. You can remove
          individual downloads from your{" "}
          <Link href="/library?tab=downloads">Library</Link> or clear them all
          in <Link href="/settings">Settings</Link>.
        </p>
      </>
    ),
  },
  {
    id: "conduct",
    title: "Acceptable use",
    content: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>use the App for any unlawful purpose or to infringe anyone&rsquo;s rights;</li>
          <li>
            scrape, crawl, or automate access, or attempt to reverse engineer,
            probe, or bypass the App&rsquo;s security or rate limits;
          </li>
          <li>
            extract, rip, or redistribute audio or other content, or help
            anyone else do so;
          </li>
          <li>
            interfere with the App&rsquo;s servers, network, or other
            listeners&rsquo; use;
          </li>
          <li>
            impersonate another person, harass other users, or upload or report
            false information; or
          </li>
          <li>submit fraudulent or bad-faith copyright reports.</li>
        </ul>
      </>
    ),
  },
  {
    id: "copyright",
    title: "Copyright complaints (DMCA)",
    content: (
      <>
        <p>
          We respond to clear notices of copyright infringement and will remove
          or disable access to material that is the subject of a valid notice.
          To report infringement, use &ldquo;Report this song&rdquo; in the App
          or email the legal contact below with all of the following:
        </p>
        <ul>
          <li>your physical or electronic signature;</li>
          <li>identification of the copyrighted work you say is infringed;</li>
          <li>
            the URL or enough detail for us to locate the material you say is
            infringing;
          </li>
          <li>your name, address, telephone number, and email address;</li>
          <li>
            a statement that you have a good-faith belief the use is not
            authorised by the rights holder, its agent, or the law; and
          </li>
          <li>
            a statement, under penalty of perjury, that the information in your
            notice is accurate and that you are the rights holder or are
            authorised to act for them.
          </li>
        </ul>
        <p>
          If we remove material because of your notice, we may tell the uploader
          and give them a chance to respond. If you believe your material was
          removed by mistake, you may send a counter-notice to the same contact
          with the same details, a statement of good faith, and your consent to
          the jurisdiction of the appropriate court.
        </p>
        <p>
          We may suspend or terminate the accounts of users who repeatedly
          infringe copyright.
        </p>
      </>
    ),
  },
  {
    id: "termination",
    title: "Suspension and termination",
    content: (
      <>
        <p>
          We may suspend or end your access, with or without notice, if you
          break these Terms, if we are required to by law, or if your use harms
          other listeners, rights holders, or the service. You may stop using
          the App and delete your account at any time.
        </p>
        <p>
          Sections that by their nature should survive termination &mdash;
          including content ownership, disclaimers, liability, and governing law
          &mdash; continue to apply.
        </p>
      </>
    ),
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    content: (
      <p>
        The App and its content are provided &ldquo;as is&rdquo; and &ldquo;as
        available&rdquo;. To the extent permitted by law, we disclaim all
        warranties, express or implied, including fitness for a particular
        purpose. We do not guarantee that the App will be uninterrupted,
        error-free, or secure, or that any content will remain available.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limitation of liability",
    content: (
      <p>
        To the fullest extent permitted by law, Luumbo, its administrators, and
        the organisations that operate it are not liable for indirect,
        incidental, special, consequential, or punitive damages, or for lost
        data or profits, arising from your use of or inability to use the App.
        Nothing in these Terms limits liability that cannot be limited by law,
        including liability for death or personal injury caused by negligence,
        or for fraud.
      </p>
    ),
  },
  {
    id: "third-parties",
    title: "Third-party services",
    content: (
      <p>
        The App relies on third-party providers, which are listed in the{" "}
        <Link href="/privacy#providers">Privacy Policy</Link>, and may link to
        third-party sites. We are not responsible for their content or
        practices, and your use of a third-party service is governed by that
        provider&rsquo;s terms.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these Terms",
    content: (
      <p>
        We may update these Terms. If a change is material, we will make it
        clear in the App &mdash; for example, by updating this page and its
        &ldquo;last updated&rdquo; date, or by asking you to accept the new
        version. Continued use after a change takes effect means you accept the
        revised Terms. If you do not agree, stop using the App and delete your
        account.
      </p>
    ),
  },
  {
    id: "law",
    title: "Governing law",
    content: (
      <p>
        These Terms are governed by the laws of the jurisdiction where the
        organisation operating the App is based, without regard to
        conflict-of-law rules. Disputes will be handled by the courts of that
        jurisdiction, unless mandatory local law gives you another forum.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    content: (
      <p>
        Questions about these Terms and copyright notices can be sent to the
        legal contact in the card below. Include the account email or song link
        so we can find what you are writing about.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      description="The agreement between you and Luumbo: what the service is, how accounts and downloads work, what we expect from you, and how copyright complaints are handled."
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      lastUpdated={LEGAL_LAST_UPDATED}
      summary="Use Luumbo lawfully, keep your account secure, and listen personally. Streams and downloads are licensed for in-app listening only — no ripping, redistributing, or scraping. If you own the rights to a recording, use the report option and we will review it."
      sections={sections}
      related={[
        {
          href: "/privacy",
          label: "Privacy Policy",
          description: "What we collect, why, and the choices you have.",
        },
        {
          href: "/settings#privacy",
          label: "Privacy choices",
          description: "Turn analytics on or off and clear local data.",
        },
        {
          href: "/accessibility",
          label: "Accessibility",
          description: "Keyboard access, screen readers, and reporting a barrier.",
        },
      ]}
    />
  );
}
