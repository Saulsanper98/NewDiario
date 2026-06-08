"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<StormBackground />` — fondo del tema "Tormenta".
 *
 * Composición (todo dentro de `.storm-bg`, position:fixed; z-index:-10):
 *   1. Cielo en gradiente vertical (definido en CSS):
 *      azul-noche profundo arriba → ligeramente más claro en el horizonte.
 *   2. `.storm-horizon` ← halo radial bajo del horizonte.
 *   3. `.storm-clouds`  ← 3 SVGs de nubes apiladas (back/mid/front) con
 *                         distinto drift horizontal lento.
 *   4. `.storm-bolt-N`  ← 3 relámpagos SVG (zigzag) con flash esporádico
 *                         (cycles 9-15s + delays distintos: no rítmico).
 *   5. `.storm-rain`    ← 40 gotas verticales finas cayendo (deterministas).
 *   6. `.storm-noise`   ← ruido SVG sutil contra banding.
 *
 * Detección dual del tema (igual patrón que el resto): combina
 * `useTheme()` con `useSyncExternalStore` mirando `<html data-theme>`
 * para reaccionar al script anti-flash y evitar parpadeos en el primer paint.
 */

function subscribeHtmlStormFlag(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const el = document.documentElement;
  const mo = new MutationObserver(cb);
  mo.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

function getHtmlIsStorm(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "storm";
}

function getServerHtmlIsStorm(): boolean {
  return false;
}

/*
 * Lista DETERMINÍSTICA de gotas de lluvia. Cada entrada define la posición
 * horizontal en %, el delay (en s, NEGATIVO para que ya empiecen "a media
 * caída") y la duración total de la animación. No usamos Math.random()
 * para que SSR/CSR coincidan bit a bit.
 *
 * 40 gotas mezcladas en 3 grupos de velocidades para dar sensación natural.
 */
const RAIN: ReadonlyArray<{ left: number; delay: number; duration: number }> = [
  { left: 2,  delay: -0.10, duration: 1.30 },
  { left: 6,  delay: -0.80, duration: 1.55 },
  { left: 10, delay: -1.20, duration: 1.45 },
  { left: 13, delay: -0.45, duration: 1.65 },
  { left: 17, delay: -1.05, duration: 1.35 },
  { left: 20, delay: -0.25, duration: 1.55 },
  { left: 24, delay: -1.40, duration: 1.40 },
  { left: 27, delay: -0.65, duration: 1.70 },
  { left: 31, delay: -1.10, duration: 1.30 },
  { left: 34, delay: -0.30, duration: 1.50 },
  { left: 38, delay: -1.25, duration: 1.45 },
  { left: 41, delay: -0.55, duration: 1.60 },
  { left: 45, delay: -1.00, duration: 1.35 },
  { left: 48, delay: -0.15, duration: 1.55 },
  { left: 52, delay: -1.35, duration: 1.40 },
  { left: 55, delay: -0.70, duration: 1.65 },
  { left: 59, delay: -1.15, duration: 1.30 },
  { left: 62, delay: -0.40, duration: 1.55 },
  { left: 66, delay: -1.30, duration: 1.45 },
  { left: 69, delay: -0.60, duration: 1.70 },
  { left: 73, delay: -1.05, duration: 1.35 },
  { left: 76, delay: -0.20, duration: 1.55 },
  { left: 80, delay: -1.45, duration: 1.40 },
  { left: 83, delay: -0.75, duration: 1.65 },
  { left: 87, delay: -1.20, duration: 1.30 },
  { left: 90, delay: -0.35, duration: 1.50 },
  { left: 94, delay: -1.10, duration: 1.45 },
  { left: 97, delay: -0.50, duration: 1.60 },
  { left: 4,  delay: -0.95, duration: 1.50 },
  { left: 15, delay: -1.50, duration: 1.35 },
  { left: 29, delay: -0.85, duration: 1.55 },
  { left: 43, delay: -1.18, duration: 1.40 },
  { left: 57, delay: -0.42, duration: 1.65 },
  { left: 71, delay: -1.32, duration: 1.30 },
  { left: 85, delay: -0.58, duration: 1.55 },
  { left: 8,  delay: -0.28, duration: 1.45 },
  { left: 36, delay: -1.08, duration: 1.50 },
  { left: 64, delay: -0.92, duration: 1.40 },
  { left: 92, delay: -1.22, duration: 1.55 },
  { left: 50, delay: -0.62, duration: 1.45 },
];

export function StormBackground() {
  const { theme } = useTheme();
  const htmlStorm = useSyncExternalStore(
    subscribeHtmlStormFlag,
    getHtmlIsStorm,
    getServerHtmlIsStorm,
  );
  const active = theme === "storm" || htmlStorm;

  if (!active) return null;

  return (
    <div className="storm-bg print:hidden" aria-hidden="true">
      {/* Capa 2 — Halo del horizonte (CSS-only) */}
      <div className="storm-horizon" />

      {/* Capa 3 — 3 capas de nubes con drift independiente.
          viewBox 0 0 2400 500 → coordenadas absolutas; el SVG ocupa
          width:220% (ver CSS) para permitir desplazamiento sin huecos. */}
      <div className="storm-clouds">
        <svg
          className="cloud-back"
          viewBox="0 0 2400 500"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Nube de fondo: una masa baja y muy alargada con jorobas suaves */}
          <path
            d="M0 220
               C 140 160, 280 200, 420 180
               S 700 140, 860 180
               S 1140 160, 1320 190
               S 1620 150, 1800 180
               S 2080 160, 2240 200
               L 2400 200 L 2400 500 L 0 500 Z"
          />
        </svg>

        <svg
          className="cloud-mid"
          viewBox="0 0 2400 500"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Nube intermedia: jorobas más marcadas, mezcla picos y valles */}
          <path
            d="M0 240
               C 120 180, 220 230, 340 200
               S 540 150, 700 200
               S 920 240, 1080 180
               S 1280 220, 1460 200
               S 1700 160, 1880 220
               S 2120 200, 2300 220
               L 2400 220 L 2400 500 L 0 500 Z"
          />
        </svg>

        <svg
          className="cloud-front"
          viewBox="0 0 2400 500"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Nube frontal: más densa y con más detalle.
              Picos pronunciados que cubren más altura de viewport. */}
          <path
            d="M0 280
               C 100 200, 200 260, 320 240
               C 420 200, 520 260, 620 230
               C 760 180, 860 250, 960 210
               C 1080 250, 1200 200, 1320 240
               C 1440 200, 1560 260, 1680 220
               C 1800 250, 1920 210, 2040 240
               C 2160 220, 2280 260, 2400 240
               L 2400 500 L 0 500 Z"
          />
        </svg>
      </div>

      {/* Capa 4 — 3 relámpagos en posiciones distintas. Cada uno tiene su
          propio path zigzag (líneas quebradas que simulan el bolt) y delay
          de animación diferente para que no se sientan rítmicos.
          El ::before del CSS dibuja el afterglow blanco asociado. */}
      <div className="storm-bolt storm-bolt-1">
        <svg viewBox="0 0 60 300" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M 32 0 L 24 70 L 38 80 L 18 160 L 30 170 L 12 240 L 24 250 L 8 300" />
        </svg>
      </div>
      <div className="storm-bolt storm-bolt-2">
        <svg viewBox="0 0 80 360" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          {/* Bolt principal con una rama lateral */}
          <path d="M 48 0 L 30 60 L 50 70 L 22 150 L 42 160 L 18 230 L 36 240 L 10 300 L 28 310 L 6 360" />
          <path d="M 42 160 L 60 200 L 50 230 L 70 270" />
        </svg>
      </div>
      <div className="storm-bolt storm-bolt-3">
        <svg viewBox="0 0 50 260" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M 28 0 L 18 60 L 32 68 L 14 140 L 26 150 L 10 220 L 20 230 L 4 260" />
        </svg>
      </div>

      {/* ─── SKYLINE URBANO en silueta ────────────────────────────
          Edificios industriales/oficinas con luces encendidas en
          algunas ventanas. Capa de niebla baja por delante para
          dar profundidad atmosférica.
       */}
      <div className="storm-skyline">
        <svg viewBox="0 0 1200 240" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          {/* Cordillera lejana muy baja (silueta más clara) */}
          <path
            fill="rgba(20, 28, 48, 0.55)"
            d="M 0 180
               L 80 150 L 160 165 L 240 140
               L 320 160 L 400 130
               L 480 155 L 560 135
               L 640 160 L 720 130
               L 800 155 L 880 135
               L 960 160 L 1040 140
               L 1120 165 L 1200 145
               L 1200 240 L 0 240 Z"
          />
          {/* Skyline lejano (edificios bajos, sin detalle) */}
          <path
            fill="rgba(8, 12, 28, 0.78)"
            d="M 0 200
               L 50 200 L 50 180 L 90 180 L 90 200
               L 130 200 L 130 170 L 170 170 L 170 200
               L 200 200 L 200 175 L 240 175 L 240 200
               L 280 200 L 280 165 L 320 165 L 320 180 L 340 180 L 340 195 L 380 195 L 380 200
               L 420 200 L 420 170 L 450 170 L 450 195 L 480 195 L 480 175 L 520 175 L 520 200
               L 560 200 L 560 180 L 600 180 L 600 200
               L 640 200 L 640 165 L 670 165 L 670 195 L 700 195 L 700 175 L 730 175 L 730 200
               L 770 200 L 770 185 L 810 185 L 810 200
               L 850 200 L 850 170 L 890 170 L 890 200
               L 920 200 L 920 180 L 960 180 L 960 200
               L 1000 200 L 1000 175 L 1040 175 L 1040 200
               L 1080 200 L 1080 170 L 1120 170 L 1120 195 L 1160 195 L 1160 200
               L 1200 200 L 1200 240 L 0 240 Z"
          />
          {/* Skyline cercano — edificios altos con torres/chimeneas/antenas */}
          <g fill="rgba(3, 6, 18, 1)">
            {/* Bloque industrial 1 (con chimenea humeante) */}
            <path d="M 30 240 L 30 160 L 75 160 L 75 240 Z" />
            <path d="M 50 160 L 50 100 L 60 100 L 60 160 Z" /> {/* Chimenea */}
            {/* Bloque torre 2 (rascacielos) */}
            <path d="M 120 240 L 120 100 L 170 100 L 170 240 Z" />
            <path d="M 140 100 L 140 80 L 150 80 L 150 100 Z" /> {/* Antena base */}
            <path d="M 144 80 L 144 60 L 146 60 L 146 80 Z" /> {/* Antena */}
            {/* Edificio mid 3 */}
            <path d="M 210 240 L 210 145 L 270 145 L 270 240 Z" />
            <path d="M 230 145 L 230 130 L 250 130 L 250 145 Z" /> {/* Caja techo */}
            {/* Plataforma industrial 4 */}
            <path d="M 305 240 L 305 175 L 365 175 L 365 240 Z" />
            <path d="M 320 175 L 320 150 L 330 150 L 330 175 Z" />
            <path d="M 345 175 L 345 145 L 355 145 L 355 175 Z" />
            {/* Edificio bajo central 5 */}
            <path d="M 400 240 L 400 180 L 460 180 L 460 240 Z" />
            {/* Rascacielos central 6 (el más alto) */}
            <path d="M 490 240 L 490 70 L 545 70 L 545 240 Z" />
            <path d="M 510 70 L 510 50 L 525 50 L 525 70 Z" /> {/* Top cap */}
            <path d="M 516 50 L 516 30 L 519 30 L 519 50 Z" /> {/* Antena */}
            {/* Torre 7 */}
            <path d="M 580 240 L 580 110 L 620 110 L 620 240 Z" />
            <path d="M 595 110 L 595 90 L 605 90 L 605 110 Z" />
            {/* Edificio 8 */}
            <path d="M 655 240 L 655 155 L 710 155 L 710 240 Z" />
            <path d="M 670 155 L 670 140 L 695 140 L 695 155 Z" />
            {/* Industrial con dos chimeneas 9 */}
            <path d="M 745 240 L 745 175 L 815 175 L 815 240 Z" />
            <path d="M 755 175 L 755 120 L 763 120 L 763 175 Z" /> {/* Chimenea 1 */}
            <path d="M 798 175 L 798 130 L 806 130 L 806 175 Z" /> {/* Chimenea 2 */}
            {/* Rascacielos 10 (delgado y alto) */}
            <path d="M 850 240 L 850 90 L 880 90 L 880 240 Z" />
            <path d="M 860 90 L 860 75 L 870 75 L 870 90 Z" />
            {/* Edificio escalonado 11 */}
            <path d="M 915 240 L 915 155 L 970 155 L 970 175 L 1010 175 L 1010 240 Z" />
            {/* Torres gemelas 12 */}
            <path d="M 1045 240 L 1045 105 L 1075 105 L 1075 240 Z" />
            <path d="M 1085 240 L 1085 110 L 1115 110 L 1115 240 Z" />
            <path d="M 1055 105 L 1055 88 L 1065 88 L 1065 105 Z" />
            <path d="M 1095 110 L 1095 90 L 1105 90 L 1105 110 Z" />
            {/* Industrial final 13 */}
            <path d="M 1140 240 L 1140 160 L 1200 160 L 1200 240 Z" />
            <path d="M 1170 160 L 1170 125 L 1180 125 L 1180 160 Z" />
          </g>
          {/* Ventanas iluminadas (puntos amarillos pequeños distribuidos) */}
          <g className="storm-windows" fill="rgba(255, 220, 130, 0.85)">
            {/* Rascacielos 2 */}
            <rect x="128" y="115" width="3" height="4" />
            <rect x="138" y="125" width="3" height="4" />
            <rect x="155" y="115" width="3" height="4" />
            <rect x="148" y="160" width="3" height="4" />
            <rect x="135" y="195" width="3" height="4" />
            <rect x="158" y="195" width="3" height="4" />
            {/* Edificio 5 */}
            <rect x="408" y="190" width="3" height="4" />
            <rect x="420" y="200" width="3" height="4" />
            <rect x="445" y="195" width="3" height="4" />
            {/* Rascacielos central 6 (muchas ventanas) */}
            <rect x="498" y="85" width="3" height="4" />
            <rect x="510" y="95" width="3" height="4" />
            <rect x="528" y="100" width="3" height="4" />
            <rect x="498" y="120" width="3" height="4" />
            <rect x="520" y="135" width="3" height="4" />
            <rect x="498" y="160" width="3" height="4" />
            <rect x="535" y="155" width="3" height="4" />
            <rect x="510" y="180" width="3" height="4" />
            <rect x="498" y="200" width="3" height="4" />
            <rect x="528" y="210" width="3" height="4" />
            {/* Torre 7 */}
            <rect x="588" y="125" width="3" height="4" />
            <rect x="605" y="145" width="3" height="4" />
            <rect x="595" y="180" width="3" height="4" />
            {/* Edificio 8 */}
            <rect x="662" y="170" width="3" height="4" />
            <rect x="685" y="190" width="3" height="4" />
            <rect x="700" y="210" width="3" height="4" />
            {/* Rascacielos 10 */}
            <rect x="855" y="100" width="3" height="4" />
            <rect x="868" y="120" width="3" height="4" />
            <rect x="858" y="155" width="3" height="4" />
            <rect x="872" y="185" width="3" height="4" />
            <rect x="862" y="215" width="3" height="4" />
            {/* Torres gemelas */}
            <rect x="1050" y="135" width="3" height="4" />
            <rect x="1068" y="155" width="3" height="4" />
            <rect x="1058" y="195" width="3" height="4" />
            <rect x="1090" y="140" width="3" height="4" />
            <rect x="1108" y="165" width="3" height="4" />
            <rect x="1098" y="205" width="3" height="4" />
          </g>
          {/* Humo de chimeneas (CSS animado posteriormente) */}
          <g className="storm-smoke">
            <ellipse cx="55"  cy="85"  rx="14" ry="10" fill="rgba(80, 90, 110, 0.55)" />
            <ellipse cx="50"  cy="65"  rx="18" ry="12" fill="rgba(70, 80, 100, 0.45)" />
            <ellipse cx="759" cy="105" rx="12" ry="8"  fill="rgba(80, 90, 110, 0.50)" />
            <ellipse cx="802" cy="115" rx="13" ry="9"  fill="rgba(80, 90, 110, 0.50)" />
          </g>
        </svg>
      </div>

      {/* ─── NIEBLA baja sobre el horizonte ─────────────────── */}
      <div className="storm-mist" />

      {/* ─── CHARCOS reflejantes en primer plano ────────────── */}
      <div className="storm-puddles" />

      {/* Capa 5 — Lluvia. 40 gotas finas con left/delay/duration
          deterministas para SSR/CSR-safety. */}
      <div className="storm-rain">
        {RAIN.map((r, i) => (
          <span
            key={i}
            className="drop"
            style={{
              left: `${r.left}%`,
              animationDelay: `${r.delay}s`,
              animationDuration: `${r.duration}s`,
            }}
          />
        ))}
      </div>

      {/* Capa 6 — Ruido sutil contra banding del gradiente. */}
      <div className="storm-noise" />
    </div>
  );
}
