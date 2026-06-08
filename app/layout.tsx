import type { Metadata, Viewport } from "next";
import { Sora, Shippori_Mincho, Zen_Kaku_Gothic_New } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { BackgroundOrbs } from "@/components/layout/BackgroundOrbs";
import { GlassBackground } from "@/components/layout/GlassBackground";
import { SlateBackground } from "@/components/layout/SlateBackground";
import { OcasoBackground } from "@/components/layout/OcasoBackground";
import { NeonBackground } from "@/components/layout/NeonBackground";
import { VolcanoBackground } from "@/components/layout/VolcanoBackground";
import { AbyssBackground } from "@/components/layout/AbyssBackground";
import { CosmosBackground } from "@/components/layout/CosmosBackground";
import { StormBackground } from "@/components/layout/StormBackground";
import { CCMGCBackground } from "@/components/layout/CCMGCBackground";
import { DunasBackground } from "@/components/layout/DunasBackground";
import { MeteorBackground } from "@/components/layout/MeteorBackground";
import { AkatsukiBackground } from "@/components/layout/AkatsukiBackground";
import { EvangelionBackground } from "@/components/layout/EvangelionBackground";
import { SithBackground } from "@/components/layout/SithBackground";
import { MatrixBackground } from "@/components/layout/MatrixBackground";
import { StrangerBackground } from "@/components/layout/StrangerBackground";
import { CyberpunkBackground } from "@/components/layout/CyberpunkBackground";
import { SheikahBackground } from "@/components/layout/SheikahBackground";
import { MordorBackground } from "@/components/layout/MordorBackground";
import { TronBackground } from "@/components/layout/TronBackground";
import { Persona5Background } from "@/components/layout/Persona5Background";
import { MidgarBackground } from "@/components/layout/MidgarBackground";
import { InterstellarBackground } from "@/components/layout/InterstellarBackground";
import { SynthwaveBackground } from "@/components/layout/SynthwaveBackground";
import { HollowBackground } from "@/components/layout/HollowBackground";
import { DemonSlayerBackground } from "@/components/layout/DemonSlayerBackground";
import { GhibliBackground } from "@/components/layout/GhibliBackground";
import { DeathNoteBackground } from "@/components/layout/DeathNoteBackground";
import { OnePieceBackground } from "@/components/layout/OnePieceBackground";
import { ItachiBackground } from "@/components/layout/ItachiBackground";
import { AmegakureBackground } from "@/components/layout/AmegakureBackground";
import { SessionProvider } from "@/components/layout/SessionProvider";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { defaultMetadata } from "@/lib/app-brand";
import "./globals.css";
import "./theme-light.css";
import "./theme-glass.css";
import "./theme-slate.css";
import "./theme-ocaso.css";
import "./theme-neon.css";
import "./theme-volcano.css";
import "./theme-abyss.css";
import "./theme-cosmos.css";
import "./theme-storm.css";
import "./theme-ccmgc.css";
import "./theme-dunas.css";
import "./theme-meteor.css";
import "./theme-akatsuki.css";
import "./theme-evangelion.css";
import "./theme-sith.css";
import "./theme-matrix.css";
import "./theme-stranger.css";
import "./theme-cyberpunk.css";
import "./theme-sheikah.css";
import "./theme-mordor.css";
import "./theme-tron.css";
import "./theme-persona5.css";
import "./theme-midgar.css";
import "./theme-interstellar.css";
import "./theme-synthwave.css";
import "./theme-hollow.css";
import "./theme-demonslayer.css";
import "./theme-ghibli.css";
import "./theme-deathnote.css";
import "./theme-onepiece.css";
import "./theme-itachi.css";
import "./theme-amegakure.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

/**
 * Fuentes específicas del tema "akatsuki". Se cargan vía next/font para
 * que Google Fonts no se sirva desde una URL externa (queda self-hosted
 * en `.next/static/media`) y para respetar la CSP `style-src 'self'`.
 *
 * IMPORTANTE: ambas fuentes se inyectan SOLO como CSS variables
 * (`variable: "--font-akatsuki-*"`). NO se aplica `className` al body
 * ni al html, así NINGÚN otro tema ve un cambio en su tipografía. Las
 * variables están disponibles globalmente, pero solo el CSS scopeado
 * a `html[data-theme="akatsuki"]` las usa vía `var(--font-display)` /
 * `var(--font-ui)`.
 */
