"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<VideoThemeBackground />` — capa cinemática genérica para temas
 * basados en VÍDEO real en bucle.
 *
 * Reemplaza al patrón individual (ej. `CanarioBackground`) por una sola
 * implementación parametrizada. Cada uso pasa `themeId`, `prefix` y
 * `videoSrc`; el CSS por tema vive en `app/theme-<id>.css` y prefija
 * todas sus clases con el `prefix` (p. ej. `canario-bg`, `canario-glow-1`).
 *
 * Capas que monta (todas opcionales — si el CSS no les da estilo,
 * son invisibles, sin coste):
 *
 *   1. `<video>` en bucle, muteado, autoplay, playsInline.
 *      - Si falla la carga (404, codec) se oculta y el resto de capas
 *        toma el relevo, garantizando que NUNCA se vea un rectángulo
 *        negro en producción aunque `/videos/<id>.mp4` aún no se haya
 *        desplegado en ese servidor.
 *   2. `.{prefix}-fallback` — capa decorativa de respaldo (silueta,
 *      gradiente, etc.) que cobra protagonismo si el vídeo no carga.
 *   3. `.{prefix}-glow-1` y `.{prefix}-glow-2` — halos atmosféricos.
 *   4. `.{prefix}-haze` — niebla / banda atmosférica del horizonte.
 *   5. `.{prefix}-dust` — N motas determinísticas con animación CSS.
 *   6. `.{prefix}-vignette` — viñeta principal.
 *   7. `.{prefix}-grain` — grano fílmico fino.
 *
 * Determinístico (cero `Math.random()`): SSR/CSR producen el mismo
 * HTML — sin hydration mismatches. Solo se monta cuando
 * `data-theme === themeId` (mismo patrón que `ImageThemeBackground`).
 *
 * REDUCED MOTION: el `<video>` se pausa explícitamente desde JS y las
 * animaciones decorativas las neutraliza el CSS de cada tema.
 *
 * DESKTOP ONLY: si `desktopOnly` está activo (default), el componente
 * no se monta en viewports < 768px. Para temas pesados con vídeo
 * full-bleed, esta es la decisión correcta — vive también en
 * `DESKTOP_ONLY_THEMES` de `lib/theme.ts` para que el selector lo
 * oculte y `getStoredTheme` haga fallback a "aurora" en móvil.
 */

interface DustParticle {
  /** Posición horizontal inicial en `vw`. */
  left: number;
  /** Posición vertical inicial en `vh`. */
  top: number;
  /** Tamaño del círculo en px. */
  size: number;
  /** Delay negativo para arrancar las animaciones desfasadas. */
  delay: number;
  /** Duración total de un ciclo de la animación (s). */
  duration: number;
}

/**
 * Configuración determinística de las motas. La heredamos de `canario`
 * — distribuye 6 puntos por la mitad inferior del viewport con tamaños
 * y duraciones variables para que el conjunto se sienta orgánico sin
 * usar números aleatorios (que romperían el SSR).
 *
 * Cada tema puede pedir N motas (1..6) con `dustCount`; si pasas 0 la
 * capa entera se omite del DOM.
 */
const DEFAULT_DUST: ReadonlyArray<DustParticle> = [
  { left: 12, top: 75, size: 3, delay: 0, duration: 22 },
  { left: 28, top: 82, size: 2, delay: -4, duration: 26 },
  { left: 44, top: 70, size: 4, delay: -8, duration: 20 },
  { left: 62, top: 88, size: 2, delay: -12, duration: 28 },
  { left: 78, top: 76, size: 3, delay: -16, duration: 24 },
  { left: 92, top: 84, size: 2, delay: -20, duration: 26 },
];

