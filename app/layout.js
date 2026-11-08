import "./globals.css";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import AuthBanner from "./components/AuthBanner";
import BottomNav from "./components/BottomNav";
import PlayerWrapper from "./components/PlayerWrapper";
import Link from "next/link";
import { PlayerProvider } from "./context/PlayerContext";
import { AuthProvider } from "./context/AuthContext";
import ErrorReporter from "./components/ErrorReporter";
import InstallPrompt from "./components/InstallPrompt";
import SWRegister from "./components/SWRegister";
import GlobalLoader from "./components/GlobalLoader";
import AnalyticsConsentBanner from "./components/AnalyticsConsentBanner";
import { Inter } from "next/font/google";
import { SITE_URL } from "@/lib/site";
import { LEGAL_EMAIL, LEGAL_MAILTO } from "@/lib/legal";

const inter = Inter({ subsets: ["latin"] });

export const viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Luumbo",
    template: "%s · Luumbo",
  },
  description: "Stream worship sessions and praise sessions from the Luumbo library.",
  manifest: "/manifest.json?v=2",
  openGraph: {
    type: "website",
    siteName: "Luumbo",
    title: "Luumbo",
    description: "Stream worship sessions and praise sessions from the Luumbo library.",
    url: SITE_URL,
    images: [{ url: "/icons/icon-512x512.png", width: 512, height: 512, alt: "Luumbo" }],
  },
  twitter: {
    card: "summary",
    title: "Luumbo",
    description: "Stream worship sessions and praise sessions from the Luumbo library.",
    images: ["/icons/icon-512x512.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Luumbo",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-16x16.png?v=2", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32x32.png?v=2", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png?v=2", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png?v=2", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png?v=2", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-transparent text-neutral-900 antialiased`}>
        <a
          href="#app-scroll"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>
        <PlayerProvider>
          <AuthProvider>
            <div className="relative flex h-dvh overflow-hidden bg-white">
              <Sidebar />

              <main className="relative flex flex-1 flex-col overflow-hidden border-l border-neutral-200 bg-white">
                <Header />
                <AuthBanner />
                <div id="app-scroll" tabIndex={-1} className="flex-1 overflow-y-auto no-scrollbar pb-44 md:pb-32">
                  {children}
                </div>
              </main>
            </div>

            <BottomNav />
            <PlayerWrapper />
            <GlobalLoader />

            <AnalyticsConsentBanner />
            <ErrorReporter />

            <InstallPrompt />
            <SWRegister />

            <footer className="border-t border-neutral-200 bg-neutral-50 py-6 md:py-8">
              <div className="mx-auto max-w-5xl px-3 sm:px-6 md:px-8">
                <div className="flex flex-col md:flex-row items-center justify-between gap-3 md:gap-6">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold tracking-tight text-neutral-900">
                      Luumbo
                    </span>
                    <span className="text-xs text-neutral-500">
                      · Stream worship and praise music
                    </span>
                  </div>
                  <nav className="flex flex-wrap gap-x-6 md:gap-x-8 text-xs text-neutral-500">
                    <Link
                      href="/terms"
                      className="inline-flex min-h-6 items-center hover:text-accent transition"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Terms of Service
                    </Link>
                    <Link
                      href="/privacy"
                      className="inline-flex min-h-6 items-center hover:text-accent transition"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Privacy Policy
                    </Link>
                    <Link
                      href="/settings#privacy"
                      className="inline-flex min-h-6 items-center hover:text-accent transition"
                    >
                      Privacy choices
                    </Link>
                    <a
                      href={LEGAL_MAILTO}
                      className="inline-flex min-h-6 items-center hover:text-accent transition"
                      title={`Email ${LEGAL_EMAIL}`}
                    >
                      DMCA / Legal Contact
                    </a>
                  </nav>
                  <p className="text-[11px] text-neutral-500">
                    Audio hosted on Cloudflare R2 · Auth &amp; data on Neon ·
                    Deployed on Vercel
                  </p>
                </div>
              </div>
            </footer>
          </AuthProvider>
        </PlayerProvider>
      </body>
    </html>
  );
}
