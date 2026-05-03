"use client";

import { useTheme } from "@/components/layout/ThemeProvider";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

type OrbSim = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  turb: number;
  /** Ritmo distinto por orbe para que azul/violeta no parezcan fijos junto al amarillo */
  stepMult: number;
};

const ORB_CLASS = [
  "bg-orb bg-orb-1 bg-orb--js-motion",
  "bg-orb bg-orb-2 bg-orb--js-motion",
  "bg-orb bg-orb-3 bg-orb--js-motion",
] as const;

function subscribeHtmlAuroraFlag(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const el = document.documentElement;
  const mo = new MutationObserver(cb);
  mo.observe(el, { attributes: true, attributeFilter: ["data-aurora", "data-theme"] });
  return () => mo.disconnect();
}

function getHtmlHasDataAurora(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.hasAttribute("data-aurora");
}

function getServerHtmlHasDataAurora(): boolean {
  return false;
}

export type BackgroundOrbsMode = "viewport" | "layer";

/**
 * `viewport`: orbes fijos globales (solo si el tema es Aurora).
 * `layer`: orbes absolutos dentro de un ancestro `position: relative` (p. ej. bitácora a pantalla completa);
 * se muestran si `html` tiene `data-aurora` (sincronizado con `applyThemeToDocument`, independiente de hidratación del contexto).
 */
export function BackgroundOrbs({ mode = "viewport" }: { mode?: BackgroundOrbsMode }) {
  const { theme } = useTheme();
  const htmlAurora = useSyncExternalStore(
    subscribeHtmlAuroraFlag,
    getHtmlHasDataAurora,
    getServerHtmlHasDataAurora
  );
  const auroraActive = mode === "layer" ? htmlAurora : theme === "aurora";
  const [reducedMotion, setReducedMotion] = useState(false);
  const elRef = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const simRef = useRef<OrbSim[] | null>(null);
  const rafRef = useRef(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    function sync() {
      setReducedMotion(mq.matches);
    }
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    cancelledRef.current = false;

    if (!auroraActive) {
      cancelAnimationFrame(rafRef.current);
      simRef.current = null;
      for (const el of elRef.current) {
        if (el) el.style.transform = "";
      }
      return;
    }

    if (reducedMotion) {
      cancelAnimationFrame(rafRef.current);
      for (const el of elRef.current) {
        if (el) el.style.transform = "translate3d(0,0,0)";
      }
      return;
    }

    const stepMults = [1.15, 0.82, 1.35] as const;
    simRef.current = [0, 1, 2].map((i) => ({
      x: rand(-6, 6),
      y: rand(-5, 5),
      vx: rand(-0.018, 0.018),
      vy: rand(-0.018, 0.018),
      turb: 0.75 + i * 0.35,
      stepMult: stepMults[i],
    }));

    /* ±28 vw / ±20 vh: rango amplio; ajustar aquí si se quiere más o menos recorrido */
    const bounds = { xMin: -28, xMax: 28, yMin: -20, yMax: 20 };
    let last = performance.now();

    function tick(now: number) {
      if (cancelledRef.current) return;
      const dt = Math.min((now - last) / 1000, 0.12);
      last = now;
      const sims = simRef.current;
      if (!sims) return;

      for (let i = 0; i < 3; i++) {
        const s = sims[i];
        const t = s.turb;
        s.vx += (Math.random() - 0.5) * 0.055 * dt * t;
        s.vy += (Math.random() - 0.5) * 0.055 * dt * t;
        s.vx *= Math.pow(0.985, dt * 60);
        s.vy *= Math.pow(0.985, dt * 60);
        const step = 6.25 * s.stepMult;
        s.x += s.vx * step * dt * 60;
        s.y += s.vy * step * dt * 60;
        if (s.x < bounds.xMin) {
          s.x = bounds.xMin;
          s.vx *= -rand(0.25, 0.55);
        } else if (s.x > bounds.xMax) {
          s.x = bounds.xMax;
          s.vx *= -rand(0.25, 0.55);
        }
        if (s.y < bounds.yMin) {
          s.y = bounds.yMin;
          s.vy *= -rand(0.25, 0.55);
        } else if (s.y > bounds.yMax) {
          s.y = bounds.yMax;
          s.vy *= -rand(0.25, 0.55);
        }

        const el = elRef.current[i];
        if (el) {
          el.style.transform = `translate3d(${s.x.toFixed(2)}vw, ${s.y.toFixed(2)}vh, 0)`;
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelledRef.current = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [auroraActive, reducedMotion]);

  if (!auroraActive) return null;

  const orbs = ORB_CLASS.map((cls, i) => (
    <div
      key={i}
      ref={(n) => {
        elRef.current[i] = n;
      }}
      className={cls}
      aria-hidden="true"
    />
  ));

  if (mode === "layer") {
    return (
      <div className="bg-orb-layer-host print:hidden" aria-hidden>
        {orbs}
      </div>
    );
  }

  return <>{orbs}</>;
}
