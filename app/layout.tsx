import type { Metadata } from "next";
import { Sora } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { SessionProvider } from "@/components/layout/SessionProvider";
import { defaultMetadata } from "@/lib/app-brand";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  title: defaultMetadata.title,
  description: defaultMetadata.description,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${sora.variable} h-full`}>
      <body className="h-full bg-[#0a0f1e] font-sans antialiased">
        {/* Animated background orbs — give glassmorphism something to blur */}
        <div className="bg-orb bg-orb-1" aria-hidden="true" />
        <div className="bg-orb bg-orb-2" aria-hidden="true" />
        <div className="bg-orb bg-orb-3" aria-hidden="true" />
        <SessionProvider>{children}</SessionProvider>
        <Toaster
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
