export const THEME_STORAGE_KEY = "cc-ops-theme";

/**
 * Modos de tema disponibles (clasificados por categoría):
 *   ── ESENCIALES ─────────────────────────────────────────────────────
 *   - `aurora`: oscuro base con orbes animados (predeterminado).
 *   - `light` : claro (overrides en `app/theme-light.css`).
 *   - `dark`  : oscuro plano sin orbes.
 *
 *   ── CRISTAL ────────────────────────────────────────────────────────
 *   - `glass` : cristal esmerilado violeta + parallax.
 *   - `slate` : cristal neutro grafito sin marco.
 *
 *   ── CINEMÁTICOS ────────────────────────────────────────────────────
 *   - `ocaso`   : atardecer cinematográfico cálido (sol + montañas).
 *   - `neon`    : Cyberpunk Blade Runner — skyline neon rosa+cyan.
 *   - `volcano` : volcán en erupción al fondo.
 *   - `abyss`   : océano profundo con medusas bioluminiscentes.
 *   - `cosmos`  : nebulosa espacial (blobs magenta/violeta).
 *   - `storm`   : noche eléctrica con relámpagos y lluvia.
 *
 *   ── INSTITUCIONAL ──────────────────────────────────────────────────
 *   - `ccmgc`   : branding del CCMGC (mapa de Gran Canaria + GC-1/2/3).
 *
 *   ── NATURALEZA CANARIA ─────────────────────────────────────────────
 *   - `dunas`   : Dunas de Maspalomas al atardecer.
 *
 *   ── CÓSMICOS ───────────────────────────────────────────────────────
 *   - `meteor`  : lluvia de meteoros.
 *
 *   ── TRIBUTO ────────────────────────────────────────────────────────
 *   Todos los temas tributo aíslan totalmente sus estilos bajo
 *   `html[data-theme="<id>"]` y nunca afectan a Aurora ni al resto.
 *
 *   - `akatsuki`   : Naruto / Akatsuki — negro carbón + rojo sangre,
 *                    nubes akagumo, kanji 暁 y Sharingan.
 *   - `evangelion` : NGE — terminal NERV / MAGI, AT-Field hexagonal,
 *                    paleta naranja + cyan + violeta sobre negro.
 *   - `sith`       : Star Wars (lado oscuro) — hyperspace negro,
 *                    sable rojo vertical pulsante, halo de la Death
 *                    Star.
 *   - `matrix`     : Matrix — lluvia de código katakana verde
 *                    fosfórico cayendo.
 *   - `stranger`   : Stranger Things — Upside Down con tendrils,
 *                    bombillas parpadeantes y fuente neón roja.
 *   - `cyberpunk`  : Cyberpunk 2077 — Night City glitch amarillo
 *                    Arasaka + cyan, scanlines y RAM-flash.
 *   - `sheikah`    : Zelda BOTW/TOTK — runas Sheikah cian sobre
 *                    piedra antigua, hojas doradas.
 *   - `mordor`     : LOTR Mordor — Ojo de Sauron en una torre lejana
 *                    + lava + runas tengwar.
 *   - `tron`       : Tron — grid neón cyan en perspectiva,
 *                    lightcycle trail, paleta azul-cyan.
 *   - `persona5`   : P5 — collage rojo-negro estilo cómic con
 *                    "ALL-OUT ATTACK" y máscaras.
 *   - `midgar`     : FF7 Midgar — mako verde fluyendo, meteoro rojo
 *                    y silueta de la ciudad-pizza.
 *   - `interstellar`: Gargantua — agujero negro con disco de
 *                     acreción + maizal sepia y polvo.
 *   - `synthwave` : Outrun retro 80s — sol partido magenta-naranja
 *                   + grid violeta en perspectiva.
 *   - `hollow`     : Hollow Knight — Hallownest azul abismal,
 *                    spores blancos cayendo, melancolía bichesca.
 *   - `demonslayer`: Kimetsu no Yaiba — patrón checkered Tanjiro
 *                    verde-negro + llamas Hinokami Kagura naranja.
 *   - `ghibli`     : Studio Ghibli — pradera Totoro pastel, lluvia
 *                    tenue y susuwatari (motas negras flotando).
 *   - `deathnote`  : Death Note — kanji L gigante en hueso sobre
 *                    fondo gótico, manzana roja como acento.
 *   - `onepiece`   : One Piece — mar Grand Line al atardecer,
 *                    Jolly Roger ondeando, sol naranja pirata.
 */
