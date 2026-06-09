export const THEME_STORAGE_KEY = "cc-ops-theme";

/**
 * Modos de tema disponibles (clasificados por categoría):
 *   ── ESENCIALES ─────────────────────────────────────────────────────
 *   - `aurora`: oscuro base con orbes animados (predeterminado).
 *   - `light` : claro (overrides en `app/theme-light.css`).
 *
 *   ── CRISTAL ────────────────────────────────────────────────────────
 *   - `glass` : cristal esmerilado violeta + parallax.
 *   - `slate` : cristal neutro grafito sin marco.
 *
 *   ── CINEMÁTICOS ────────────────────────────────────────────────────
 *   - `ocaso`   : atardecer cinematográfico cálido (sol + montañas).
 *   - `volcano` : volcán en erupción al fondo.
 *   - `abyss`   : océano profundo con medusas bioluminiscentes.
 *   - `cosmos`  : nebulosa espacial (blobs magenta/violeta).
 *   - `storm`   : noche eléctrica con relámpagos y lluvia.
 *
 *   ── CÓSMICOS ───────────────────────────────────────────────────────
 *   - `meteor`  : lluvia de meteoros.
 *   - `comet`   : cometa azul brillante cruzando un cielo nocturno cálido.
 *
 *   ── TRIBUTO ────────────────────────────────────────────────────────
 *   Todos los temas tributo aíslan totalmente sus estilos bajo
 *   `html[data-theme="<id>"]` y nunca afectan a Aurora ni al resto.
 *   La mayoría usa el componente genérico `<ImageThemeBackground />` y
 *   solo cambia el CSS scopeado (paleta, capas atmosféricas).
 *
 *   - `sith`        : Star Wars (lado oscuro) — hyperspace negro,
 *                     sable rojo vertical pulsante, halo Death Star.
 *   - `stranger`    : Stranger Things — Upside Down con tendrils,
 *                     bombillas parpadeantes y fuente neón roja.
 *   - `ghibli`      : Studio Ghibli — atardecer Ghibli oscuro cálido,
 *                     girasoles, lluvia tenue y susuwatari.
 *   - `itachi`      : Naruto / Itachi Uchiha — cinemático con IMAGEN
 *                     real (luna roja + cuervos) + parallax al cursor,
 *                     Ken Burns lento, ascuas flotantes, glow lunar.
 *   - `amegakure`   : Naruto × Cyberpunk — Amegakure reimaginada como
 *                     Night City (imagen 4K real). Marco cristal cyan/
 *                     magenta, lluvia neón diagonal, flicker de carteles.
 *   - `sololeveling`: Solo Leveling — Sung Jin-Woo invocando al Dragón
 *                     Sombra (aura azul) con aura del Beast Monarch
 *                     (carmesí). Imagen 4K, parallax al cursor, halos
 *                     pulsantes, chispas de mana, círculos rúnicos.
 */
export type ThemeMode =
  | "light"
  | "aurora"
  | "glass"
  | "slate"
  | "ocaso"
  | "volcano"
  | "abyss"
  | "cosmos"
  | "storm"
  | "meteor"
  | "comet"
  | "sith"
  | "stranger"
  | "ghibli"
  | "itachi"
  | "amegakure"
  | "sololeveling";

export const THEME_MODES: ThemeMode[] = [
  "aurora",
  "light",
  "glass",
  "slate",
  "ocaso",
  "volcano",
  "abyss",
  "cosmos",
  "storm",
  "meteor",
  "comet",
  "sith",
  "stranger",
  "ghibli",
  "itachi",
  "amegakure",
  "sololeveling",
];

/**
 * Temas TEMPORALMENTE deshabilitados (Work In Progress).
 *
 *  Estos temas siguen existiendo en el código (CSS, componentes, registro)
 *  pero NO se pueden activar desde la UI ni quedarse aplicados si están
 *  guardados en localStorage. El selector los oculta y `getStoredTheme` /
 *  `applyThemeToDocument` hacen fallback a "aurora".
 *
 *  Para reactivar uno: simplemente elimínalo de este Set.
 */
export const WIP_THEMES: ReadonlySet<ThemeMode> = new Set<ThemeMode>([]);

