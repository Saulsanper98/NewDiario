export const THEME_STORAGE_KEY = "cc-ops-theme";

/**
 * Modos de tema disponibles:
 *   - `aurora`: oscuro base con orbes animados (predeterminado).
 *   - `light` : claro (overrides en `app/theme-light.css`).
 *   - `dark`  : oscuro plano sin orbes.
 *   - `glass` : cristal esmerilado violeta + parallax (overrides en
 *               `app/theme-glass.css`, fondo propio en `<GlassBackground />`).
 *   - `slate` : cristal neutro grafito sin marco — pensado para uso diario
 *               (overrides en `app/theme-slate.css`, fondo propio en
 *               `<SlateBackground />`). Misma arquitectura que Glass pero
 *               paleta totalmente desaturada (slate/zinc) y sin glow.
 *   - `prisma`: tema "joya cinética" — violeta espacial profundo con grid
 *               en perspectiva, líneas de plasma SVG, polvo estelar y
 *               borde iridiscente animado (cyan→magenta→amarillo). Fondo
 *               propio en `<PrismaBackground />`. Pensado para uso puntual:
 *               cada visita es un pequeño espectáculo (overrides en
 *               `app/theme-prisma.css`).
 *   - `minimal`: tema "Minimal Future" — opuesto a Prisma. Casi negro puro
 *                + hairlines blancos + acento cyan ártico en focus.
 *                Superficies mate sin sombras grandes. Tipografía aireada.
 *                Lo "futurista" lo da la proporción y el detalle quirúrgico,
 *                no los efectos. Fondo propio en
 *                `<MinimalFutureBackground />` (un único halo cyan inmóvil
 *                arriba-izquierda). Overrides en `app/theme-minimal.css`.
 *   - `borealis`: tema "Aurora Borealis" — cinta de aurora SVG serpenteando
 *                 sobre noche ártica + ~80 constelaciones. Verde menta →
 *                 cyan → violeta → rosa salmón. Cards con borde superior
 *                 iridiscente. Fondo propio en `<BorealisBackground />`.
 *                 Overrides en `app/theme-borealis.css`.
 *   - `ocaso`   : tema "Ocaso" — atardecer cinematográfico cálido. Banda
 *                 horizontal del crepúsculo (violeta noche → coral →
 *                 naranja → crema dorada) con sol radial pulsante y
 *                 silueta de montañas. Cards cristal cálido. Fondo propio
 *                 en `<OcasoBackground />`. Overrides en `app/theme-ocaso.css`.
 *   - `terminal`: tema "Terminal Operations" — mil-spec / NORAD. Tipografía
 *                 monoespaciada global, verde fósforo `#00ff7f`, esquinas
 *                 marcadas ASCII en cards, scanlines CRT sutiles, barrido
 *                 radar. Encaja con el branding "Centro de Control de la
 *                 Movilidad". Fondo propio en `<TerminalBackground />`.
 *                 Overrides en `app/theme-terminal.css`.
 *   - `neon`    : tema "Neon City" — cyberpunk Blade Runner. Noche violeta
 *                 + skyline SVG con ventanas iluminadas parpadeando rosa/
 *                 cyan/amarillo. Cards con doble borde rosa+cyan. Fondo
 *                 propio en `<NeonBackground />`. Overrides en
 *                 `app/theme-neon.css`.
 */
export type ThemeMode =
  | "dark"
  | "light"
  | "aurora"
  | "glass"
  | "slate"
  | "prisma"
  | "minimal"
  | "borealis"
  | "ocaso"
  | "terminal"
  | "neon";

export const THEME_MODES: ThemeMode[] = [
  "aurora",
  "light",
  "dark",
  "glass",
  "slate",
  "prisma",
  "minimal",
  "borealis",
  "ocaso",
  "terminal",
  "neon",
];

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "aurora";
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v && (THEME_MODES as readonly string[]).includes(v)) return v as ThemeMode;
    return "aurora";
  } catch {
    return "aurora";
  }
}

/**
 * Sincroniza los atributos del `<html>`:
 *   - `data-theme="light"` para el tema claro.
 *   - `data-theme="glass"` para el tema Cristal (sin `data-aurora` — los orbes
 *     los gestiona `<GlassBackground />`, no se reusan los de Aurora).
 *   - `data-theme="slate"` para el tema Slate (fondo grafito; orbes
 *     gestionados por `<SlateBackground />`).
 *   - `data-theme="prisma"` para el tema Prisma (fondo cinético; capas
 *     gestionadas por `<PrismaBackground />`).
 *   - `data-theme="minimal"` para el tema Minimal Future (un único halo
 *     inmóvil; gestionado por `<MinimalFutureBackground />`).
 *   - `data-aurora="true"` para Aurora.
 *   - Sin atributos para el oscuro plano (estado base del CSS).
 */
export function applyThemeToDocument(mode: ThemeMode): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (mode === "light") {
    root.dataset.theme = "light";
    root.removeAttribute("data-aurora");
    return;
  }
  if (mode === "glass") {
    root.dataset.theme = "glass";
    root.removeAttribute("data-aurora");
    return;
  }
  if (mode === "slate") {
    root.dataset.theme = "slate";
    root.removeAttribute("data-aurora");
    return;
  }
  if (mode === "prisma") {
    root.dataset.theme = "prisma";
    root.removeAttribute("data-aurora");
    return;
  }
  if (mode === "minimal") {
    root.dataset.theme = "minimal";
    root.removeAttribute("data-aurora");
    return;
  }
  if (mode === "borealis") {
    root.dataset.theme = "borealis";
    root.removeAttribute("data-aurora");
    return;
  }
  if (mode === "ocaso") {
    root.dataset.theme = "ocaso";
    root.removeAttribute("data-aurora");
    return;
  }
  if (mode === "terminal") {
    root.dataset.theme = "terminal";
    root.removeAttribute("data-aurora");
    return;
  }
  if (mode === "neon") {
    root.dataset.theme = "neon";
    root.removeAttribute("data-aurora");
    return;
  }
  root.removeAttribute("data-theme");
  if (mode === "aurora") root.setAttribute("data-aurora", "true");
  else root.removeAttribute("data-aurora");
}
