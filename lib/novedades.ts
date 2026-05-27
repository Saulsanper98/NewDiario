import {
  AnnouncementSeverity,
  ReleaseNoteCategory,
} from "@/app/generated/prisma/enums";
import type { LucideIcon } from "lucide-react";
import {
  Sparkles,
  Wand2,
  Bug,
  Megaphone,
  Zap,
  Info,
  AlertTriangle,
  AlertOctagon,
} from "lucide-react";

export type Category = ReleaseNoteCategory;
export type Severity = AnnouncementSeverity;

interface CategoryMeta {
  label: string;
  Icon: LucideIcon;
  /** Texto principal sobre fondo translúcido. */
  textClass: string;
  /** Fondo translúcido + borde para chips. */
  chipClass: string;
  /** Gradient (cabecera tarjeta) en dark. */
  gradientDark: string;
  /** Gradient (cabecera tarjeta) en light. */
  gradientLight: string;
  /** Color del punto del timeline. */
  dotClass: string;
}

const FEATURE: CategoryMeta = {
  label: "Nueva funcionalidad",
  Icon: Sparkles,
  textClass: "text-[#ffeb66]",
  chipClass:
    "bg-[#ffeb66]/15 text-[#ffeb66] border border-[#ffeb66]/30",
  gradientDark:
    "from-[#ffeb66]/15 via-[#ffeb66]/5 to-transparent",
  gradientLight:
    "from-amber-200/60 via-amber-100/40 to-transparent",
  dotClass: "bg-[#ffeb66] shadow-[0_0_16px_rgba(255,235,102,0.55)]",
};

const IMPROVEMENT: CategoryMeta = {
  label: "Mejora",
  Icon: Wand2,
  textClass: "text-emerald-300",
  chipClass:
    "bg-emerald-400/15 text-emerald-300 border border-emerald-400/30",
  gradientDark:
    "from-emerald-400/15 via-emerald-400/5 to-transparent",
  gradientLight:
    "from-emerald-200/60 via-emerald-100/40 to-transparent",
  dotClass:
    "bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.55)]",
};

const FIX: CategoryMeta = {
  label: "Arreglo",
  Icon: Bug,
  textClass: "text-sky-300",
  chipClass: "bg-sky-400/15 text-sky-300 border border-sky-400/30",
  gradientDark: "from-sky-400/15 via-sky-400/5 to-transparent",
  gradientLight: "from-sky-200/60 via-sky-100/40 to-transparent",
  dotClass: "bg-sky-400 shadow-[0_0_16px_rgba(56,189,248,0.55)]",
};

const ANNOUNCEMENT: CategoryMeta = {
  label: "Aviso",
  Icon: Megaphone,
  textClass: "text-purple-300",
  chipClass:
    "bg-purple-400/15 text-purple-300 border border-purple-400/30",
  gradientDark: "from-purple-400/15 via-purple-400/5 to-transparent",
  gradientLight: "from-purple-200/60 via-purple-100/40 to-transparent",
  dotClass:
    "bg-purple-400 shadow-[0_0_16px_rgba(192,132,252,0.55)]",
};

const BREAKING: CategoryMeta = {
  label: "Cambio importante",
  Icon: Zap,
  textClass: "text-rose-300",
  chipClass: "bg-rose-400/15 text-rose-300 border border-rose-400/30",
  gradientDark: "from-rose-400/15 via-rose-400/5 to-transparent",
  gradientLight: "from-rose-200/60 via-rose-100/40 to-transparent",
  dotClass: "bg-rose-400 shadow-[0_0_16px_rgba(251,113,133,0.55)]",
};

export const CATEGORY_META: Record<ReleaseNoteCategory, CategoryMeta> = {
  FEATURE,
  IMPROVEMENT,
  FIX,
  ANNOUNCEMENT,
  BREAKING,
};

export const CATEGORY_ORDER: ReleaseNoteCategory[] = [
  ReleaseNoteCategory.FEATURE,
  ReleaseNoteCategory.IMPROVEMENT,
  ReleaseNoteCategory.FIX,
  ReleaseNoteCategory.ANNOUNCEMENT,
  ReleaseNoteCategory.BREAKING,
];

interface SeverityMeta {
  label: string;
  Icon: LucideIcon;
  /** Banner background and text. */
  bannerClass: string;
  /** Color del icono dentro del banner. */
  iconClass: string;
  buttonClass: string;
}

export const SEVERITY_META: Record<AnnouncementSeverity, SeverityMeta> = {
  INFO: {
    label: "Información",
    Icon: Info,
    bannerClass:
      "bg-gradient-to-r from-sky-500/95 via-sky-500/90 to-sky-600/90 text-sky-50 ring-1 ring-sky-300/50",
    iconClass: "text-sky-50",
    buttonClass:
      "bg-white/15 hover:bg-white/25 text-sky-50 ring-1 ring-white/20",
  },
  WARNING: {
    label: "Aviso",
    Icon: AlertTriangle,
    bannerClass:
      "bg-gradient-to-r from-amber-500/95 via-amber-500/95 to-amber-600/95 text-amber-950 ring-1 ring-amber-300/60",
    iconClass: "text-amber-950",
    buttonClass:
      "bg-amber-950/15 hover:bg-amber-950/25 text-amber-950 ring-1 ring-amber-900/20",
  },
  CRITICAL: {
    label: "Crítico",
    Icon: AlertOctagon,
    bannerClass:
      "bg-gradient-to-r from-rose-600/95 via-rose-600/95 to-red-700/95 text-rose-50 ring-1 ring-rose-300/40 animate-pulse-soft",
    iconClass: "text-rose-50",
    buttonClass:
      "bg-white/15 hover:bg-white/25 text-rose-50 ring-1 ring-white/20",
  },
};

/**
 * URL especial reconocida en `ctaUrl`: el banner ejecuta `location.reload()`
 * en vez de navegar. Útil para "reiniciar la app" tras un despliegue.
 */
export const ANNOUNCEMENT_RELOAD_URL = "reload://app";