const shipporiMincho = Shippori_Mincho({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-akatsuki-display",
  display: "swap",
});
const zenKaku = Zen_Kaku_Gothic_New({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-akatsuki-ui",
  display: "swap",
});

export const metadata: Metadata = {
  title: defaultMetadata.title,
  description: defaultMetadata.description,
  icons: { icon: "/logo.svg", shortcut: "/logo.svg" },
};

/**
 * Viewport meta para que los navegadores móviles (Safari iOS sobre todo)
 * no rendericen la app como "desktop scaled" a 980px lógicos. Sin esto,
 * todos los breakpoints de Tailwind (sm/md/lg) quedan anulados en
 * dispositivos reales y la app se ve en versión escritorio reducida.
 *
 * `viewportFit: "cover"` extiende el área de render hasta los bordes
 * físicos del dispositivo (notch, isla dinámica, gestos del Home) para
 * que `env(safe-area-inset-*)` que ya usamos en MobileNav, FABs y
 * footer del chat tenga efecto real.
 *
 * `maximumScale: 5` permite que el usuario haga zoom (accesibilidad);
 * `userScalable: false` se evita a propósito por la misma razón.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

/**
 * Conjunto de IDs de tema que se aplican al `<html>` mediante
 * `data-theme="<id>"`. Mantener sincronizado con `DATA_THEME_MODES`
 * de `lib/theme.ts`.
 *
 * El bootstrap (script inline en <head>) lo recorre con `indexOf` para
 * decidir si pintar el atributo o caer al estado base / aurora. Es la
 * única forma de evitar el flash de tema incorrecto (FOUC) en SSR.
 */
const DATA_THEME_BOOTSTRAP = [
  "light",
  "glass",
  "slate",
  "ocaso",
  "neon",
  "volcano",
  "abyss",
  "cosmos",
  "storm",
  "ccmgc",
  "dunas",
  "meteor",
  "akatsuki",
  "evangelion",
  "sith",
  "matrix",
  "stranger",
  "cyberpunk",
  "sheikah",
  "mordor",
  "tron",
  "persona5",
  "midgar",
  "interstellar",
  "synthwave",
  "hollow",
  "demonslayer",
  "ghibli",
  "deathnote",
  "onepiece",
  "itachi",
  "amegakure",
];

const BOOTSTRAP_SCRIPT = `(function(){try{var k='cc-ops-theme',r=document.documentElement,t=localStorage.getItem(k),L=${JSON.stringify(
  DATA_THEME_BOOTSTRAP,
)};r.removeAttribute('data-theme');r.removeAttribute('data-aurora');if(t&&L.indexOf(t)>-1){r.setAttribute('data-theme',t);}else if(t==='dark'){}else{r.setAttribute('data-aurora','true');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${sora.variable} ${shipporiMincho.variable} ${zenKaku.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="h-full font-sans antialiased">
        <ThemeProvider>
          <BackgroundOrbs />
          <GlassBackground />
          <SlateBackground />
          <OcasoBackground />
          <NeonBackground />
          <VolcanoBackground />
          <AbyssBackground />
          <CosmosBackground />
          <StormBackground />
          <CCMGCBackground />
          <DunasBackground />
          <MeteorBackground />
          <AkatsukiBackground />
          <EvangelionBackground />
          <SithBackground />
          <MatrixBackground />
          <StrangerBackground />
          <CyberpunkBackground />
          <SheikahBackground />
          <MordorBackground />
          <TronBackground />
          <Persona5Background />
          <MidgarBackground />
          <InterstellarBackground />
          <SynthwaveBackground />
          <HollowBackground />
          <DemonSlayerBackground />
          <GhibliBackground />
          <DeathNoteBackground />
          <OnePieceBackground />
          <ItachiBackground />
          <AmegakureBackground />
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