export type ThemeMode =
  | "dark"
  | "light"
  | "aurora"
  | "glass"
  | "slate"
  | "ocaso"
  | "neon"
  | "volcano"
  | "abyss"
  | "cosmos"
  | "storm"
  | "ccmgc"
  | "dunas"
  | "meteor"
  | "akatsuki"
  | "evangelion"
  | "sith"
  | "matrix"
  | "stranger"
  | "cyberpunk"
  | "sheikah"
  | "mordor"
  | "tron"
  | "persona5"
  | "midgar"
  | "interstellar"
  | "synthwave"
  | "hollow"
  | "demonslayer"
  | "ghibli"
  | "deathnote"
  | "onepiece";

export const THEME_MODES: ThemeMode[] = [
  "aurora",
  "light",
  "dark",
  "glass",
  "slate",
  "ocaso",
  "neon",
  "volcano",
  "abyss",
  "cosmos",
  "storm",
  "ccmgc",
  "dunas",
  "meteor",
  "akatsuki",
  "evangelion",
  "sith",
  "matrix",
  "stranger",
  "cyberpunk",
  "sheikah",
  "mordor",
  "tron",
  "persona5",
  "midgar",
  "interstellar",
  "synthwave",
  "hollow",
  "demonslayer",
  "ghibli",
  "deathnote",
  "onepiece",
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
 *
 *  Fecha de marca: 2026-06-07 — pendientes de pulido visual:
 *    - interstellar : Gargantua aún no se parece lo suficiente al de la peli
 *    - mordor       : torre/volcán necesitan más detalle
 *    - synthwave    : iteración visual pendiente
 *    - demonslayer  : no transmite el universo de la serie
 *    - ghibli       : legibilidad + calidad de fondo Miyazaki-style
 *    - onepiece     : barco/cielo Grand Line aún por refinar
 */
export const WIP_THEMES: ReadonlySet<ThemeMode> = new Set<ThemeMode>([
  "interstellar",
  "mordor",
  "synthwave",
  "demonslayer",
  "ghibli",
  "onepiece",
]);

/** Devuelve true si el tema está disponible para el usuario (no es WIP). */
export function isThemeAvailable(mode: ThemeMode): boolean {
  return !WIP_THEMES.has(mode);
}

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "aurora";
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v && (THEME_MODES as readonly string[]).includes(v)) {
      // Si el tema guardado está marcado como WIP, ignorarlo y caer a aurora
      // para que el usuario nunca quede atrapado en un tema en construcción.
      if (WIP_THEMES.has(v as ThemeMode)) return "aurora";
      return v as ThemeMode;
    }
    return "aurora";
  } catch {
    return "aurora";
  }
}

/**
 * Lista de modos que se aplican al `<html>` mediante `data-theme="<id>"`.
 * Todos excepto:
 *   - `dark`: estado base del CSS (sin atributos).
 *   - `aurora`: usa `data-aurora="true"` en su lugar (legado).
 */
const DATA_THEME_MODES: ReadonlySet<ThemeMode> = new Set<ThemeMode>([
  "light",
  "glass",
  "slate",
  "ocaso",
  "neon",
  "volcano",
  "abyss",
  "cosmos",
  "storm",
  "ccmgc",
  "dunas",
  "meteor",
  "akatsuki",
  "evangelion",
  "sith",
  "matrix",
  "stranger",
  "cyberpunk",
  "sheikah",
  "mordor",
  "tron",
  "persona5",
  "midgar",
  "interstellar",
  "synthwave",
  "hollow",
  "demonslayer",
  "ghibli",
  "deathnote",
  "onepiece",
]);

/**
 * Sincroniza los atributos del `<html>`:
 *   - `data-theme="<id>"` para todos los modos con CSS scopeado.
 *   - `data-aurora="true"` para Aurora (sin `data-theme`).
 *   - Sin atributos para `dark` (estado base del CSS).
 *
 * Garantiza limpiar siempre el atributo opuesto antes de aplicar.
 */
export function applyThemeToDocument(mode: ThemeMode): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  // GUARDIA WIP: si alguien intenta forzar un tema en construcción
  // (por URL, devtools, llamada directa, etc.) lo redirigimos a aurora.
  const safeMode: ThemeMode = WIP_THEMES.has(mode) ? "aurora" : mode;

  if (DATA_THEME_MODES.has(safeMode)) {
    root.dataset.theme = safeMode;
    root.removeAttribute("data-aurora");
    return;
  }
  root.removeAttribute("data-theme");
  if (safeMode === "aurora") root.setAttribute("data-aurora", "true");
  else root.removeAttribute("data-aurora");
}