interface VideoThemeBackgroundProps {
  /** ID exacto del tema en `data-theme="<id>"`. */
  themeId: string;
  /** Prefix usado en las clases CSS del tema (p. ej. "canario", "espacio"). */
  prefix: string;
  /** Ruta del MP4 (servido como recurso estático desde `/public/`). */
  videoSrc: string;
  /**
   * Ruta opcional del JPG poster (primer frame del vídeo). Mejora el
   * tiempo hasta el primer paint. Si no existe, no pasa nada — el
   * navegador simplemente no muestra nada hasta que llega el vídeo.
   */
  posterSrc?: string;
  /**
   * Si true (default), el componente solo se monta en viewports ≥768px.
   * Pon `false` para temas con vídeo ligero/optimizado que sí quieras
   * activos en móvil (recordando que también hay que sacarlos del
   * `DESKTOP_ONLY_THEMES` en `lib/theme.ts`).
   */
  desktopOnly?: boolean;
  /**
   * Cuántas motas quieres montar en la capa `.{prefix}-dust` (0..6).
   * Default 6. Pon 0 para temas donde las motas no encajen (espacio
   * profundo, líquido, etc. — ahí prefieres polvo estelar custom en CSS).
   */
  dustCount?: number;
}

export function VideoThemeBackground({
  themeId,
  prefix,
  videoSrc,
  posterSrc,
  desktopOnly = true,
  dustCount = 6,
}: VideoThemeBackgroundProps) {
  const { theme } = useTheme();

  /* Detección dual del tema activo (idéntica al resto de Backgrounds):
   *   - estado de React (`ThemeProvider`)
   *   - MutationObserver sobre el atributo `data-theme` del <html>
   * Así sobrevivimos a cambios externos (otra pestaña, datawall mirror,
   * devtools) sin requerir un re-render desde el árbol de React. */
  const subscribe = (cb: () => void) => {
    if (typeof window === "undefined") return () => {};
    const mo = new MutationObserver(cb);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => mo.disconnect();
  };
  const getIs = () => {
    if (typeof document === "undefined") return false;
    return document.documentElement.dataset.theme === themeId;
  };
  const htmlActive = useSyncExternalStore(subscribe, getIs, () => false);
  const isActive = theme === themeId || htmlActive;

  /* SSR-safe desktop check: arrancamos en `false` para que el server
   * nunca renderice el bloque (evita hydration mismatch). Tras montar,
   * matchMedia decide si lo activamos. Solo aplica si `desktopOnly`. */
  const [isDesktop, setIsDesktop] = useState(!desktopOnly);
  useEffect(() => {
    if (!desktopOnly) {
      setIsDesktop(true);
      return;
    }
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [desktopOnly]);

  /* Reduced motion: pausa el <video> desde JS (CSS no puede). El resto
   * de animaciones las neutraliza el CSS por tema. */
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
        // play() puede fallar si el usuario aún no ha interactuado con
        // la página (autoplay policy). Lo silenciamos: el muted+autoplay
        // suele bastar, y si no, el siguiente click lo arranca.
        v.play().catch(() => {});
      }
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [isActive]);

  /* Si el vídeo falla (404 porque aún no se ha desplegado, o error de
   * codec), lo ocultamos para que las capas CSS de respaldo tomen el
   * relevo y el tema NUNCA se vea como un rectángulo negro. */
  const [videoOk, setVideoOk] = useState(true);

  if (!isActive || !isDesktop) return null;

  const c = (suffix: string) => `${prefix}-${suffix}`;
  const dust = dustCount > 0 ? DEFAULT_DUST.slice(0, Math.min(dustCount, 6)) : [];

  return (
    <div className={`${c("bg")} print:hidden`} aria-hidden="true">
      {videoOk && (
        <video
          ref={videoRef}
          className={c("video")}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          poster={posterSrc}
          onError={() => setVideoOk(false)}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      )}

      <div className={c("fallback")} />
      <div className={c("glow-1")} />
      <div className={c("glow-2")} />
      <div className={c("haze")} />

      {dust.length > 0 && (
        <div className={c("dust")}>
          {dust.map((d, i) => (
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
      )}

      <div className={c("vignette")} />
      <div className={c("grain")} />
    </div>
  );
}
