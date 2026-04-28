"use client";

import { useState, useEffect, useRef, startTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, AlertCircle } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { APP_ORG, APP_TAGLINE } from "@/lib/app-brand";

/* ── helpers ────────────────────────────────────────────────────────────── */

function isNightHour() {
  const h = new Date().getHours();
  return h >= 20 || h < 7;
}

/* ── sub-components ─────────────────────────────────────────────────────── */

/** Paisaje lejano + silueta muy suave del Teide (Tenerife) al fondo, típica en días claros. */
function LoginMountainBackdrop({ night }: { night: boolean }) {
  const fillFar = night ? "rgba(5,12,38,0.42)" : "rgba(4,10,32,0.3)";
  const fillMid = night ? "rgba(3,6,22,0.72)" : "rgba(2,8,24,0.58)";
  const fill = night ? "rgba(4,8,28,0.88)" : "rgba(3,10,30,0.74)";
  const teideFill = night ? "rgba(36, 48, 88, 0.85)" : "rgba(40, 72, 120, 0.7)";
  const teideOp = night ? 0.48 : 0.34;

  return (
    <svg
      viewBox="0 0 1440 320"
      preserveAspectRatio="xMinYMax slice"
      className="absolute bottom-0 left-0 z-0 h-full w-full pointer-events-none select-none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="loginRoqueHorizonGlow"
          x1="18%"
          y1="100%"
          x2="18%"
          y2="0%"
        >
          <stop offset="0%" stopColor="rgba(130,155,210,0.38)" />
          <stop offset="40%" stopColor="rgba(45,55,95,0.1)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </linearGradient>
        <filter id="loginTeideSoft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" />
        </filter>
      </defs>
      {night && (
        <rect
          x="0"
          y="200"
          width="720"
          height="120"
          fill="url(#loginRoqueHorizonGlow)"
        />
      )}
      <path
        d="M0,320 L0,198 C140,182 300,205 460,186 C620,168 760,195 920,178 C1080,162 1240,188 1440,172 L1440,320 Z"
        fill={fillFar}
      />
      <path
        d="M0,320 L0,248 C100,232 240,258 400,242 C560,226 700,252 860,236 C1020,220 1180,248 1440,228 L1440,320 Z"
        fill={fillMid}
      />
      <path
        d="M0,320 L0,284 C100,276 220,286 360,278 C420,270 520,258 680,254 C840,262 1180,262 1440,270 L1440,320 Z"
        fill={fill}
        opacity="0.92"
      />
      <path
        d="M0,320 L0,296 C100,288 220,300 340,292 L360,284 L380,278 L400,276 L420,282 C360,292 240,302 120,308 L0,320 Z"
        fill={fill}
        opacity="0.98"
      />
      <path
        d="M1440,320 L1440,298 C1280,290 1120,298 980,290 C920,286 880,282 860,280 L840,284 C900,292 1080,302 1240,308 L1440,320 Z"
        fill={fill}
        opacity="0.98"
      />
      {/* Teide al fondo (Tenerife), encima del relleno del horizonte */}
      <path
        d="M 158 200 L 186 152 L 214 200 Z"
        fill={teideFill}
        opacity={teideOp}
        filter="url(#loginTeideSoft)"
      />
    </svg>
  );
}

const roqueImg = "/roque-nublo-silhouette-only.svg";

/** Altura de la franja del Roque (imagen), pegada al borde inferior del viewport. */
const loginRoqueBand = "min(56vh, 680px)";
/** Olas: dentro de la franja del Roque (por encima del trazo), no al borde superior de la caja (= cielo). */
const loginOceanHorizonBottom = "min(46vh, 480px)";

/** Silueta: siempre anclada al borde inferior del viewport (capa fija, no al flex del formulario). */
function LoginRoqueSilhouette({ night }: { night: boolean }) {
  /* Degradado inferior: negro #010101 bajo el trazo (transparencias del SVG), sin tapar el macizo con un plano del mismo color. */
  const roqueStageBg =
    "linear-gradient(to top, #010101 0%, #010101 26%, rgba(1,1,1,0.92) 38%, rgba(1,1,1,0.35) 52%, transparent 62%)";

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] w-full overflow-hidden max-h-[min(82vh,800px)]"
      style={{ height: loginRoqueBand, background: roqueStageBg }}
      aria-hidden="true"
    >
      <div className="login-roque-stack relative h-full w-full">
        {/* eslint-disable-next-line @next/next/no-img-element -- recurso en /public */}
        <img
          src={roqueImg}
          alt=""
          className={`login-roque-bloom absolute inset-0 h-full w-full min-w-full max-w-none object-cover object-left-bottom ${night ? "" : "opacity-90"}`}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={roqueImg}
          alt=""
          className="login-roque-figure absolute inset-0 h-full w-full min-w-full max-w-none object-cover object-left-bottom"
        />
      </div>
    </div>
  );
}

