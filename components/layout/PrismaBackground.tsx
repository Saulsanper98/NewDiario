"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<PrismaBackground />` — fondo cinético del tema "Prisma".
 *
 * Composición (todo dentro de `.prisma-bg`, position:fixed; z-index:-10):
 *   1. Color base violeta-negro + 3 halos radiales (en `.prisma-bg`).
 *   2. `.prisma-grid`         ← grid en perspectiva al horizonte (puro CSS).
 *   3. `.prisma-plasma` (SVG) ← 2 líneas que serpentean lento (cyan + magenta).
 *   4. `.prisma-particles`    ← ~22 spans (polvo estelar) con drift lento.
 *   5. `.prisma-aura-1/2`     ← halos radiales que "respiran" (8–9 s).
 *   6. `.prisma-noise`        ← textura SVG fina (opacidad 5%, mix-blend overlay).
 *
 * Las 5 capas animadas son CSS puro (keyframes). Cero RAF/JS por frame.
 * Las part\u00edculas reciben sus offsets via CSS custom properties calculadas
 * con `useMemo` (sin recalcular en cada render) y un PRNG con seed fija
 * para que la disposici\u00f3n sea estable entre re-renders del cliente y
 * coincida con el render del servidor (evita hydration mismatch).
 *
 * Detecci\u00f3n dual del tema (igual patr\u00f3n que `GlassBackground` y
 * `SlateBackground`): combina `useTheme()` con `useSyncExternalStore`
 * mirando `<html data-theme>` para reaccionar al script anti-flash y
 * evitar parpadeos en el primer paint.
 *
 * Se monta SOLO cuando el tema activo es "prisma". Fuera de Prisma
 * devuelve null \u2192 0 nodos.
 */

function subscribeHtmlPrismaFlag(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const el = document.documentElement;
  const mo = new MutationObserver(cb);
  mo.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

function getHtmlIsPrisma(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "prisma";
}

function getServerHtmlIsPrisma(): boolean {
  return false;
}

/**
 * PRNG determinista (mulberry32) — semilla fija. Se ejecuta tanto en
 * servidor como en cliente y da los mismos n\u00fameros, as\u00ed que los
 * <span> generados son hydration-safe.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PARTICLE_COUNT = 22;

interface ParticleStyle {
  left: string;
  top: string;
  /* CSS custom properties leídas por la animación
   * `prisma-particle-drift` definida en theme-prisma.css */
  ["--p-duration"]: string;
  ["--p-delay"]: string;
  ["--p-dx"]: string;
  ["--p-dy"]: string;
  ["--p-opacity-base"]: string;
}

function buildParticles(): ParticleStyle[] {
  const rnd = mulberry32(0x9b1d3f);                /* semilla cualquiera, fija */
  return Array.from({ length: PARTICLE_COUNT }, () => {
    const left = (rnd() * 100).toFixed(2) + "%";
    const top = (rnd() * 100).toFixed(2) + "%";
    const duration = (12 + rnd() * 16).toFixed(1) + "s";    /* 12–28s */
    const delay = (-rnd() * 20).toFixed(1) + "s";           /* arranca a mitad */
    const dx = (rnd() * 80 - 40).toFixed(0) + "px";         /* ±40px */
    const dy = (rnd() * 80 - 40).toFixed(0) + "px";
    const opacity = (0.30 + rnd() * 0.40).toFixed(2);       /* 0.30–0.70 */
    return {
      left,
      top,
      "--p-duration": duration,
      "--p-delay": delay,
      "--p-dx": dx,
      "--p-dy": dy,
      "--p-opacity-base": opacity,
    };
  });
}

export function PrismaBackground() {
  const { theme } = useTheme();
  const htmlPrisma = useSyncExternalStore(
    subscribeHtmlPrismaFlag,
    getHtmlIsPrisma,
    getServerHtmlIsPrisma
  );
  const active = theme === "prisma" || htmlPrisma;

  /* useMemo SIEMPRE en el mismo orden (independiente de `active`) para
   * cumplir las reglas de hooks. El array es estable entre renders. */
  const particles = useMemo(buildParticles, []);

  if (!active) return null;

  return (
    <div className="prisma-bg print:hidden" aria-hidden="true">
      {/* Capa 2 — Grid en perspectiva (puro CSS, sin JS) */}
      <div className="prisma-grid" />

      {/* Capa 3 — Líneas de plasma SVG. Dos paths curvos atravesando la
          pantalla. Las animaciones (color, traslación) están definidas en
          theme-prisma.css. viewBox 0 0 100 100 → coordenadas porcentaje. */}
      <svg
        className="prisma-plasma"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          className="plasma-1"
          d="M -5 30 Q 20 10, 40 35 T 75 28 T 110 38"
          vectorEffect="non-scaling-stroke"
        />
        <path
          className="plasma-2"
          d="M -5 70 Q 22 55, 38 75 T 72 62 T 110 72"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Capa 4 — Polvo estelar (~22 partículas) */}
      <div className="prisma-particles">
        {particles.map((p, i) => (
          <span key={i} style={p as React.CSSProperties} />
        ))}
      </div>

      {/* Capa 5 — Auras radiales que respiran */}
      <div className="prisma-aura prisma-aura-1" />
      <div className="prisma-aura prisma-aura-2" />

      {/* Capa 6 — Ruido sutil */}
      <div className="prisma-noise" />
    </div>
  );
}
