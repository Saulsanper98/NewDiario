"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<BorealisBackground />` — fondo del tema "Borealis".
 *
 * Composición (todo dentro de `.borealis-bg`, position:fixed; z-index:-10):
 *   1. Color base noche ártica + 2 halos sutiles (definidos en .borealis-bg).
 *   2. `.borealis-stars`     ← ~80 puntos blancos estáticos (constelaciones).
 *   3. `.borealis-aurora`    ← SVG con 2 paths gradiente verde-cyan-violeta
 *                              que serpentean lentamente (cinta de aurora).
 *   4. `.borealis-reflection`← banda inferior con reflejo de la aurora.
 *   5. `.borealis-noise`     ← ruido SVG sutil para evitar banding.
 *
 * Estrellas y partículas usan PRNG determinista (mulberry32) con seed fija
 * para que el render del servidor y del cliente coincidan (hydration-safe).
 *
 * Detección dual del tema (igual patrón que PrismaBackground): combina
 * `useTheme()` con `useSyncExternalStore` mirando `<html data-theme>` para
 * reaccionar al script anti-flash y evitar parpadeos en el primer paint.
 *
 * Se monta SOLO cuando el tema activo es "borealis". Fuera del tema
 * devuelve null → 0 nodos.
 */

function subscribeHtmlBorealisFlag(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const el = document.documentElement;
  const mo = new MutationObserver(cb);
  mo.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

function getHtmlIsBorealis(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "borealis";
}

function getServerHtmlIsBorealis(): boolean {
  return false;
}

/**
 * PRNG determinista (mulberry32) — semilla fija. Se ejecuta tanto en
 * servidor como en cliente y da los mismos números, así que los <span>
 * generados son hydration-safe.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STAR_COUNT = 80;

interface StarStyle {
  left: string;
  top: string;
  width: string;
  height: string;
  ["--s-opacity"]: string;
  ["--s-duration"]: string;
  ["--s-delay"]: string;
}

function buildStars(): StarStyle[] {
  const rnd = mulberry32(0x42af1e);
  return Array.from({ length: STAR_COUNT }, () => {
    const left = (rnd() * 100).toFixed(2) + "%";
    const top = (rnd() * 70).toFixed(2) + "%"; /* mayormente en la mitad superior del cielo */
    const sizePx = (rnd() * 1.6 + 0.6).toFixed(2); /* 0.6 – 2.2 px */
    const size = sizePx + "px";
    const opacity = (0.35 + rnd() * 0.55).toFixed(2); /* 0.35–0.90 */
    const duration = (2.6 + rnd() * 5.4).toFixed(1) + "s"; /* 2.6–8.0s */
    const delay = (-rnd() * 8).toFixed(1) + "s";
    return {
      left,
      top,
      width: size,
      height: size,
      "--s-opacity": opacity,
      "--s-duration": duration,
      "--s-delay": delay,
    };
  });
}

export function BorealisBackground() {
  const { theme } = useTheme();
  const htmlBorealis = useSyncExternalStore(
    subscribeHtmlBorealisFlag,
    getHtmlIsBorealis,
    getServerHtmlIsBorealis,
  );
  const active = theme === "borealis" || htmlBorealis;

  /* useMemo SIEMPRE en el mismo orden (independiente de `active`) para
   * cumplir las reglas de hooks. El array es estable entre renders. */
  const stars = useMemo(buildStars, []);

  if (!active) return null;

  return (
    <div className="borealis-bg print:hidden" aria-hidden="true">
      {/* Capa 2 — Constelaciones (estrellas estáticas con twinkle) */}
      <div className="borealis-stars">
        {stars.map((s, i) => (
          <span key={i} style={s as React.CSSProperties} />
        ))}
      </div>

      {/* Capa 3 — Cinta de aurora SVG. 2 paths con el mismo gradiente
          definido en <defs>, animados con desfase para sensación de
          ondulación natural. viewBox 0 0 100 50 → coordenadas porcentaje
          (preserveAspectRatio=none escala libremente). */}
      <svg
        className="borealis-aurora"
        viewBox="0 0 100 50"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="borealis-aurora-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#5dffc0" stopOpacity="0" />
            <stop offset="15%" stopColor="#5dffc0" stopOpacity="0.85" />
            <stop offset="42%" stopColor="#7dc8ff" stopOpacity="0.9" />
            <stop offset="68%" stopColor="#b78aff" stopOpacity="0.85" />
            <stop offset="88%" stopColor="#ff9bb5" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#ff9bb5" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Cinta principal — onda alta */}
        <path
          className="aurora-1"
          d="M 0 14
             C 8 6, 18 22, 28 14
             S 48 6, 58 16
             S 78 8, 88 18
             S 100 14, 100 14
             L 100 28
             C 92 32, 80 18, 68 28
             S 48 36, 36 26
             S 16 32, 6 24
             S 0 26, 0 26
             Z"
        />

        {/* Cinta secundaria — más baja y con menos opacidad (en CSS) */}
        <path
          className="aurora-2"
          d="M 0 22
             C 10 14, 22 28, 34 20
             S 54 12, 64 22
             S 82 16, 100 22
             L 100 36
             C 88 40, 74 28, 62 34
             S 42 42, 30 32
             S 12 36, 0 34
             Z"
        />
      </svg>

      {/* Capa 4 — Reflejo de aurora en el horizonte inferior */}
      <div className="borealis-reflection" />

      {/* Capa 5 — Ruido sutil para romper banding */}
      <div className="borealis-noise" />
    </div>
  );
}