/**
 * Escena completa fija al viewport: cielo, montes, mar y Roque no dependen del centrado flex
 * del formulario (evita que el macizo “suba” visualmente al centro).
 */
function LoginViewportScene({ night }: { night: boolean }) {
  return (
    <div
      className="login-viewport-scene fixed inset-0 z-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      <div className={`absolute inset-0 ${night ? "login-bg-night" : "login-bg-day"}`} />
      {night && <div className="absolute inset-0 login-stars" />}
      {night && <div className="absolute inset-0 login-milky-hint" />}
      {night && <div className="login-clouds" aria-hidden="true" />}
      <div
        className="absolute top-[8%] left-[18%] w-[28rem] h-[28rem] rounded-full"
        style={{
          background: night
            ? "radial-gradient(circle, rgba(28,55,130,0.35), transparent 70%)"
            : "radial-gradient(circle, rgba(15,75,150,0.32), transparent 70%)",
          filter: "blur(80px)",
          animation: "orb-drift-1 55s ease-in-out infinite",
        }}
      />
      <div
        className="absolute bottom-[18%] right-[12%] w-72 h-72 rounded-full"
        style={{
          background: night
            ? "radial-gradient(circle, rgba(55,15,110,0.3), transparent 70%)"
            : "radial-gradient(circle, rgba(0,110,180,0.25), transparent 70%)",
          filter: "blur(70px)",
          animation: "orb-drift-2 68s ease-in-out infinite",
        }}
      />
      <div
        className="absolute top-[42%] right-[28%] w-56 h-56 rounded-full"
        style={{
          background: night
            ? "radial-gradient(circle, rgba(255,235,102,0.06), transparent 70%)"
            : "radial-gradient(circle, rgba(255,235,102,0.10), transparent 70%)",
          filter: "blur(55px)",
          animation: "orb-drift-3 46s ease-in-out infinite",
        }}
      />
      <div className="absolute inset-x-0 bottom-0 z-[1] h-[min(32vh,300px)] w-full min-h-[160px] overflow-hidden">
        <LoginMountainBackdrop night={night} />
      </div>
      {/* Solo una tira en el borde físico: evita un píxel de monte; el negro bajo el perfil va en el degradado del Roque */}
      <div
        className="login-macizo-foot pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-3 w-full"
        aria-hidden="true"
      />
      <LoginRoqueSilhouette night={night} />
      <OceanWaves night={night} />
    </div>
  );
}

function OceanWaves({ night }: { night: boolean }) {
  const c1 = night
    ? "rgba(26, 40, 78, 0.48)"
    : "rgba(24, 48, 95, 0.4)";
  const c2 = night
    ? "rgba(20, 32, 64, 0.4)"
    : "rgba(20, 40, 85, 0.34)";
  const c3 = night
    ? "rgba(16, 26, 52, 0.34)"
    : "rgba(16, 34, 72, 0.28)";

  /* Each inner div is 200% wide so translateX(-50%) = one full viewport → seamless loop */
  return (
    <div
      className="login-ocean-horizon absolute left-0 right-0 pointer-events-none select-none overflow-hidden"
      style={{ bottom: loginOceanHorizonBottom }}
      aria-hidden="true"
    >
      {/* Wave 3 — back, slowest */}
      <div
        className="absolute bottom-0 left-0 w-[200%] h-full"
        style={{ animation: "wave-flow-3 14s linear infinite" }}
      >
        <svg viewBox="0 0 2 1" preserveAspectRatio="none" width="100%" height="112">
          <path
            d="M0,0.72 C0.25,0.45 0.5,0.88 0.75,0.68 C1,0.48 1.25,0.88 1.5,0.68 C1.75,0.48 2,0.82 2,0.72 L2,1 L0,1 Z"
            fill={c3}
          />
        </svg>
      </div>
      {/* Wave 2 — mid */}
      <div
        className="absolute bottom-0 left-0 w-[200%] h-full"
        style={{ animation: "wave-flow-2 10s linear infinite" }}
      >
        <svg viewBox="0 0 2 1" preserveAspectRatio="none" width="100%" height="112">
          <path
            d="M0,0.80 C0.22,0.55 0.5,0.92 0.78,0.76 C1.06,0.60 1.28,0.92 1.56,0.76 C1.78,0.62 2,0.88 2,0.80 L2,1 L0,1 Z"
            fill={c2}
          />
        </svg>
      </div>
      {/* Wave 1 — front, fastest */}
      <div
        className="absolute bottom-0 left-0 w-[200%] h-full"
        style={{ animation: "wave-flow-1 7s linear infinite" }}
      >
        <svg viewBox="0 0 2 1" preserveAspectRatio="none" width="100%" height="112">
          <path
            d="M0,0.86 C0.18,0.64 0.45,0.96 0.72,0.82 C0.98,0.68 1.22,0.96 1.5,0.82 C1.72,0.70 2,0.92 2,0.86 L2,1 L0,1 Z"
            fill={c1}
          />
        </svg>
      </div>
    </div>
  );
}

