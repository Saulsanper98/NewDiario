"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<CanarioBackground />` — capa cinemática del tema "Canario".
 *
 * Tema NATURALEZA CANARIA: Roque Nublo (Gran Canaria) con el Teide
 * visible al fondo en un atardecer crepuscular. La pieza central es un
 * VÍDEO real servido desde `/videos/canario.mp4`. El componente añade:
 *
 *   1. <video> en bucle, muteado, autoplay, playsInline.
 *   2. Silueta CSS del Teide al fondo (visible solo si el vídeo no carga,
 *      refuerza la lectura del paisaje en ese fallback).
 *   3. Halo radial del sol bajo (pulso lento).
 *   4. Niebla de calor sobre el horizonte.
 *   5. 6 motas de polvo flotando con animación CSS independiente.
 *   6. Viñeta + grano fílmico para fundir UI con la imagen.
 *
 * Determinístico (cero Math.random): SSR/CSR producen el mismo HTML.
 *
 * SOLO DESKTOP: en viewport <768px el componente no se monta. La
 * decisión vive en `lib/theme.ts` (DESKTOP_ONLY_THEMES) y aquí
 * verificamos en cliente con matchMedia para evitar SSR mismatch.
 *
 * REDUCED MOTION: el vídeo se pausa explícitamente y las animaciones
 * decorativas se neutralizan vía CSS.
 *
 * Patrón de detección de tema activo: dual (ThemeProvider + Mutation
 * Observer sobre `data-theme`) idéntico a `itachi`/`amegakure`/`sololeveling`.
 */

function subscribeCanario(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => mo.disconnect();
}
function getIsCanario(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "canario";
}
function getServerIsCanario(): boolean {
  return false;
}

/**
 * Motas de polvo: posición inicial (vw,vh), tamaño en px, delay y
 * duración. 6 instancias bastan para dar sensación de aire sin saturar
 * la GPU. Determinístico — sin Math.random.
 */
const DUST: ReadonlyArray<{
  left: number;
  top: number;
  size: number;
  delay: number;
  duration: number;
}> = [
  { left: 12, top: 75, size: 3, delay: 0,    duration: 22 },
  { left: 28, top: 82, size: 2, delay: -4,   duration: 26 },
  { left: 44, top: 70, size: 4, delay: -8,   duration: 20 },
  { left: 62, top: 88, size: 2, delay: -12,  duration: 28 },
  { left: 78, top: 76, size: 3, delay: -16,  duration: 24 },
  { left: 92, top: 84, size: 2, delay: -20,  duration: 26 },
];

export function CanarioBackground() {
  const { theme } = useTheme();
  const htmlCanario = useSyncExternalStore(
    subscribeCanario,
    getIsCanario,
    getServerIsCanario,
  );
  const isActive = theme === "canario" || htmlCanario;

  // SSR-safe desktop check: arrancamos en `false` para que el server
  // nunca renderice el bloque (evita hydration mismatch). Tras montar,
  // matchMedia decide si lo activamos.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Reduced motion: pausa el <video> y neutraliza animaciones (CSS lo
  // hace solo, pero el video tiene que pararse desde JS).
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!isActive || !videoRef.current) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      const v = videoRef.current;
      if (!v) return;
      if (mq.matches) {
        v.pause();
      } else {
        // play() puede fallar en algunos navegadores si el usuario aún
        // no ha interactuado con la página; lo silenciamos con catch.
        v.play().catch(() => {});
      }
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [isActive]);

  // Si el vídeo falla (404 porque aún no se ha desplegado, o error de
  // codec), lo ocultamos para que la capa CSS de cielo + Teide silueta
  // tome el relevo y el tema NUNCA se vea como un rectángulo negro.
  const [videoOk, setVideoOk] = useState(true);

  if (!isActive || !isDesktop) return null;

  return (
    <div className="canario-bg print:hidden" aria-hidden="true">
      {/* — a) Vídeo real (Roque Nublo + Teide al fondo) en bucle — */}
      {videoOk && (
        <video
          ref={videoRef}
          className="canario-video"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          // poster opcional: si pones un JPG de la primera frame en
          // /videos/canario-poster.jpg lo usamos como placeholder
          // mientras carga el MP4. Si no existe, no pasa nada.
          poster="/videos/canario-poster.jpg"
          onError={() => setVideoOk(false)}
        >
          <source src="/videos/canario.mp4" type="video/mp4" />
        </video>
      )}

      {/* — b) Silueta CSS del Teide al fondo (siempre presente, queda
       *     tapada por el vídeo cuando carga; cuando no, refuerza la
       *     lectura del paisaje). */}
      <div className="canario-teide-silhouette" />

      {/* — c) Halo del sol bajo (pulso lento) — */}
      <div className="canario-sun-halo" />

      {/* — d) Niebla de calor en el horizonte — */}
      <div className="canario-haze" />

      {/* — e) Motas de polvo flotando — */}
      <div className="canario-dust">
        {DUST.map((d, i) => (
          <span
            key={i}
            className="dust"
            style={{
              left: `${d.left}vw`,
              top: `${d.top}vh`,
              width: `${d.size}px`,
              height: `${d.size}px`,
              animationDelay: `${d.delay}s`,
              animationDuration: `${d.duration}s`,
            }}
          />
        ))}
      </div>

      {/* — f) Viñeta principal — */}
      <div className="canario-vignette" />

      {/* — g) Grano fílmico — */}
      <div className="canario-grain" />
    </div>
  );
}
