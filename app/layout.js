import "./globals.css";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import PlayerWrapper from "./components/PlayerWrapper";
import { PlayerProvider } from "./context/PlayerContext";
import { AuthProvider } from "./context/AuthContext";
import { Analytics } from "@vercel/analytics/react";
import InstallPrompt from "./components/InstallPrompt";

// UPDATED: Theme color changed to white for the mobile top bar
export const viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata = {
  title: "Early Music",
  description: "Music Streaming App",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    // "default" ensures a white background with dark text/icons on iOS
    statusBarStyle: "default",
    title: "Early Music",
  },
  // Mapping icons for PWA and iOS discovery
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/icon-192x192.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-white text-neutral-900 antialiased">
        <PlayerProvider>
          <AuthProvider>
          {/* Main App Shell 
              Maintained min-h-[90vh] per your instructions.
              Using h-screen ensures the sidebar/main scroll independently.
          */}
          <div className="flex flex-col md:flex-row min-h-[90vh] h-screen overflow-hidden">
            <Sidebar />

            <main className="flex-1 bg-neutral-50 md:rounded-2xl md:m-2 md:border border-neutral-200 overflow-hidden relative flex flex-col">
              <Header />
              <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
                {children}
              </div>
            </main>
          </div>

          {/* Player Wrapper: Persistent across route changes */}
          <PlayerWrapper />

          {/* Analytics: Vercel usage tracking */}
          <Analytics />

          {/* InstallPrompt: Custom PWA installation logic */}
          <InstallPrompt />
          </AuthProvider>
        </PlayerProvider>
      </body>
    </html>
  );
}