/** Devuelve true si el tema está disponible para el usuario (no es WIP). */
export function isThemeAvailable(mode: ThemeMode): boolean {
  return !WIP_THEMES.has(mode);
}

/**
 * Temas que SOLO se muestran/aplican en desktop.
 *
 *  Diseñados para usar vídeo o efectos pesados que en móvil/tablet no
 *  rinden bien o no aportan: el selector los oculta cuando el viewport
 *  es < DESKTOP_ONLY_MIN_WIDTH, y `getStoredTheme` /
 *  `applyThemeToDocument` hacen fallback a "aurora" si el usuario llega
 *  a móvil con uno guardado.
 *
 *  Actualmente vacío: tras la limpieza de temas con vídeo, ningún tema
 *  vigente necesita restricción desktop-only. Se mantiene el set por
 *  contrato de tipos (consumido por el selector, `getStoredTheme` y
 *  `applyThemeToDocument`); añadir aquí cualquier tema futuro que use
 *  efectos pesados.
 */
export const DESKTOP_ONLY_THEMES: ReadonlySet<ThemeMode> = new Set<ThemeMode>([]);

/**
 * Breakpoint para considerar "móvil" en este sistema. Coincide con
 * el `md:` de Tailwind (768px) — usuarios con tablet vertical tampoco
 * verán los temas pesados. Se evalúa en el cliente con matchMedia.
 */
export const DESKTOP_ONLY_MIN_WIDTH = 768;

/** True si el viewport actual cumple para mostrar/aplicar temas desktop-only. */
export function getCanUseDesktopOnly(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.matchMedia(`(min-width: ${DESKTOP_ONLY_MIN_WIDTH}px)`).matches;
  } catch {
    return true;
  }
}

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "aurora";
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v && (THEME_MODES as readonly string[]).includes(v)) {
      const mode = v as ThemeMode;
      // Si el tema guardado está marcado como WIP, ignorarlo y caer a aurora
      // para que el usuario nunca quede atrapado en un tema en construcción.
      if (WIP_THEMES.has(mode)) return "aurora";
      // Si es un tema desktop-only y estamos en móvil, también caer a
      // aurora (caso típico: usuario lo eligió en su PC y luego abre la
      // app en el móvil — no queremos un fondo pesado/roto).
      if (DESKTOP_ONLY_THEMES.has(mode) && !getCanUseDesktopOnly()) {
        return "aurora";
      }
      return mode;
    }
    return "aurora";
  } catch {
    return "aurora";
  }
}

/**
 * Lista de modos que se aplican al `<html>` mediante `data-theme="<id>"`.
 * Excepción: `aurora` usa `data-aurora="true"` en su lugar (legado).
 */
const DATA_THEME_MODES: ReadonlySet<ThemeMode> = new Set<ThemeMode>([
  "light",
  "glass",
  "slate",
  "ocaso",
  "volcano",
  "abyss",
  "cosmos",
  "storm",
  "meteor",
  "comet",
  "sith",
  "stranger",
  "ghibli",
  "itachi",
  "amegakure",
  "sololeveling",
]);

/**
 * Sincroniza los atributos del `<html>`:
 *   - `data-theme="<id>"` para todos los modos con CSS scopeado.
 *   - `data-aurora="true"` para Aurora (sin `data-theme`).
 *
 * Garantiza limpiar siempre el atributo opuesto antes de aplicar.
 */
export function applyThemeToDocument(mode: ThemeMode): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  // GUARDIA WIP: si alguien intenta forzar un tema en construcción
  // (por URL, devtools, llamada directa, etc.) lo redirigimos a aurora.
  let safeMode: ThemeMode = WIP_THEMES.has(mode) ? "aurora" : mode;
  // GUARDIA DESKTOP-ONLY: si en este viewport no es viable usar el tema,
  // tampoco lo aplicamos (ningún Background pesado, sin data-theme).
  if (DESKTOP_ONLY_THEMES.has(safeMode) && !getCanUseDesktopOnly()) {
    safeMode = "aurora";
  }

  if (DATA_THEME_MODES.has(safeMode)) {
    root.dataset.theme = safeMode;
    root.removeAttribute("data-aurora");
    return;
  }
  root.removeAttribute("data-theme");
  if (safeMode === "aurora") root.setAttribute("data-aurora", "true");
  else root.removeAttribute("data-aurora");
}
