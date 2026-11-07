export const metadata = {
  title: "Terms of Service · Luumbo",
};

export default function TermsPage() {
  return (
    <main className="min-h-[90vh] bg-transparent px-3 pb-36 pt-2 md:px-8 md:pt-6">
      <div className="mx-auto max-w-3xl">
        <section className="mb-8">
          <div className="flex items-center gap-3">
            <div className="h-6 w-1 rounded-full bg-accent" />
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 md:text-2xl">
              Terms of Service
            </h1>
          </div>
          <p className="mt-1.5 text-sm text-neutral-500">
            Effective date: November 7, 2026
          </p>
        </section>

        <article className="prose prose-neutral max-w-none text-sm leading-relaxed">
          <h2 className="mt-6 mb-3 text-lg font-bold tracking-tight text-neutral-900">
            1. Acceptance of Terms
          </h2>
          <p>
            By accessing or using Luumbo (the &ldquo;App&rdquo;), you agree to
            these Terms of Service. If you do not agree, you may not use the
            App.
          </p>

          <h2 className="mt-6 mb-3 text-lg font-bold tracking-tight text-neutral-900">
            2. Description of Service
          </h2>
          <p>
            Luumbo is a music streaming application that allows users to listen
            to worship and praise songs uploaded by the app&rsquo;s
            administrators. Audio is hosted on Cloudflare R2 and streamed to
            your device. The App does not provide a download feature for audio
            files; playback is streaming-only.
          </p>

          <h2 className="mt-6 mb-3 text-lg font-bold tracking-tight text-neutral-900">
            3. User Accounts
          </h2>
          <p>
            You must register an account to use certain features of the App. You
            are responsible for keeping your account credentials secure and for
            all activity under your account. You must accept our Terms of
            Service and Privacy Policy during registration.
          </p>
          <p>
            You may delete your account at any time from the Account page.
            Deleting your account permanently removes your profile, saved songs,
            playlists, and listening history.
          </p>

          <h2 className="mt-6 mb-3 text-lg font-bold tracking-tight text-neutral-900">
            4. Content and Licensing
          </h2>
          <p>
            All songs available in the App are provided by the app
            administrators, typically a local church. The administrators
            represent that they have obtained the necessary rights, licenses, or
            permissions to host and stream each song. Songs are displayed with
            copyright and licensing information where available.
          </p>
          <p>
            You may not reproduce, distribute, modify, or create derivative
            works of any song or content in the App without express permission
            from the rights holder.
          </p>

          <h2 className="mt-6 mb-3 text-lg font-bold tracking-tight text-neutral-900">
            5. DMCA / Copyright Infringement
          </h2>
          <p>
            If you believe content in the App infringes your copyright, you may
            submit a report using the &ldquo;Report this song&rdquo; option on
            any song, or contact our designated copyright agent at the email
            listed in the footer. We will review and respond to valid
            infringement claims in accordance with applicable law.
          </p>

          <h2 className="mt-6 mb-3 text-lg font-bold tracking-tight text-neutral-900">
            6. User Conduct
          </h2>
          <p>
            You agree not to:
          </p>
          <ul className="list-disc pl-6 my-3 text-neutral-600">
            <li>
              Use the App for any unlawful purpose;
            </li>
            <li>
              Attempt to reverse engineer, scrape, or extract audio files from
              the App;
            </li>
            <li>
              Interfere with or disrupt the App&rsquo;s servers or
              infrastructure;
            </li>
            <li>
              Submit false DMCA or infringement reports.
            </li>
          </ul>

          <h2 className="mt-6 mb-3 text-lg font-bold tracking-tight text-neutral-900">
            7. Termination
          </h2>
          <p>
            We may suspend or terminate your access to the App at any time,
            without notice, for conduct that violates these Terms or that is
            harmful to other users, rights holders, or the service.
          </p>

          <h2 className="mt-6 mb-3 text-lg font-bold tracking-tight text-neutral-900">
            8. Disclaimer of Warranties
          </h2>
          <p>
            The App is provided &ldquo;as is&rdquo; without warranties of any
            kind, express or implied. We do not guarantee that the App will be
            error-free, uninterrupted, or secure.
          </p>

          <h2 className="mt-6 mb-3 text-lg font-bold tracking-tight text-neutral-900">
            9. Limitation of Liability
          </h2>
          <p>
            To the fullest extent permitted by law, Luumbo and its
            administrators are not liable for any indirect, incidental,
            consequential, or punitive damages arising out of your use of or
            inability to use the App.
          </p>

          <h2 className="mt-6 mb-3 text-lg font-bold tracking-tight text-neutral-900">
            10. Changes to These Terms
          </h2>
          <p>
            We may update these Terms from time to time. When we make material
            changes, we will update the effective date above. Your continued use
            of the App after changes are posted constitutes acceptance of the
            revised Terms.
          </p>

          <h2 className="mt-6 mb-3 text-lg font-bold tracking-tight text-neutral-900">
            11. Governing Law
          </h2>
          <p>
            These Terms are governed by the laws of the jurisdiction in which
            the operating church or organization is based, without regard to
            conflict-of-law principles.
          </p>

          <h2 className="mt-6 mb-3 text-lg font-bold tracking-tight text-neutral-900">
            12. Contact
          </h2>
          <p>
            Questions about these Terms may be directed to the legal contact
            email listed in the App footer.
          </p>
        </article>
      </div>
    </main>
  );
}
