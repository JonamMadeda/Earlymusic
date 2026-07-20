import "./globals.css";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import PlayerWrapper from "./components/PlayerWrapper";
import { PlayerProvider } from "./context/PlayerContext";
import { AuthProvider } from "./context/AuthContext";
import { Analytics } from "@vercel/analytics/react";
import InstallPrompt from "./components/InstallPrompt";
import SWRegister from "./components/SWRegister";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

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
    statusBarStyle: "default",
    title: "Early Music",
  },
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/icon-192x192.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-transparent text-neutral-900 antialiased`}>
        <PlayerProvider>
          <AuthProvider>
            <div className="relative flex min-h-[90vh] h-screen overflow-hidden bg-white">
              <Sidebar />

              <main className="relative flex flex-1 flex-col overflow-hidden border-l border-neutral-200 bg-white">
                <Header />
                <div className="flex-1 overflow-y-auto no-scrollbar pb-44 md:pb-32">
                  {children}
                </div>
              </main>
            </div>

            <BottomNav />
            <PlayerWrapper />

            <Analytics />

            <InstallPrompt />
            <SWRegister />
          </AuthProvider>
        </PlayerProvider>
      </body>
    </html>
  );
}
