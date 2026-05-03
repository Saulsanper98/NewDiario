import type { Metadata } from "next";
import { Sora } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { BackgroundOrbs } from "@/components/layout/BackgroundOrbs";
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
            __html: `(function(){try{var k='cc-ops-theme',r=document.documentElement,t=localStorage.getItem(k);r.removeAttribute('data-theme');r.removeAttribute('data-aurora');if(t==='light')r.setAttribute('data-theme','light');else if(t==='dark'){}else r.setAttribute('data-aurora','true');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="h-full font-sans antialiased">
        <ThemeProvider>
          <BackgroundOrbs />
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
            success: {
              duration: 3500,
              iconTheme: { primary: "#0a0f1e", secondary: "#ffeb66" },
              style: {
                border: "1px solid rgba(255, 235, 102, 0.28)",
                boxShadow: "0 0 0 1px rgba(255, 235, 102, 0.08)",
              },
            },
            error: {
              duration: 6500,
              iconTheme: { primary: "#fecaca", secondary: "#7f1d1d" },
              style: {
                border: "1px solid rgba(248, 113, 113, 0.35)",
                background: "rgba(40, 12, 16, 0.96)",
              },
            },
            loading: {
              iconTheme: { primary: "#ffeb66", secondary: "#0a0f1e" },
            },
          }}
        />
      </body>
    </html>
  );
}
