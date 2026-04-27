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

function RoqueNublo({ night }: { night: boolean }) {
  const fill = night ? "rgba(4,8,28,0.82)" : "rgba(3,10,30,0.7)";
  const fillMid = night ? "rgba(3,6,22,0.68)" : "rgba(2,8,24,0.55)";
  const fillFar = night ? "rgba(5,12,38,0.38)" : "rgba(4,10,32,0.28)";

  return (
    <svg
      viewBox="0 0 1440 320"
      preserveAspectRatio="xMidYMax slice"
      className="absolute bottom-0 left-0 w-full pointer-events-none select-none z-[1]"
      aria-hidden="true"
      style={{ marginBottom: "96px" }}
    >
      {/* Far mountains — lightest */}
      <path
        d="M0,320 L0,195 C120,178 250,200 380,185 C480,172 560,192 640,178 C720,165 820,188 940,172 C1060,157 1180,178 1300,165 C1380,155 1430,168 1440,165 L1440,320 Z"
        fill={fillFar}
      />
      {/* Mid mountains */}
      <path
        d="M0,320 L0,240 C80,225 180,248 300,232 C400,218 470,240 570,228 C640,218 680,235 720,228 C780,218 840,238 960,225 C1060,212 1180,235 1320,222 C1400,215 1435,228 1440,224 L1440,320 Z"
        fill={fillMid}
      />
      {/* Near plateau + Roque area */}
      <path
        d="M0,320 L0,278 C100,268 220,282 340,274 L362,268 L380,264 L400,261 L418,260 L436,260 L452,262 L470,266 L488,272 C540,265 620,272 720,268 C860,262 1000,278 1160,268 C1300,258 1400,272 1440,266 L1440,320 Z"
        fill={fill}
        opacity="0.9"
      />
      {/* Roque Nublo — thin vertical shaft */}
      <path
        d="M425,262 L423,134 L434,134 L432,262 Z"
        fill={fill}
      />
      {/* Roque Nublo — wide characteristic cap (table stone, tilted left) */}
      <path
        d="M399,138 L400,126 L404,115 L411,107 L421,101 L431,99 L441,102 L449,109 L454,119 L456,130 L457,138 Z"
        fill={fill}
      />
      {/* Roque del Fraile — shorter, blockier companion rock */}
      <path
        d="M469,267 L467,210 L465,202 L466,195 L471,191 L477,193 L480,200 L479,210 L477,267 Z"
        fill={fill}
        opacity="0.95"
      />
      {/* Foreground left land mass */}
      <path
        d="M0,320 L0,292 C80,286 180,296 300,288 L312,280 L326,276 L340,274 L340,280 L312,288 L200,300 L0,320 Z"
        fill={fill}
      />
      {/* Foreground right land mass */}
      <path
        d="M1440,320 L1440,292 C1360,286 1260,296 1140,288 L1128,280 L1114,276 L1100,274 L1100,280 L1128,288 L1240,300 L1440,320 Z"
        fill={fill}
      />
    </svg>
  );
}

function OceanWaves({ night }: { night: boolean }) {
  const c1 = night
    ? "rgba(8,18,58,0.62)"
    : "rgba(6,38,90,0.55)";
  const c2 = night
    ? "rgba(10,22,68,0.52)"
    : "rgba(8,48,105,0.45)";
  const c3 = night
    ? "rgba(5,14,48,0.42)"
    : "rgba(4,30,80,0.36)";

  /* Each inner div is 200% wide so translateX(-50%) = one full viewport → seamless loop */
  return (
    <div
      className="absolute bottom-0 left-0 right-0 h-28 pointer-events-none select-none overflow-hidden z-[2]"
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
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden p-4"
      style={{ backgroundColor: night ? "#060b18" : "#0a1628" }}
    >
      {/* Atmospheric gradients */}
      <div className={`absolute inset-0 pointer-events-none ${night ? "login-bg-night" : "login-bg-day"}`} />

      {/* Stars (night mode only) */}
      {night && (
        <div className="absolute inset-0 pointer-events-none login-stars" aria-hidden="true" />
      )}

      {/* Floating light orbs */}
      <div
        className="absolute top-[8%] left-[18%] w-[28rem] h-[28rem] rounded-full pointer-events-none"
        style={{
          background: night
            ? "radial-gradient(circle, rgba(28,55,130,0.35), transparent 70%)"
            : "radial-gradient(circle, rgba(15,75,150,0.32), transparent 70%)",
          filter: "blur(80px)",
          animation: "orb-drift-1 55s ease-in-out infinite",
        }}
      />
      <div
        className="absolute bottom-[18%] right-[12%] w-72 h-72 rounded-full pointer-events-none"
        style={{
          background: night
            ? "radial-gradient(circle, rgba(55,15,110,0.3), transparent 70%)"
            : "radial-gradient(circle, rgba(0,110,180,0.25), transparent 70%)",
          filter: "blur(70px)",
          animation: "orb-drift-2 68s ease-in-out infinite",
        }}
      />
      <div
        className="absolute top-[42%] right-[28%] w-56 h-56 rounded-full pointer-events-none"
        style={{
          background: night
            ? "radial-gradient(circle, rgba(255,235,102,0.06), transparent 70%)"
            : "radial-gradient(circle, rgba(255,235,102,0.10), transparent 70%)",
          filter: "blur(55px)",
          animation: "orb-drift-3 46s ease-in-out infinite",
        }}
      />

      {/* Roque Nublo silhouette */}
      <RoqueNublo night={night} />

      {/* Login card */}
      <div className="glass w-full max-w-sm rounded-2xl p-8 z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Logo with shimmer */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative">
            <Logo size="lg" showText={true} />
            <div className="login-shimmer absolute inset-0" aria-hidden="true" />
          </div>
          <p className="text-white/40 text-sm mt-3 text-center">
            {APP_TAGLINE} · {APP_ORG}
          </p>
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
            required
            autoComplete="email"
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-white/60 uppercase tracking-wide">
              Contraseña
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#ffeb66]/50 focus:bg-white/7 focus:ring-1 focus:ring-[#ffeb66]/40 transition-all duration-200 h-9 pl-9 pr-9"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="remember"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-3.5 h-3.5 rounded border border-white/20 bg-white/5 accent-[#ffeb66]"
            />
            <label htmlFor="remember" className="text-sm text-white/70">
              Recordar sesión
            </label>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            className="w-full mt-2"
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

      {/* Ocean waves */}
      <OceanWaves night={night} />

      <p className="text-white/20 text-xs mt-6 z-10">
        CC Gran Canaria · Sistema de Gestión Operativa
      </p>

      {/* Wave-wipe transition overlay */}
      {wiping && <WaveWipe />}
    </div>
  );
}
