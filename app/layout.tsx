import type { Metadata } from "next";
import { Sora } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { SessionProvider } from "@/components/layout/SessionProvider";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { defaultMetadata } from "@/lib/app-brand";
import "./globals.css";
import "./theme-light.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  title: defaultMetadata.title,
  description: defaultMetadata.description,
  icons: { icon: "/logo.svg", shortcut: "/logo.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${sora.variable} h-full`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k='cc-ops-theme';var t=localStorage.getItem(k);if(t==='light')document.documentElement.setAttribute('data-theme','light');else document.documentElement.removeAttribute('data-theme');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="h-full font-sans antialiased">
        {/* Animated background orbs — give glassmorphism something to blur */}
        <div className="bg-orb bg-orb-1" aria-hidden="true" />
        <div className="bg-orb bg-orb-2" aria-hidden="true" />
        <div className="bg-orb bg-orb-3" aria-hidden="true" />
        <ThemeProvider>
          <SessionProvider>{children}</SessionProvider>
        </ThemeProvider>
        <Toaster
          containerClassName="cc-hot-toaster"
          position="top-right"
          toastOptions={{
            className: "toast-glass",
            duration: 4000,
            style: {
              background: "rgba(15, 20, 40, 0.95)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#f0f4ff",
              fontFamily: "Sora, sans-serif",
              fontSize: "14px",
            },
          }}
        />
      </body>
    </html>
  );
}
