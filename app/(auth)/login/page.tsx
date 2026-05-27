"use client";

import { useState, useEffect, useRef, startTransition, useCallback } from "react";
import { createPortal } from "react-dom";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  playCategory,
  setLocalPrefs,
  setUserSoundsCache,
  type SoundPreferences,
  type UserSoundLite,
} from "@/lib/notifications/sound-player";
import {
  Eye,
  EyeOff,
  Lock,
  AlertCircle,
  Loader2,
  ChevronDown,
  Check,
  User,
  Search,
  Building2,
  ArrowLeft,
  Sparkles,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { useTheme } from "@/components/layout/ThemeProvider";
import { APP_ORG, APP_TAGLINE } from "@/lib/app-brand";

/* ── types ──────────────────────────────────────────────────────────────── */

interface LoginUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

interface LoginDepartment {
  id: string;
  name: string;
  slug: string;
  accentColor: string;
  memberCount: number;
}

/* ── DepartmentPicker ───────────────────────────────────────────────────── */

function DepartmentPicker({
  departments,
  loading,
  loadError,
  onRetry,
  onSelect,
}: {
  departments: LoginDepartment[];
  loading: boolean;
  loadError?: boolean;
  onRetry?: () => void;
  onSelect: (dept: LoginDepartment) => void;
}) {
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && departments.length > 0) {
      setTimeout(() => searchRef.current?.focus(), 80);
    }
  }, [loading, departments.length]);

  const filtered = departments.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 text-white/20 animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="py-10 text-center px-1">
        <AlertCircle className="w-8 h-8 text-amber-400/70 mx-auto mb-3" />
        <p className="text-sm text-white/70 mb-1">No se pudo cargar el listado de departamentos</p>
        <p className="text-[11px] text-white/35 mb-4 leading-relaxed">
          Comprueba que PostgreSQL esté en marcha y que <span className="font-mono text-white/45">DATABASE_URL</span> en{" "}
          <span className="font-mono text-white/45">.env</span> sea correcta.
        </p>
        {onRetry && (
          <Button type="button" variant="secondary" size="sm" onClick={onRetry} className="mx-auto">
            Reintentar
          </Button>
        )}
      </div>
    );
  }

  if (departments.length === 0) {
    return (
      <div className="py-10 text-center">
        <Building2 className="w-8 h-8 text-white/15 mx-auto mb-3" />
        <p className="text-sm text-white/30">Sin departamentos disponibles</p>
      </div>
    );
  }

  return (
    <div>
      {/* Search — solo si hay muchos depts */}
      {departments.length > 4 && (
        <div className="mb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar departamento…"
              className="w-full bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 h-9 pl-9 pr-3 focus:outline-none focus:border-white/20 transition-colors"
            />
          </div>
        </div>
      )}

      {/* Lista — sin panel wrapper, sobre el glass de la card */}
      <ul>
        {/* Label integrado como primer separador */}
        <li
          className="flex items-center gap-3 mb-1"
          aria-hidden="true"
        >
          <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.07)" }} />
          <span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-white/25">
            Departamento
          </span>
          <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.07)" }} />
        </li>

        {filtered.length === 0 ? (
          <li className="py-6 text-center text-xs text-white/25">Sin resultados</li>
        ) : (
          filtered.map((dept, i) => {
            const a = dept.accentColor;
            return (
              <li key={dept.id}>
                {/* Separador entre items */}
                {i > 0 && (
                  <div className="h-px mx-1" style={{ background: "rgba(255,255,255,0.05)" }} />
                )}
                <button
                  type="button"
                  onClick={() => onSelect(dept)}
                  className="group w-full flex items-center gap-4 px-1 py-3.5 cursor-pointer select-none transition-all duration-150 rounded-lg"
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  {/* Avatar con fondo sólido coloreado */}
                  <div
                    className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold select-none"
                    style={{
                      background: a,
                      color: "#000",
                      opacity: 0.9,
                    }}
                  >
                    {dept.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Nombre + miembros */}
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-white/85 group-hover:text-white transition-colors truncate leading-tight">
                      {dept.name}
                    </p>
                    <p className="text-[11px] text-white/30 mt-0.5">
                      {dept.memberCount} miembro{dept.memberCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

/* ── UserPicker ─────────────────────────────────────────────────────────── */

const GOLD = "#ffeb66";

function UserPicker({
  users,
  value,
  onChange,
  loading,
  disabled,
  uiLight = false,
}: {
  users: LoginUser[];
  value: string;
  onChange: (email: string) => void;
  loading: boolean;
  disabled?: boolean;
  /** Panel del portal (body): en tema claro debe coincidir con la tarjeta, no forzar oscuro. */
  uiLight?: boolean;
}) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState("");
  const [pos, setPos]       = useState<React.CSSProperties>({});
  const [mounted, setMounted] = useState(false);
  const btnRef    = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = users.find((u) => u.email === value) ?? null;
  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => { setMounted(true); }, []);

  function recalc() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ position: "fixed", top: r.bottom + 4, left: r.left, width: r.width, zIndex: 9999 });
  }

  useEffect(() => {
    if (!open) { setSearch(""); return; }
    recalc();
    setTimeout(() => searchRef.current?.focus(), 60);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", recalc, true);
    window.addEventListener("resize", recalc);
    return () => {
      window.removeEventListener("scroll", recalc, true);
      window.removeEventListener("resize", recalc);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onOut(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || document.getElementById("upp")?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onOut);
    return () => document.removeEventListener("mousedown", onOut);
  }, [open]);

  /* ── render ── */
  const panel = open && mounted && (
    createPortal(
      <div
        id="upp"
        style={{
          ...pos,
          borderRadius: "12px",
          overflow: "hidden",
          animation: "upp-in 0.18s cubic-bezier(0.16,1,0.3,1) both",
          ...(uiLight
            ? {
                background: "linear-gradient(180deg, #fafafa 0%, #f4f4f5 100%)",
                border: "1px solid rgba(228, 228, 231, 0.95)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.9), 0 12px 40px rgba(15,23,42,0.12), 0 4px 12px rgba(15,23,42,0.06)",
              }
            : {
                background: "rgba(8,13,28,0.97)",
                border: "1px solid rgba(255,255,255,0.10)",
                boxShadow:
                  "0 24px 60px rgba(0,0,0,0.8), 0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
              }),
        }}
      >
        <style>{`
          @keyframes upp-in {
            from { opacity:0; transform:translateY(-4px) scale(0.99); }
            to   { opacity:1; transform:translateY(0)   scale(1);     }
          }
          #upp .upp-list::-webkit-scrollbar { width:3px; }
          #upp .upp-list::-webkit-scrollbar-track { background:transparent; }
          #upp .upp-list::-webkit-scrollbar-thumb { background:${uiLight ? "rgba(161,161,170,0.45)" : "rgba(255,235,102,0.2)"}; border-radius:4px; }
        `}</style>

        {/* Buscador */}
        <div
          className="p-2"
          style={{
            borderBottom: uiLight
              ? "1px solid rgba(228,228,231,0.9)"
              : "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="relative">
            <Search
              className={
                uiLight
                  ? "absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none"
                  : "absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none"
              }
            />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar usuario…"
              className={
                uiLight
                  ? "w-full bg-white border border-zinc-200 rounded-lg text-sm text-zinc-900 placeholder:text-zinc-400 h-9 pl-9 pr-3 focus:outline-none focus:border-amber-400/70 focus:ring-1 focus:ring-amber-400/25 transition-all duration-200"
                  : "w-full bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 h-9 pl-9 pr-3 focus:outline-none focus:border-white/20 transition-all duration-200"
              }
            />
          </div>
        </div>

        {/* Lista */}
        <ul role="listbox" className="upp-list" style={{ maxHeight:"14rem", overflowY:"auto", padding:"4px" }}>
          {filtered.length === 0 ? (
            <li
              className={
                uiLight
                  ? "py-8 text-center text-xs text-zinc-400 tracking-wide"
                  : "py-8 text-center text-xs text-white/25 tracking-wide"
              }
            >
              Sin resultados
            </li>
          ) : filtered.map((u) => {
            const sel = u.email === value;
            const selBg = uiLight
              ? "rgba(254, 243, 199, 0.95)"
              : "rgba(255,235,102,0.08)";
            const selBorder = uiLight
              ? "1px solid rgba(251, 191, 36, 0.45)"
              : "1px solid rgba(255,235,102,0.15)";
            const hoverBg = uiLight ? "rgba(244, 244, 245, 1)" : "rgba(255,255,255,0.05)";
            return (
              <li
                key={u.id}
                role="option"
                aria-selected={sel}
                onClick={() => { onChange(u.email); setOpen(false); }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer select-none transition-colors duration-100"
                style={{
                  background: sel ? selBg : "transparent",
                  border: sel ? selBorder : "1px solid transparent",
                  marginBottom: "1px",
                }}
                onMouseEnter={(e) => {
                  if (!sel) (e.currentTarget as HTMLElement).style.background = hoverBg;
                }}
                onMouseLeave={(e) => {
                  if (!sel) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {/* Avatar */}
                <div style={{
                  flexShrink:0, borderRadius:"50%", padding:"2px",
                  background: sel
                    ? uiLight
                      ? "linear-gradient(135deg, rgba(251,191,36,0.35), rgba(254,243,199,0.5))"
                      : `linear-gradient(135deg, rgba(255,235,102,0.5), rgba(255,235,102,0.15))`
                    : "transparent",
                }}>
                  <Avatar name={u.name} image={u.image} size="sm" />
                </div>

                {/* Nombre + email */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm truncate leading-tight"
                    style={{
                      fontWeight: sel ? 600 : 500,
                      color: sel
                        ? uiLight
                          ? "#18181b"
                          : "#fff"
                        : uiLight
                          ? "rgba(24,24,27,0.88)"
                          : "rgba(255,255,255,0.75)",
                    }}
                  >
                    {u.name}
                  </p>
                  <p
                    className="text-[11px] truncate mt-0.5"
                    style={{
                      color: sel
                        ? uiLight
                          ? "#52525b"
                          : "rgba(255,235,102,0.5)"
                        : uiLight
                          ? "#71717a"
                          : "rgba(255,255,255,0.3)",
                    }}
                  >
                    {u.email}
                  </p>
                </div>

                {/* Check */}
                {sel && (
                  <span
                    className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{
                      background: uiLight
                        ? "rgba(251, 191, 36, 0.2)"
                        : "rgba(255,235,102,0.15)",
                    }}
                  >
                    <Check
                      className="w-2.5 h-2.5"
                      style={{
                        color: uiLight ? "#b45309" : GOLD,
                        strokeWidth: 3,
                      }}
                    />
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        {/* Pie */}
        <div
          className="px-3 py-1.5 text-center"
          style={{
            borderTop: uiLight
              ? "1px solid rgba(228,228,231,0.85)"
              : "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <span
            className={
              uiLight
                ? "text-[10px] text-zinc-400 tracking-wide"
                : "text-[10px] text-white/20 tracking-wide"
            }
          >
            {users.length} usuario{users.length !== 1 ? "s" : ""} disponible{users.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>,
      document.body
    )
  );

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-white/60 uppercase tracking-wide">
        Usuario
      </label>

      <div className="relative overflow-hidden rounded-lg">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none z-10 flex items-center justify-center shrink-0">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : selected ? (
            <Avatar name={selected.name} image={selected.image} size="xs" />
          ) : (
            <User className="w-4 h-4" />
          )}
        </div>

        <button
          ref={btnRef}
          type="button"
          disabled={disabled || loading}
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={[
            "login-field w-full bg-white/5 border border-white/10 rounded-lg text-sm text-left",
            /* pl-12: margen claro entre avatar / icono y el nombre */
            "transition-all duration-200 h-9 pl-12 pr-9",
            "focus:outline-none focus:border-[#ffeb66]/50 focus:bg-white/[0.07] focus:ring-1 focus:ring-[#ffeb66]/40",
            "disabled:opacity-40",
            open ? "border-[#ffeb66]/50 bg-white/[0.07] ring-1 ring-[#ffeb66]/40" : "",
          ].join(" ")}
        >
          <span className={`truncate block ${selected ? "text-white" : "text-white/30"}`}>
            {loading ? "Cargando…" : selected ? selected.name : "Selecciona tu usuario"}
          </span>
        </button>

        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <ChevronDown
            className="w-4 h-4 transition-transform duration-200 text-white/40"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", color: open ? "rgba(255,235,102,0.55)" : undefined }}
          />
        </div>

        <span className="input-focus-bar" aria-hidden="true" />
      </div>
      {panel}
    </div>
  );
}

/* ── constants ──────────────────────────────────────────────────────────── */

const LOCK_SECONDS = 30;
const MAX_ATTEMPTS = 3;
const STORAGE_LOCK = "login:lockUntil";
const STORAGE_ATTEMPTS = "login:attempts";

/* ── helpers ────────────────────────────────────────────────────────────── */

function isNightHour() {
  const h = new Date().getHours();
  return h >= 20 || h < 7;
}


/* ── sub-components ─────────────────────────────────────────────────────── */

/** Paisaje lejano + silueta muy suave del Teide (Tenerife) al fondo, típica en días claros. */
function LoginMountainBackdrop({ night, uiLight }: { night: boolean; uiLight: boolean }) {
  /* Tema UI claro: una sola familia de tonos oscuros (evita gris “por delante” del Roque negro) */
  const fillFar = uiLight
    ? "rgba(5,10,22,0.78)"
    : night
      ? "rgba(5,12,38,0.42)"
      : "rgba(4,10,32,0.3)";
  const fillMid = uiLight
    ? "rgba(4,8,18,0.86)"
    : night
      ? "rgba(3,6,22,0.72)"
      : "rgba(2,8,24,0.58)";
  const fill = uiLight
    ? "rgba(2,5,12,0.92)"
    : night
      ? "rgba(4,8,28,0.88)"
      : "rgba(3,10,30,0.74)";
  const teideFill = uiLight
    ? "rgba(18, 32, 58, 0.55)"
    : night
      ? "rgba(36, 48, 88, 0.85)"
      : "rgba(40, 72, 120, 0.7)";
  const teideOp = uiLight ? 0.28 : night ? 0.48 : 0.34;

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

/** Macizo alto para que la silueta llegue abajo, sin tapar todo el cielo (el relleno arriba debe ser transparente) */
const loginRoqueBand = "min(78vh, 920px)";
const loginOceanHorizonBottom = "min(46vh, 480px)";

function LoginRoqueSilhouette({ night, uiLight, lite }: { night: boolean; uiLight: boolean; lite: boolean }) {
  /* Negro sólido abajo + transparencia arriba: por los huecos del PNG se ve el cielo; #000 opaco en toda la franja tapaba todo */
  const roqueStageBg =
    "linear-gradient(to top, #000000 0%, #000000 26%, rgba(0,0,0,0.94) 38%, rgba(0,0,0,0.42) 52%, transparent 64%)";

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-[4] w-full overflow-hidden max-h-[min(88vh,960px)]"
      style={{ height: loginRoqueBand, background: roqueStageBg }}
      aria-hidden="true"
    >
      <div className="login-roque-stack relative h-full w-full">
        {/* Halo borroso: en tema UI claro se omite (evita doble silueta gris). En modo ligero también se omite (blur muy costoso). */}
        {!uiLight && !lite && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={roqueImg}
              alt=""
              className={`login-roque-bloom absolute inset-0 h-full w-full min-w-full max-w-none object-cover object-left-bottom ${night ? "login-roque-bloom-night" : "opacity-90"}`}
            />
          </>
        )}
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

function LoginViewportScene({
  night,
  uiLight,
  lite,
}: {
  night: boolean;
  uiLight: boolean;
  /** Modo ligero: oculta capas animadas/decorativas costosas (estrellas,
   * nubes, orbes flotantes, olas, vía láctea, "sky live", halo del Roque),
   * pero mantiene la atmósfera base (cielo + montañas + Roque + viñeta). */
  lite: boolean;
}) {
  return (
    <div
      className="login-viewport-scene fixed inset-0 z-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      <div className={`absolute inset-0 ${night ? "login-bg-night" : "login-bg-day"}`} />
      {!lite && uiLight && (
        <div
          className="login-sky-live absolute inset-0 z-0 pointer-events-none"
          aria-hidden="true"
        />
      )}
      {/* Estrellas y Vía Láctea / nubes: solo en franja nocturna local (ver isNightHour en la página) */}
      {!lite && night && <div className="absolute inset-0 login-stars" aria-hidden="true" />}
      {!lite && night && <div className="absolute inset-0 login-milky-hint" />}
      {!lite && night && <div className="login-clouds" aria-hidden="true" />}
      {!lite && (
        <div className="login-orbs absolute inset-0 pointer-events-none" aria-hidden="true">
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
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 z-[1] h-[min(32vh,300px)] w-full min-h-[160px] overflow-hidden">
        <LoginMountainBackdrop night={night} uiLight={uiLight} />
      </div>
      <div
        className="login-macizo-foot pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-3 w-full"
        aria-hidden="true"
      />
      <LoginRoqueSilhouette night={night} uiLight={uiLight} lite={lite} />
      {!lite && <OceanWaves night={night} uiLight={uiLight} />}
    </div>
  );
}

function OceanWaves({ night, uiLight }: { night: boolean; uiLight: boolean }) {
  const c1 = uiLight
    ? "rgba(175, 205, 232, 0.42)"
    : night
      ? "rgba(26, 40, 78, 0.48)"
      : "rgba(24, 48, 95, 0.4)";
  const c2 = uiLight
    ? "rgba(155, 190, 225, 0.36)"
    : night
      ? "rgba(20, 32, 64, 0.4)"
      : "rgba(20, 40, 85, 0.34)";
  const c3 = uiLight
    ? "rgba(135, 175, 215, 0.32)"
    : night
      ? "rgba(16, 26, 52, 0.34)"
      : "rgba(16, 34, 72, 0.28)";

  return (
    <div
      className="login-ocean-horizon absolute left-0 right-0 pointer-events-none select-none overflow-hidden"
      style={{ bottom: loginOceanHorizonBottom }}
      aria-hidden="true"
    >
      <div className="absolute bottom-0 left-0 w-[200%] h-full" style={{ animation: "wave-flow-3 14s linear infinite" }}>
        <svg viewBox="0 0 2 1" preserveAspectRatio="none" width="100%" height="112">
          <path d="M0,0.72 C0.25,0.45 0.5,0.88 0.75,0.68 C1,0.48 1.25,0.88 1.5,0.68 C1.75,0.48 2,0.82 2,0.72 L2,1 L0,1 Z" fill={c3} />
        </svg>
      </div>
      <div className="absolute bottom-0 left-0 w-[200%] h-full" style={{ animation: "wave-flow-2 10s linear infinite" }}>
        <svg viewBox="0 0 2 1" preserveAspectRatio="none" width="100%" height="112">
          <path d="M0,0.80 C0.22,0.55 0.5,0.92 0.78,0.76 C1.06,0.60 1.28,0.92 1.56,0.76 C1.78,0.62 2,0.88 2,0.80 L2,1 L0,1 Z" fill={c2} />
        </svg>
      </div>
      <div className="absolute bottom-0 left-0 w-[200%] h-full" style={{ animation: "wave-flow-1 7s linear infinite" }}>
        <svg viewBox="0 0 2 1" preserveAspectRatio="none" width="100%" height="112">
          <path d="M0,0.86 C0.18,0.64 0.45,0.96 0.72,0.82 C0.98,0.68 1.22,0.96 1.5,0.82 C1.72,0.70 2,0.92 2,0.86 L2,1 L0,1 Z" fill={c1} />
        </svg>
      </div>
    </div>
  );
}

/* L10 — Canary Islands clock */
function CanaryTime() {
  const [time, setTime] = useState("");

  useEffect(() => {
    function tick() {
      try {
        setTime(
          new Intl.DateTimeFormat("es", {
            timeZone: "Atlantic/Canary",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date())
        );
      } catch {
        setTime("");
      }
    }
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  if (!time) return null;

  return (
    <p className="text-white/20 text-[11px] tabular-nums">
      {time} · Islas Canarias
    </p>
  );
}

/* L8 — Enhanced wave-wipe with status text */
function WaveWipe() {
  return (
    <div className="login-wave-wipe fixed inset-0 z-[200]" aria-hidden="true">
      <div className="absolute inset-0 bg-[#060b18]" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <div className="w-5 h-5 border-2 border-white/20 border-t-[#ffeb66] rounded-full animate-spin" />
        <p className="text-white/40 text-sm animate-in fade-in delay-150 duration-500">
          Accediendo al sistema…
        </p>
      </div>
    </div>
  );
}

/* ── main page ──────────────────────────────────────────────────────────── */

type LoginPhase = "idle" | "checking" | "redirecting";

export default function LoginPage() {
  const { theme } = useTheme();
  const uiLight = theme === "light";
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember]         = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [microsoftLogin, setMicrosoftLogin] = useState(false);
  /** null hasta hidratar en cliente; evita parpadeo día↔noche en el primer paint */
  const [night, setNight]               = useState<boolean | null>(null);
  const [wiping, setWiping]             = useState(false);

  /* Sprint 1 state */
  const [loginPhase, setLoginPhase]     = useState<LoginPhase>("idle");
  const [capsLock, setCapsLock]         = useState(false);
  const [isShaking, setIsShaking]       = useState(false);
  const [attempts, setAttempts]         = useState(0);
  const [lockCountdown, setLockCountdown] = useState(0);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  /* Step 1 — department picker */
  const [loginStep, setLoginStep]       = useState<"department" | "credentials">("department");
  const [departments, setDepartments]   = useState<LoginDepartment[]>([]);
  const [deptsLoading, setDeptsLoading] = useState(true);
  const [deptsLoadError, setDeptsLoadError] = useState(false);
  const [selectedDept, setSelectedDept] = useState<LoginDepartment | null>(null);

  /* Step 2 — users for selected department */
  const [loginUsers, setLoginUsers]     = useState<LoginUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  /* Toggle de efectos visuales del login (para PCs lentos). El layout
   * inyecta un script previo a la hidratación que marca
   * `<html data-login-effects="off">`. Aquí mantenemos el estado React
   * sincronizado para condicionar listeners y clases CSS. */
  const [effectsEnabled, setEffectsEnabled] = useState(true);

  /* L5 — cursor parallax light */
  const cursorOverlayRef = useRef<HTMLDivElement>(null);

  const wipeTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  /* cleanup */
  useEffect(() => {
    return () => {
      if (wipeTimerRef.current !== null) clearTimeout(wipeTimerRef.current);
      if (countdownRef.current !== null) clearInterval(countdownRef.current);
    };
  }, []);

  function startCountdown(initial?: number) {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (initial !== undefined) setLockCountdown(initial);
    countdownRef.current = setInterval(() => {
      setLockCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          countdownRef.current = null;
          try {
            localStorage.removeItem(STORAGE_LOCK);
            localStorage.removeItem(STORAGE_ATTEMPTS);
          } catch { }
          setAttempts(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function triggerLock() {
    const until = Date.now() + LOCK_SECONDS * 1000;
    try { localStorage.setItem(STORAGE_LOCK, String(until)); } catch { }
    startCountdown(LOCK_SECONDS);
  }

  /* Día / noche según la hora real del dispositivo; se actualiza cada minuto y al volver a la pestaña */
  useEffect(() => {
    function syncNight() {
      startTransition(() => setNight(isNightHour()));
    }
    syncNight();
    const intervalId = window.setInterval(syncNight, 60_000);
    function onVisible() {
      if (document.visibilityState === "visible") syncNight();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  /* L14 — session expired message via URL param */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reason") === "session_expired") {
      setSessionMessage("Tu sesión ha expirado. Inicia sesión de nuevo.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  /* Hidrata la preferencia de efectos visuales desde localStorage. */
  useEffect(() => {
    try {
      const stored = localStorage.getItem("cc-ops-login-effects");
      setEffectsEnabled(stored === null ? true : stored !== "0");
    } catch {
      /* localStorage bloqueado: efectos activos por defecto */
    }
  }, []);

  function toggleEffects() {
    setEffectsEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("cc-ops-login-effects", next ? "1" : "0");
        if (next) {
          delete document.documentElement.dataset.loginEffects;
        } else {
          document.documentElement.dataset.loginEffects = "off";
        }
      } catch {
        /* localStorage bloqueado */
      }
      return next;
    });
  }

  /* L24 — restore lockout state from localStorage */
  useEffect(() => {
    try {
      const lockUntil  = parseInt(localStorage.getItem(STORAGE_LOCK) ?? "0", 10);
      const savedAttempts = parseInt(localStorage.getItem(STORAGE_ATTEMPTS) ?? "0", 10);
      setAttempts(savedAttempts);
      const remaining = Math.ceil((lockUntil - Date.now()) / 1000);
      if (remaining > 0) {
        setLockCountdown(remaining);
        startCountdown(remaining);
      }
    } catch { /* localStorage unavailable */ }
  }, []);

  /* feature flags */
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

  /* L5 — mouse parallax ambient light (direct DOM mutation, no React re-render) */
  useEffect(() => {
    if (!effectsEnabled) return;
    const overlay = cursorOverlayRef.current;
    if (!overlay) return;
    function onMouseMove(e: MouseEvent) {
      const x = ((e.clientX / window.innerWidth) * 100).toFixed(1);
      const y = ((e.clientY / window.innerHeight) * 100).toFixed(1);
      overlay!.style.background = `radial-gradient(ellipse 38% 42% at ${x}% ${y}%, rgba(255,235,102,0.038), transparent 65%)`;
    }
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    return () => {
      overlay.style.background = "";
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [effectsEnabled]);

  const loadDepartments = useCallback(async () => {
    setDeptsLoading(true);
    setDeptsLoadError(false);
    try {
      const res = await fetch("/api/login-departments");
      if (res.ok) {
        setDepartments(await res.json());
      } else {
        setDepartments([]);
        setDeptsLoadError(true);
      }
    } catch {
      setDepartments([]);
      setDeptsLoadError(true);
    } finally {
      setDeptsLoading(false);
    }
  }, []);

  /* Load departments for step 1 */
  useEffect(() => {
    void loadDepartments();
  }, [loadDepartments]);

  /* L19 — focus trap inside form */
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const focusable = Array.from(
        form!.querySelectorAll<HTMLElement>("input:not([disabled]), button:not([disabled])")
      );
      if (focusable.length < 2) return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  /* L3 — shake animation via double-rAF to force CSS re-trigger */
  const triggerShake = useCallback(() => {
    setIsShaking(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsShaking(true));
    });
  }, []);

  /* ── submit ── */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lockCountdown > 0) return;

    if (!email) {
      setError("Selecciona un usuario para continuar.");
      triggerShake();
      return;
    }

    setLoginPhase("checking");
    setError(null);
    setSessionMessage(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      remember,
    });

    if (result?.error) {
      // Auth.js codifica el motivo en result.error. Los más comunes:
      //   - "CredentialsSignin": email/password no coinciden.
      //   - "MissingCSRF" / "MissingCsrf": cookie CSRF no llegó.
      //   - "Configuration": problema interno del servidor (secreto, etc).
      // Mostramos un mensaje útil sin "tragar" CSRF como si fuera password.
      const isCsrf = /csrf/i.test(result.error);
      const isConfig = /configuration/i.test(result.error);

      setLoginPhase("idle");
      triggerShake();

      if (isCsrf) {
        setError(
          "El navegador no envió la cookie de seguridad (CSRF). Recarga la página con Ctrl+F5 y vuelve a intentarlo. Si persiste, prueba en una ventana privada."
        );
        return;
      }
      if (isConfig) {
        setError(
          "Error de configuración del servidor. Avisa al administrador (detalle técnico: Configuration)."
        );
        return;
      }

      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      try { localStorage.setItem(STORAGE_ATTEMPTS, String(newAttempts)); } catch { }

      if (newAttempts >= MAX_ATTEMPTS) {
        triggerLock();
        try { localStorage.removeItem(STORAGE_ATTEMPTS); } catch { }
        setAttempts(0);
        setError(`Demasiados intentos fallidos. Espera ${LOCK_SECONDS} segundos para volver a intentarlo.`);
      } else {
        const remaining = MAX_ATTEMPTS - newAttempts;
        setError(
          remaining === 1
            ? "Credenciales incorrectas. Este es tu último intento antes del bloqueo temporal."
            : "Contraseña incorrecta. Verifica e inténtalo de nuevo."
        );
      }
      return;
    }

    /* success */
    try {
      localStorage.removeItem(STORAGE_LOCK);
      localStorage.removeItem(STORAGE_ATTEMPTS);
    } catch { }
    setAttempts(0);

    // Sonido de bienvenida: hay que tener cuidado con un detalle sutil. El
    // cache local de preferencias (`sound-prefs-v1`), la biblioteca de
    // audios del usuario (`user-sounds-cache-v1`) y el toggle del chat
    // (`chat-sound-enabled`) viven en localStorage, que es POR ORIGEN, no
    // por usuario. Si el usuario anterior dejó configurado un sonido y
    // ahora entra otra persona en el mismo navegador, sonaría el sonido
    // del anterior.
    //
    // Antes de reproducir nada, descartamos cualquier cache previo y
    // cargamos las preferencias del usuario que acaba de iniciar sesión
    // (la cookie de sesión ya está set tras `signIn`). Limitamos el fetch
    // a 800ms para no bloquear el login si el servidor tarda; pasada esa
    // ventana sonará el preset por defecto del sistema.
    try {
      setLocalPrefs({});
      setUserSoundsCache([]);
      window.localStorage.removeItem("chat-sound-enabled");
    } catch { /* localStorage bloqueado */ }
    try {
      const ac = new AbortController();
      const to = setTimeout(() => ac.abort(), 800);
      const r = await fetch("/api/me/sounds", {
        cache: "no-store",
        signal: ac.signal,
      }).catch(() => null);
      clearTimeout(to);
      if (r && r.ok) {
        const data = (await r.json()) as {
          sounds?: UserSoundLite[];
          preferences?: SoundPreferences;
        };
        setUserSoundsCache(data.sounds ?? []);
        setLocalPrefs(data.preferences ?? {});
      }
    } catch {
      /* sin red o timeout: caemos al preset por defecto */
    }

    setLoginPhase("redirecting");
    setWiping(true);
    try {
      playCategory("login");
    } catch {
      /* AudioContext sin gesto previo en algunos navegadores */
    }
    wipeTimerRef.current = setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 620);
  }

  async function handleMicrosoft() {
    setLoginPhase("checking");
    setError(null);
    await signIn("microsoft-entra-id", { callbackUrl: "/dashboard" });
    setLoginPhase("idle");
  }

  async function selectDepartment(dept: LoginDepartment) {
    setSelectedDept(dept);
    setLoginStep("credentials");
    setEmail("");
    setUsersLoading(true);
    try {
      const res = await fetch(`/api/login-users?departmentId=${dept.id}`);
      if (res.ok) setLoginUsers(await res.json());
    } catch { /* ignore */ } finally {
      setUsersLoading(false);
    }
  }

  function backToDepts() {
    setLoginStep("department");
    setSelectedDept(null);
    setLoginUsers([]);
    setEmail("");
    setPassword("");
    setError(null);
  }

  const isLocked = lockCountdown > 0;
  const isLoading = loginPhase !== "idle";

  return (
    <div
      data-login-page
      data-login-effects={effectsEnabled ? undefined : "off"}
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden p-4"
      style={{ backgroundColor: (night ?? false) ? "#060b18" : "#0a1628" }}
    >
      {/* Escena de fondo: cielo, montañas, Roque y viñeta siempre presentes.
       * Las capas animadas/decorativas (estrellas, nubes, orbes, olas, halo
       * del Roque…) se ocultan en modo ligero pasando `lite`. */}
      <LoginViewportScene night={night ?? false} uiLight={uiLight} lite={!effectsEnabled} />
      <div className="login-vignette fixed inset-0" aria-hidden="true" />

      {/* L5 — ambient cursor parallax light layer (solo con efectos activos) */}
      {effectsEnabled && (
        <div
          ref={cursorOverlayRef}
          className="fixed inset-0 z-[7] pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* L14 — session expired banner */}
      {sessionMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl glass-2 border border-amber-500/20 text-amber-300 text-sm animate-in fade-in slide-in-from-top-2 duration-300 shadow-lg"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{sessionMessage}</span>
          <button
            type="button"
            onClick={() => setSessionMessage(null)}
            className="ml-2 text-amber-300/50 hover:text-amber-300 transition-colors text-lg leading-none"
            aria-label="Cerrar aviso"
          >
            ×
          </button>
        </div>
      )}

      {/* Login card — L3 shake + L7 ambient glow + L23 responsive padding.
       * En modo ligero se sustituye `glass` (backdrop-filter caro) por una
       * variante opaca con la misma estética. */}
      <div
        className={`${effectsEnabled ? "glass " : ""}login-card-premium${effectsEnabled ? "" : " login-card-premium--lite"} w-full max-w-[calc(100vw-2rem)] sm:max-w-[22rem] rounded-[1.35rem] px-5 sm:px-8 pb-8 sm:pb-9 pt-12 sm:pt-16 z-10 ${effectsEnabled ? "animate-in fade-in slide-in-from-bottom-4 duration-500" : ""}${isShaking ? " login-shake" : ""}`}
        onAnimationEnd={(e) => {
          if (e.animationName === "login-shake") setIsShaking(false);
        }}
      >
        <div className="relative z-[1]">
          {/* Logo section */}
          <div className="relative flex flex-col items-center mb-9 w-full min-h-[10rem] pt-2">
            {effectsEnabled && (
              <div
                className="login-shimmer pointer-events-none absolute inset-x-3 top-4 h-[11rem] sm:h-[11.75rem] rounded-xl"
                aria-hidden="true"
              />
            )}
            {/* L2 — logo power-on entrance */}
            <div className={`relative z-10 w-full px-1 pt-1 ${effectsEnabled ? "login-logo-power-on" : ""}`}>
              <Logo size="lg" layout="stacked" showText showTagline={false} className="gap-5 sm:gap-6" />
            </div>
            <div className="relative z-10 mt-6 text-center space-y-1 max-w-[17rem] mx-auto px-1">
              <p className="text-sm text-white/55 leading-snug">{APP_TAGLINE}</p>
              <p className="text-[11px] text-white/35 font-medium uppercase tracking-wider">{APP_ORG}</p>
            </div>
          </div>

          {/* ── Step 1: Department selector ── */}
          {loginStep === "department" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <DepartmentPicker
                departments={departments}
                loading={deptsLoading}
                loadError={deptsLoadError}
                onRetry={() => void loadDepartments()}
                onSelect={(dept) => void selectDepartment(dept)}
              />
            </div>
          )}

          {/* ── Step 2: Credentials ── */}
          {loginStep === "credentials" && selectedDept && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Department back pill */}
              <button
                type="button"
                onClick={backToDepts}
                className="flex items-center gap-2 mb-5 group"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-white/30 group-hover:text-white/60 transition-colors" />
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all duration-150 group-hover:opacity-75"
                  style={{
                    background: `${selectedDept.accentColor}18`,
                    borderColor: `${selectedDept.accentColor}35`,
                    color: selectedDept.accentColor,
                  }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: selectedDept.accentColor }}
                  />
                  {selectedDept.name}
                </div>
              </button>

              {/* L20 — aria-live error region */}
              {error && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="mb-4 flex items-start gap-2.5 p-3 rounded-lg bg-red-500/8 border border-red-500/20 text-red-400 text-sm animate-in fade-in duration-200"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Form */}
              <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">

                {/* User picker */}
                <div className="login-field-enter" style={{ animationDelay: "80ms" }}>
                  <UserPicker
                    users={loginUsers}
                    value={email}
                    onChange={setEmail}
                    loading={usersLoading}
                    disabled={isLoading || isLocked}
                    uiLight={uiLight}
                  />
                </div>

                {/* Password */}
                <div className="login-field-enter" style={{ animationDelay: "150ms" }}>
                  <div className="flex flex-col gap-1">
                    <Input
                      label="Contraseña"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => setCapsLock(e.getModifierState("CapsLock"))}
                      onKeyUp={(e)   => setCapsLock(e.getModifierState("CapsLock"))}
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
                          <span
                            key={showPassword ? "show" : "hide"}
                            className="block animate-in fade-in zoom-in-75 duration-150"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </span>
                        </button>
                      }
                      required
                      autoComplete="current-password"
                    />

                    {capsLock && (
                      <p
                        role="status"
                        className="text-xs text-amber-400 flex items-center gap-1.5 animate-in fade-in duration-200 pt-0.5"
                      >
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        Mayúsculas activadas
                      </p>
                    )}

                    <p className="text-[11px] text-white/30 mt-0.5">
                      ¿No recuerdas la contraseña? Contacta con tu administrador.
                    </p>
                  </div>
                </div>

                {/* Remember */}
                <div className="login-field-enter" style={{ animationDelay: "220ms" }}>
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      id="remember"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="login-remember size-4 shrink-0 rounded-[5px] border border-white/[0.16] bg-[rgba(5,8,18,0.55)] accent-[#ffeb66] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffeb66]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070b14] mt-0.5"
                    />
                    <div>
                      <label htmlFor="remember" className="text-sm text-white/[0.68] tracking-wide cursor-pointer">
                        Recordar sesión
                      </label>
                      {remember && (
                        <p className="text-[11px] text-white/40 animate-in fade-in duration-200 mt-0.5">
                          Tu sesión se mantendrá activa 30 días
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Submit */}
                <div className="login-field-enter" style={{ animationDelay: "280ms" }}>
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    disabled={isLoading || isLocked}
                    className="w-full mt-2 h-11 rounded-[11px] font-semibold shadow-[0_10px_36px_rgba(0,0,0,0.42)] ring-1 ring-[#ffeb66]/[0.22]"
                  >
                    {loginPhase === "redirecting" ? (
                      <svg
                        className="w-3.5 h-3.5 shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M20 6L9 17L4 12" className="check-draw" />
                      </svg>
                    ) : loginPhase === "checking" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    ) : null}
                    {loginPhase === "checking"
                      ? "Verificando..."
                      : loginPhase === "redirecting"
                      ? "Acceso concedido"
                      : isLocked
                      ? `Espera ${lockCountdown}s`
                      : "Iniciar sesión"}
                  </Button>
                </div>

                {/* Microsoft SSO */}
                {microsoftLogin && (
                  <div className="login-field-enter" style={{ animationDelay: "340ms" }}>
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
                      disabled={isLoading || isLocked}
                      onClick={() => void handleMicrosoft()}
                      className="w-full flex items-center justify-center gap-3 h-9 px-4 rounded-lg bg-white/8 border border-white/12 text-white text-sm hover:bg-white/12 transition-colors disabled:opacity-50"
                    >
                      <svg width="16" height="16" viewBox="0 0 21 21" fill="none">
                        <rect x="1"  y="1"  width="9" height="9" fill="#F25022" />
                        <rect x="11" y="1"  width="9" height="9" fill="#7FBA00" />
                        <rect x="1"  y="11" width="9" height="9" fill="#00A4EF" />
                        <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
                      </svg>
                      Iniciar sesión con Microsoft
                    </button>
                  </div>
                )}
              </form>
            </div>
          )}
        </div>
      </div>

      {/* L10 — footer with Canary time + org text */}
      <div className="flex flex-col items-center gap-1.5 mt-7 z-10">
        <p className="text-white/35 text-[13px] leading-relaxed text-center max-w-md px-4">
          CC Gran Canaria · Sistema de Gestión Operativa
        </p>
        <CanaryTime />
      </div>

      {/* Toggle de efectos visuales — para PCs lentos */}
      <button
        type="button"
        onClick={toggleEffects}
        aria-pressed={!effectsEnabled}
        title={
          effectsEnabled
            ? "Desactivar efectos visuales (modo ligero para PCs lentos)"
            : "Activar efectos visuales"
        }
        className="fixed bottom-4 right-4 z-30 group flex items-center gap-2 px-3 py-2 rounded-full text-[11.5px] font-medium border border-white/12 bg-black/35 text-white/55 hover:text-white/85 hover:border-white/22 hover:bg-black/50 transition-colors backdrop-blur-sm"
      >
        {effectsEnabled ? (
          <Sparkles className="w-3.5 h-3.5" />
        ) : (
          <Zap className="w-3.5 h-3.5" />
        )}
        <span className="hidden sm:inline">
          {effectsEnabled ? "Modo ligero" : "Modo completo"}
        </span>
      </button>

      {wiping && <WaveWipe />}
    </div>
  );
}
