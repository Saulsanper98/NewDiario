"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import {
  ANNOUNCEMENT_RELOAD_URL,
  SEVERITY_META,
} from "@/lib/novedades";
import type { AnnouncementSeverity } from "@/app/generated/prisma/enums";

interface ActiveAnnouncement {
  id: string;
  title: string;
  message: string;
  severity: AnnouncementSeverity;
  dismissible: boolean;
  ctaLabel: string | null;
  ctaUrl: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export function AnnouncementBanner() {
  const [items, setItems] = useState<ActiveAnnouncement[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/announcements");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.items)) {
        setItems(data.items);
      }
    } catch {
      /* offline-safe */
    }
  }, []);

  useEffect(() => {
    setHydrated(true);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const interval = setInterval(() => {
      void refresh();
    }, 60_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  async function dismiss(id: string) {
    setDismissingIds((s) => new Set(s).add(id));
    try {
      const res = await fetch(`/api/announcements/${id}/dismiss`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(
          typeof data?.error === "string"
            ? data.error
            : "No se pudo descartar el aviso"
        );
        return;
      }
      // Animación de salida y luego quitar
      setTimeout(() => {
        setItems((prev) => prev.filter((it) => it.id !== id));
      }, 220);
    } catch {
      toast.error("Sin conexión: no se pudo descartar");
    } finally {
      setTimeout(() => {
        setDismissingIds((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        });
      }, 240);
    }
  }

  function handleCta(it: ActiveAnnouncement) {
    if (!it.ctaUrl) return;
    if (it.ctaUrl === ANNOUNCEMENT_RELOAD_URL) {
      window.location.reload();
      return;
    }
    if (it.ctaUrl.startsWith("/")) {
      window.location.assign(it.ctaUrl);
      return;
    }
    try {
      const u = new URL(it.ctaUrl);
      window.open(u.href, "_blank", "noopener,noreferrer");
    } catch {
      window.location.assign(it.ctaUrl);
    }
  }

  if (!hydrated || items.length === 0) return null;

  return (
    <div
      className="shrink-0 flex flex-col gap-1 print:hidden relative z-[60]"
      role="region"
      aria-label="Avisos importantes"
    >
      {items.map((it) => {
        const meta = SEVERITY_META[it.severity];
        const Icon = meta.Icon;
        const dismissing = dismissingIds.has(it.id);
        return (
          <div
            key={it.id}
            className={cn(
              /* Mobile (<sm): padding vertical reducido a 1.5 (de 2.5) y
                 horizontal a 3 (de 4) — gana ~12px verticales y mete
                 al banner mas integrado con el header. */
              "relative px-3 sm:px-6 py-1.5 sm:py-2.5 shadow-lg backdrop-blur-md",
              "transition-all duration-200",
              meta.bannerClass,
              dismissing && "opacity-0 -translate-y-2"
            )}
          >
            <div className="mx-auto max-w-7xl flex items-center gap-2 sm:gap-3">
              {/* Icono mas pequenio en mobile (24px en lugar de 28px). */}
              <div className="shrink-0 flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/15 ring-1 ring-white/20">
                <Icon className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", meta.iconClass)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {/* Mobile: titulo a una sola linea con truncate. El
                     usuario ve el resto al pulsar el CTA o expandir. */}
                  <p className="text-xs sm:text-sm font-semibold leading-tight truncate sm:whitespace-normal" title={it.title}>
                    {it.title}
                  </p>
                  <Sparkles
                    className="hidden sm:inline-block w-3 h-3 opacity-70 shrink-0"
                    aria-hidden
                  />
                </div>
                {/* Mobile: mensaje a una linea con truncate. Desktop
                   mantiene el wrap clasico. */}
                <p
                  className="text-[11px] sm:text-xs leading-snug mt-0.5 opacity-95 truncate sm:whitespace-normal"
                  title={it.message}
                >
                  {it.message}
                </p>
              </div>
              {it.ctaLabel && it.ctaUrl && (
                <button
                  type="button"
                  onClick={() => handleCta(it)}
                  className={cn(
                    /* CTA mas compacta en mobile: px-2 py-1 para que no
                       canibalice el ancho del mensaje truncado. */
                    "shrink-0 inline-flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap",
                    meta.buttonClass
                  )}
                >
                  {it.ctaLabel}
                </button>
              )}
              {it.dismissible && (
                <button
                  type="button"
                  onClick={() => void dismiss(it.id)}
                  aria-label="Descartar aviso"
                  className="shrink-0 p-1 sm:p-1.5 rounded-md hover:bg-white/15 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
