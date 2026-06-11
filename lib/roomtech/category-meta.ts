/**
 * Meta visual de cada categoría de item del módulo Técnicos de Sala.
 *
 * Cada categoría tiene:
 *   - icon: lucide-react que la representa.
 *   - tint: clases Tailwind para fondo + texto + borde, usadas como acento
 *           sutil en cards/listados. Pareadas light/dark.
 *   - accent: clase de barra/anillo lateral más saturada para realce.
 *
 * La gama de colores está pensada para conjuntarse con el accent global
 * (`#ffeb66`) sin pelearse: tonos pastel en light, saturaciones bajas y
 * mezcladas con `white/...` en dark. Evitamos colores puros para no
 * romper la armonía con los temas tributo (sith, stranger, etc.).
 */

import {
  Laptop,
  Mouse,
  Cable,
  HardDrive,
  Wrench,
  Network,
  Server,
  Server as RackIcon,
  Speaker,
  Printer,
  Package,
  type LucideIcon,
} from "lucide-react";
import type { ItemCategory } from "@/app/generated/prisma/enums";

export interface CategoryMeta {
  icon: LucideIcon;
  /** Fondo + texto para chips/badges (`bg`, `text`, `border`). */
  tint: { light: string; dark: string };
  /** Banda lateral o anillo (más saturado). */
  accent: { light: string; dark: string };
  /** Color hex aproximado para gradientes / dot indicators. */
  hex: string;
}

export const CATEGORY_META: Record<ItemCategory, CategoryMeta> = {
  PORTATIL: {
    icon: Laptop,
    tint: {
      light: "bg-indigo-50 text-indigo-800 border-indigo-200",
      dark: "bg-indigo-500/12 text-indigo-200 border-indigo-400/25",
    },
    accent: {
      light: "bg-indigo-400/80",
      dark: "bg-indigo-400/60",
    },
    hex: "#818cf8",
  },
  PERIFERICO: {
    icon: Mouse,
    tint: {
      light: "bg-pink-50 text-pink-800 border-pink-200",
      dark: "bg-pink-500/12 text-pink-200 border-pink-400/25",
    },
    accent: {
      light: "bg-pink-400/80",
      dark: "bg-pink-400/60",
    },
    hex: "#f472b6",
  },
  CABLE: {
    icon: Cable,
    tint: {
      light: "bg-amber-50 text-amber-900 border-amber-200",
      dark: "bg-amber-500/12 text-amber-200 border-amber-400/25",
    },
    accent: {
      light: "bg-amber-400/80",
      dark: "bg-amber-400/60",
    },
    hex: "#fbbf24",
  },
  DISCO: {
    icon: HardDrive,
    tint: {
      light: "bg-cyan-50 text-cyan-800 border-cyan-200",
      dark: "bg-cyan-500/12 text-cyan-200 border-cyan-400/25",
    },
    accent: {
      light: "bg-cyan-400/80",
      dark: "bg-cyan-400/60",
    },
    hex: "#22d3ee",
  },
  HERRAMIENTA: {
    icon: Wrench,
    tint: {
      light: "bg-orange-50 text-orange-900 border-orange-200",
      dark: "bg-orange-500/12 text-orange-200 border-orange-400/25",
    },
    accent: {
      light: "bg-orange-400/80",
      dark: "bg-orange-400/60",
    },
    hex: "#fb923c",
  },
  RED: {
    icon: Network,
    tint: {
      light: "bg-emerald-50 text-emerald-800 border-emerald-200",
      dark: "bg-emerald-500/12 text-emerald-200 border-emerald-400/25",
    },
    accent: {
      light: "bg-emerald-400/80",
      dark: "bg-emerald-400/60",
    },
    hex: "#34d399",
  },
  SERVIDOR: {
    icon: Server,
    tint: {
      light: "bg-violet-50 text-violet-800 border-violet-200",
      dark: "bg-violet-500/12 text-violet-200 border-violet-400/25",
    },
    accent: {
      light: "bg-violet-400/80",
      dark: "bg-violet-400/60",
    },
    hex: "#a78bfa",
  },
  RACK: {
    icon: RackIcon,
    tint: {
      light: "bg-slate-100 text-slate-800 border-slate-300",
      dark: "bg-slate-500/15 text-slate-200 border-slate-400/30",
    },
    accent: {
      light: "bg-slate-400/80",
      dark: "bg-slate-400/60",
    },
    hex: "#94a3b8",
  },
  AUDIO_VIDEO: {
    icon: Speaker,
    tint: {
      light: "bg-rose-50 text-rose-800 border-rose-200",
      dark: "bg-rose-500/12 text-rose-200 border-rose-400/25",
    },
    accent: {
      light: "bg-rose-400/80",
      dark: "bg-rose-400/60",
    },
    hex: "#fb7185",
  },
  IMPRESORA: {
    icon: Printer,
    tint: {
      light: "bg-teal-50 text-teal-800 border-teal-200",
      dark: "bg-teal-500/12 text-teal-200 border-teal-400/25",
    },
    accent: {
      light: "bg-teal-400/80",
      dark: "bg-teal-400/60",
    },
    hex: "#2dd4bf",
  },
  OTRO: {
    icon: Package,
    tint: {
      light: "bg-zinc-100 text-zinc-700 border-zinc-300",
      dark: "bg-white/8 text-white/80 border-white/15",
    },
    accent: {
      light: "bg-zinc-400/80",
      dark: "bg-white/30",
    },
    hex: "#a1a1aa",
  },
};