function WaveWipe() {
  return (
    <div
      className="login-wave-wipe fixed inset-0 z-[200]"
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[#060b18]" />
    </div>
  );
}

/* ── main page ──────────────────────────────────────────────────────────── */

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [microsoftLogin, setMicrosoftLogin] = useState(false);
  const [night, setNight] = useState(false);
  const [wiping, setWiping] = useState(false);
  const wipeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (wipeTimerRef.current !== null) clearTimeout(wipeTimerRef.current);
    };
  }, []);

  /* Detect night mode client-side to avoid hydration mismatch */
  useEffect(() => {
    startTransition(() => setNight(isNightHour()));
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/features");
        if (res.ok) {
          const d = (await res.json()) as { microsoftLogin?: boolean };
          setMicrosoftLogin(!!d.microsoftLogin);
        }
      } catch {
        setMicrosoftLogin(false);
      }
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      remember,
    });

    setLoading(false);

    if (result?.error) {
      setError("Credenciales incorrectas. Verifica tu email y contraseña.");
      return;
    }

    setWiping(true);
    wipeTimerRef.current = setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 620);
  }

  async function handleMicrosoft() {
    setLoading(true);
    setError(null);
    await signIn("microsoft-entra-id", { callbackUrl: "/dashboard" });
    setLoading(false);
  }

  return (
    <div
      data-login-page
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden p-4"
      style={{ backgroundColor: night ? "#060b18" : "#0a1628" }}
    >
      <LoginViewportScene night={night} />

      <div className="login-vignette fixed inset-0" aria-hidden="true" />

      {/* Login card — capa z-[1] por encima de .glass::after (textura z-0), que tapaba logo y campos */}
      <div className="glass login-card-premium w-full max-w-[22rem] rounded-[1.35rem] px-8 pb-9 pt-14 sm:pt-16 z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="relative z-[1]">
        {/* Logo + shimmer solo en la franja del logo (no cubre toda la tarjeta) */}
        <div className="relative flex flex-col items-center mb-9 w-full min-h-[10rem] pt-2">
          <div
            className="login-shimmer pointer-events-none absolute inset-x-3 top-4 h-[11rem] sm:h-[11.75rem] rounded-xl"
            aria-hidden="true"
          />
          <div className="relative z-10 w-full px-1 pt-1">
            <Logo
              size="lg"
              layout="stacked"
              showText
              showTagline={false}
              className="gap-5 sm:gap-6"
            />
          </div>
          <div className="relative z-10 mt-6 text-center space-y-1 max-w-[17rem] mx-auto px-1">
            <p className="text-sm text-white/55 leading-snug">{APP_TAGLINE}</p>
            <p className="text-[11px] text-white/35 font-medium uppercase tracking-wider">
              {APP_ORG}
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 flex items-start gap-2.5 p-3 rounded-lg bg-red-500/8 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="usuario@ccgrancanaria.es"
            icon={<Mail className="w-4 h-4" />}
            className="login-field"
            required
            autoComplete="email"
          />

          <Input
            label="Contraseña"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            icon={<Lock className="w-4 h-4" />}
            className="login-field"
            suffix={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-white/30 hover:text-white/60 transition-colors p-0.5 -m-0.5 rounded"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            }
            required
            autoComplete="current-password"
          />

          <div className="flex items-center gap-2.5">
            <input
              type="checkbox"
              id="remember"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="login-remember size-4 shrink-0 rounded-[5px] border border-white/[0.16] bg-[rgba(5,8,18,0.55)] accent-[#ffeb66] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffeb66]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070b14]"
            />
            <label htmlFor="remember" className="text-sm text-white/[0.68] tracking-wide">
              Recordar sesión
            </label>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            className="w-full mt-2 h-11 rounded-[11px] font-semibold shadow-[0_10px_36px_rgba(0,0,0,0.42)] ring-1 ring-[#ffeb66]/[0.22]"
          >
            Iniciar sesión
          </Button>

          {microsoftLogin && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/8" />
                </div>
                <div className="relative flex justify-center text-xs text-white/30">
                  <span className="px-2 bg-transparent">o continúa con</span>
                </div>
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={() => void handleMicrosoft()}
                className="w-full flex items-center justify-center gap-3 h-9 px-4 rounded-lg bg-white/8 border border-white/12 text-white text-sm hover:bg-white/12 transition-colors disabled:opacity-50"
              >
                <svg width="16" height="16" viewBox="0 0 21 21" fill="none">
                  <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                  <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                  <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                  <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
                </svg>
                Iniciar sesión con Microsoft
              </button>
            </>
          )}
        </form>
        </div>
      </div>

      <p className="text-white/35 text-[13px] leading-relaxed mt-7 z-10 text-center max-w-md px-4">
        CC Gran Canaria · Sistema de Gestión Operativa
      </p>

      {/* Wave-wipe transition overlay */}
      {wiping && <WaveWipe />}
    </div>
  );
}
