export const metadata = {
  title: "Privacy Policy · Luumbo",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-[90vh] bg-transparent px-3 pb-36 pt-2 md:px-8 md:pt-6">
      <div className="mx-auto max-w-3xl">
        <section className="mb-8">
          <div className="flex items-center gap-3">
            <div className="h-6 w-1 rounded-full bg-accent" />
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 md:text-2xl">
              Privacy Policy
            </h1>
          </div>
          <p className="mt-1.5 text-sm text-neutral-500">
            Effective date: November 7, 2026
          </p>
        </section>

        <article className="prose prose-neutral max-w-none text-sm leading-relaxed">
          <h2 className="mt-6 mb-3 text-lg font-bold tracking-tight text-neutral-900">
            1. Introduction
          </h2>
          <p>
            Luumbo (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;)
            respects your privacy. This Privacy Policy explains what personal
            information we collect, how we use it, and your rights regarding
            that information.
          </p>

          <h2 className="mt-6 mb-3 text-lg font-bold tracking-tight text-neutral-900">
            2. Information We Collect
          </h2>
          <p>
            When you register or use the App, we may collect:
          </p>
          <ul className="list-disc pl-6 my-3 text-neutral-600">
            <li>
              Your email address, first name, and last name;
            </li>
            <li>
              Your password hash (stored by our authentication provider, Neon
              Auth — we do not store plaintext passwords);
            </li>
            <li>
              Your saved songs, playlists, and listening history;
            </li>
            <li>
              Device and browser information, IP address, and usage analytics
              (only if you consent via our consent banner);
            </li>
            <li>
              Session and authentication tokens needed to keep you signed in.
            </li>
          </ul>

          <h2 className="mt-6 mb-3 text-lg font-bold tracking-tight text-neutral-900">
            3. How We Use Your Information
          </h2>
          <p>
            We use your information to:
          </p>
          <ul className="list-disc pl-6 my-3 text-neutral-600">
            <li>
              Create and maintain your account;
            </li>
            <li>
              Authenticate you and manage your sessions;
            </li>
            <li>
              Save and display your songs, playlists, and listening history;
            </li>
            <li>
              Send you account-related emails (verification, password reset);
            </li>
            <li>
              Improve the App through aggregated, anonymized analytics (with
              your consent).
            </li>
          </ul>

          <h2 className="mt-6 mb-3 text-lg font-bold tracking-tight text-neutral-900">
            4. Service Providers
          </h2>
          <p>
            We use trusted third-party providers to operate the App:
          </p>
          <ul className="list-disc pl-6 my-3 text-neutral-600">
            <li>
              <strong>Neon Auth</strong> — user authentication, account
              management, and session storage.
            </li>
            <li>
              <strong>Neon (PostgreSQL)</strong> — application database for
              songs, playlists, saved songs, and audit logs.
            </li>
            <li>
              <strong>Cloudflare R2</strong> — audio file storage and delivery.
            </li>
            <li>
              <strong>Vercel</strong> — application hosting, plus optional
              Analytics and Speed Insights (only with your consent).
            </li>
          </ul>

          <h2 className="mt-6 mb-3 text-lg font-bold tracking-tight text-neutral-900">
            5. Analytics and Cookies
          </h2>
          <p>
            We use a session cookie (<code>lumbo_session</code>) to keep you
            signed in. This cookie is required for the App to function.
          </p>
          <p>
            We only load Vercel Analytics and Speed Insights after you accept
            our analytics consent banner. You may decline analytics at any time;
            the App will continue to work without it.
          </p>

          <h2 className="mt-6 mb-3 text-lg font-bold tracking-tight text-neutral-900">
            6. Data Retention
          </h2>
          <p>
            We retain account data for as long as your account is active.
            Authentication and application error logs are retained for 90 days
            and then purged opportunistically. Passwords and raw tokens are
            never logged.
          </p>

          <h2 className="mt-6 mb-3 text-lg font-bold tracking-tight text-neutral-900">
            7. Your Rights
          </h2>
          <p>
            Depending on your location, you may have the right to:
          </p>
          <ul className="list-disc pl-6 my-3 text-neutral-600">
            <li>
              Access the personal information we hold about you;
            </li>
            <li>
              Request correction or deletion of your information;
            </li>
            <li>
              Withdraw consent to analytics at any time;
            </li>
            <li>
              Object to processing of your information.
            </li>
          </ul>
          <p>
            You can delete your account and all associated data from the
            Account page in the App.
          </p>

          <h2 className="mt-6 mb-3 text-lg font-bold tracking-tight text-neutral-900">
            8. Children&rsquo;s Privacy
          </h2>
          <p>
            The App is not directed to children under 13. We do not knowingly
            collect personal information from children under 13. If you believe
            a child has provided us with personal information, please contact us
            so we can delete it.
          </p>

          <h2 className="mt-6 mb-3 text-lg font-bold tracking-tight text-neutral-900">
            9. Security
          </h2>
          <p>
            We use industry-standard measures to protect your information,
            including encrypted connections (HTTPS) and secure credential
            storage through Neon Auth. No method of transmission over the
            Internet is 100% secure, and we cannot guarantee absolute security.
          </p>

          <h2 className="mt-6 mb-3 text-lg font-bold tracking-tight text-neutral-900">
            10. Changes to This Policy
          </h2>
          <p>
            We may update this Privacy Policy from time to time. The effective
            date at the top will be updated when material changes are made. Your
            continued use of the App constitutes acceptance of the revised
            Policy.
          </p>

          <h2 className="mt-6 mb-3 text-lg font-bold tracking-tight text-neutral-900">
            11. Contact
          </h2>
          <p>
            Questions or requests about this Privacy Policy or your personal
            data may be directed to the legal contact email listed in the App
            footer.
          </p>
        </article>
      </div>
    </main>
  );
}
