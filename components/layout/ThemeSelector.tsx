"use client";

import { useState, useEffect, useRef, useLayoutEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Sun,
  Sparkles,
  Check,
  ChevronDown,
  Droplets,
  Layers,
  Sunset,
  Search,
  X,
  Flame,
  Waves,
  Orbit,
  CloudLightning,
  Building2,
  Stars,
  Eye,
  Swords,
  Lightbulb,
  Cloud,
} from "lucide-react";
import { useTheme } from "@/components/layout/ThemeProvider";
import {
  
  DESKTOP_ONLY_THEMES,
  DESKTOP_ONLY_MIN_WIDTH,
  isThemeAvailable,
  type ThemeMode,
  isLightTheme,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Opciones del selector — DEFINICIÓN.
 *
 * Cada opción tiene id, label visible, descripción (hint, una línea), un icono,
 * un "category" para agrupar visualmente en el dropdown, y un `swatch`: un
 * gradient CSS que sirve de mini-preview visual del tema en la tarjeta. La
 * categoría también se usa para indexar el buscador (escribir el nombre de
 * categoría filtra los temas de esa familia).
 *
 * El orden importa: dentro de cada categoría se renderiza en el orden de este
 * array. La cabecera de categoría se inyecta automáticamente entre grupos.
 */
type ThemeOption = {
  id: ThemeMode;
  label: string;
  hint: string;
  Icon: typeof Sun;
  category: CategoryId;
  swatch: string;
};

type CategoryId =
  | "essentials"
  | "crystal"
  | "scenic"
  | "cosmic"
  | "tribute";

const CATEGORY_LABEL: Record<CategoryId, string> = {
  essentials: "Esenciales",
  crystal: "Cristal",
  scenic: "Cinemáticos",
  cosmic: "Cósmicos",
  tribute: "Tributo",
};

/*
 * Los `swatch` siguen un patrón consistente:
 *   - Usan los colores característicos del tema correspondiente
 *     (p.ej. coral/violeta para Volcán, azul-cyan para Tormenta).
 *   - Son `linear-gradient` (135deg) salvo casos como Prisma (conic).
 *   - Cada miniatura intenta evocar el fondo real del tema para que el
 *     usuario reconozca de un vistazo qué va a ver al activarlo.
 */
const OPTIONS: ThemeOption[] = [
  // Esenciales: los 2 modos base (oscuro con orbes animados + claro).
  { id: "aurora", label: "Aurora", hint: "Oscuro con orbes animados (predeterminado)", Icon: Sparkles, category: "essentials",
    swatch: "linear-gradient(135deg, #1a1530 0%, #4f2d8a 50%, #2a7fb8 100%)" },
  { id: "light", label: "Claro", hint: "Cristal premium sobre lienzo suave (sin orbes)", Icon: Sun, category: "essentials",
    swatch: "linear-gradient(135deg, #ffffff 0%, #f3eccd 60%, #ffeb66 100%)" },
  // Cristal: variantes glassmorphism (parallax violeta + grafito neutro).
  { id: "slate", label: "Slate", hint: "Cristal real con orbes en deriva y borde animado", Icon: Layers, category: "crystal",
    swatch: "linear-gradient(135deg, #1f2937 0%, #475569 50%, #94a3b8 100%)" },
  { id: "glass", label: "Cristal", hint: "Glassmorphism violeta con fondo en parallax", Icon: Droplets, category: "crystal",
    swatch: "linear-gradient(135deg, #1e1b4b 0%, #6d28d9 50%, #c4b5fd 100%)" },
  // Cinemáticos: temas espectaculares de uso puntual (estilo escenario).
  { id: "ocaso", label: "Ocaso", hint: "Atardecer cinematográfico: sol radial, banda crepuscular", Icon: Sunset, category: "scenic",
    swatch: "linear-gradient(180deg, #2a1340 0%, #6e2155 30%, #d96a3e 65%, #f4c373 100%)" },
  { id: "volcano", label: "Volcán", hint: "Cumbre encendida: silueta del volcán con cráter, brasa y chispas", Icon: Flame, category: "scenic",
    swatch: "linear-gradient(180deg, #0d0410 0%, #2d0a14 40%, #6b1808 75%, #ff6b3d 100%)" },
  { id: "abyss", label: "Abismo", hint: "Bajo el océano: medusas bioluminiscentes, god rays y plancton", Icon: Waves, category: "scenic",
    swatch: "linear-gradient(180deg, #001828 0%, #003355 50%, #00aacc 100%)" },
  { id: "cosmos", label: "Cosmos", hint: "Nebulosa espacial: blobs magenta/violeta girando + estrellas", Icon: Orbit, category: "scenic",
    swatch: "linear-gradient(135deg, #0a0418 0%, #4a1a6e 50%, #c43cb8 100%)" },
  { id: "storm", label: "Tormenta", hint: "Noche eléctrica: nubes en deriva, relámpagos esporádicos y lluvia", Icon: CloudLightning, category: "scenic",
    swatch: "linear-gradient(180deg, #060812 0%, #131a2c 60%, #a8c8ff 100%)" },
  // Cósmicos: temas espaciales (lluvia de meteoros + cometa).
  { id: "meteor", label: "Meteoros", hint: "Lluvia de meteoros: cielo profundo con Vía Láctea y estelas cruzando", Icon: Stars, category: "cosmic",
    swatch: "linear-gradient(135deg, #020410 0%, #060a18 40%, #1a0a3a 75%, #67e8f9 110%)" },
  { id: "comet", label: "Cometa", hint: "Cometa azul brillante cruzando un cielo nocturno cálido", Icon: Sparkles, category: "cosmic",
    swatch: "linear-gradient(135deg, #050a18 0%, #081020 35%, #0c1830 65%, #1a2a4a 100%), radial-gradient(circle at 70% 30%, rgba(0,216,255,0.55) 0%, rgba(255,104,80,0.25) 25%, transparent 45%)" },
  // Tributo: temas homenaje a referentes culturales. Cada uno aísla
  // totalmente su CSS bajo `html[data-theme="<id>"]` y nunca afecta a
  // Aurora ni al resto. La mayoría usa el componente genérico
  // `<ImageThemeBackground />` con una imagen 4K real + capas atmosféricas.
  { id: "sith", label: "Star Wars: Sith", hint: "Star Wars: hyperspace + sable rojo vertical + halo de la Death Star", Icon: Swords, category: "tribute",
    swatch: "radial-gradient(circle at 50% 50%, rgba(255,28,40,0.55) 0%, transparent 35%), linear-gradient(135deg, #000000 0%, #0a0008 60%, #2a0008 100%)" },
  { id: "stranger", label: "Stranger Things", hint: "Stranger Things: Upside Down con tendrils, bombillas y rojo neón retro 80s", Icon: Lightbulb, category: "tribute",
    swatch: "linear-gradient(135deg, #1a0510 0%, #330014 45%, #aa0028 90%), radial-gradient(circle at 70% 30%, rgba(255,0,80,0.42) 0%, transparent 55%)" },
  { id: "ghibli", label: "Studio Ghibli", hint: "Ghibli: atardecer dorado, girasoles y susuwatari (motas) flotando al ocaso", Icon: Cloud, category: "tribute",
    swatch: "linear-gradient(180deg, #0e1c20 0%, #142428 50%, #0a161a 100%), radial-gradient(circle at 65% 35%, rgba(255,200,120,0.55) 0%, rgba(245,170,80,0.20) 25%, transparent 55%)" },
  // Itachi: tema "premium" basado en una IMAGEN real (luna roja + cuervos)
  // con parallax al cursor y efectos cinemáticos. La preview hace una
  // recreación abstracta de la imagen (cielo rojo + luna blanca + ascuas).
  { id: "itachi", label: "Itachi Uchiha", hint: "Itachi: imagen cinemática real, luna roja, cuervos en parallax, ascuas flotantes", Icon: Eye, category: "tribute",
    swatch: "radial-gradient(circle at 22% 58%, rgba(255,235,210,0.95) 0%, rgba(255,180,140,0.4) 7%, transparent 11%), radial-gradient(ellipse at 65% 45%, rgba(255,80,60,0.55) 0%, transparent 55%), linear-gradient(160deg, #2a0606 0%, #5a0a0a 45%, #1a0303 100%)" },
  // Amegakure: Naruto × Cyberpunk con imagen 4K real, marco cristal
  // cyan/magenta y lluvia neón. Preview: cielo violeta + carteles cyan/
  // magenta abstractos.
  { id: "amegakure", label: "Amegakure", hint: "Naruto × Cyberpunk: Aldea de la Lluvia como Night City con neones y lluvia diagonal", Icon: Building2, category: "tribute",
    swatch: "linear-gradient(180deg, #1a0e2a 0%, #2a0e3e 35%, #0a0613 100%), repeating-linear-gradient(105deg, transparent 0 6px, rgba(0,224,255,0.18) 7px, transparent 8px 14px), radial-gradient(circle at 78% 22%, rgba(255,75,200,0.45) 0%, transparent 35%)" },
  // Solo Leveling: Sung Jin-Woo invocando al Dragón Sombra (azul) con
  // aura del Beast Monarch (rojo). Imagen 4K, marco cristal azul→rojo,
  // halos pulsantes y chispas. Preview: aura azul izquierda + roja
  // derecha sobre noche profunda.
  { id: "sololeveling", label: "Solo Leveling", hint: "Sung Jin-Woo: Dragón Sombra azul + aura Beast Monarch carmesí, parallax cinemático 4K", Icon: Swords, category: "tribute",
    swatch: "radial-gradient(circle at 22% 35%, rgba(74,143,255,0.65) 0%, rgba(74,143,255,0.15) 25%, transparent 50%), radial-gradient(circle at 80% 65%, rgba(255,70,80,0.55) 0%, rgba(255,70,80,0.15) 25%, transparent 50%), linear-gradient(180deg, #050a18 0%, #0c1838 50%, #050a18 100%)" },
];

const CATEGORY_ORDER: CategoryId[] = [
  "essentials",
  "crystal",
  "scenic",
  "cosmic",
  "tribute",
];

/* Layout en columnas por categoría:
 *   - `essentials`: 2 columnas (los 2 modos base: Aurora + Claro).
 *   - `crystal`:    2 columnas.
 *   - `scenic`:     2 columnas.
 *   - `cosmic`:     2 columnas.
 *   - `tribute`:    2 columnas para mantener swatches grandes con tantos
 *                   temas (3 columnas haría las miniaturas demasiado chicas).
 * Estos números los inyectamos como clases Tailwind explícitas para que el
 * JIT las genere. */
const CATEGORY_COLS: Record<CategoryId, string> = {
  essentials: "grid-cols-2",
  crystal: "grid-cols-2",
  scenic: "grid-cols-2",
  cosmic: "grid-cols-2",
  tribute: "grid-cols-2",
};

type PanelCoords = { top: number; right: number; width: number; maxHeight: number };

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [coords, setCoords] = useState<PanelCoords | null>(null);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  // Posicionamiento del dropdown anclado al trigger. Calcula también la
  // altura máxima disponible hasta el bottom del viewport (con margen 16px),
  // que se aplica al contenedor scrolleable interno. Esto evita que el panel
  // se salga de la pantalla cuando hay muchos temas.
  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    function place() {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // 360px en desktop (caben 2 tarjetas + paddings cómodamente),
      // encogiendo en móvil hasta `viewport - 20`.
      const width = Math.min(360, window.innerWidth - 20);
      const top = r.bottom + 8;
      // Reservamos 16px de margen al bottom del viewport para que nunca pegue
      // al borde y deje aire visual.
      const maxHeight = Math.max(280, window.innerHeight - top - 16);
      setCoords({
        top,
        right: window.innerWidth - r.right,
        width,
        maxHeight,
      });
    }
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);

  // Cierra el dropdown si el usuario hace scroll en cualquier parte de la
  // página: el panel está posicionado `fixed` al rect del trigger, así que
  // si la página se mueve el panel quedaría desanclado. Esto es estándar
  // del patrón de "Headless Combobox/Listbox".
  //
  // IMPORTANTE: hay que excluir el scroll DENTRO del propio panel. El
  // listener se registra en fase capture (`true`) para detectar scroll de
  // cualquier contenedor scrolleable, incluido el `theme-selector-scroll`
  // interno. Sin esta exclusión, al usar la rueda dentro del panel para
  // ver los temas de abajo, el panel se cerraría inmediatamente.
  useEffect(() => {
    if (!open) return;
    function onScroll(e: Event) {
      const target = e.target as Node | null;
      // Scroll dentro del propio panel → no cerrar.
      if (target && panelRef.current?.contains(target)) return;
      // Scroll del trigger o de su contenedor → no cerrar (defensivo).
      if (target && wrapRef.current?.contains(target)) return;
      setOpen(false);
    }
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [open]);

  // Click outside + tecla Escape para cerrar.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  // Resetear query y enfocar el buscador al abrir. El timeout 30ms evita
  // que el `mousedown` del trigger robe el focus en navegadores rápidos.
  useEffect(() => {
    if (open) {
      setQuery("");
      const t = setTimeout(() => searchRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Detecta si el viewport actual cumple para mostrar temas desktop-only
  // (vídeo full-bleed, efectos pesados). Reactivo a `resize` y
  // `change` del media query para que rotaciones de tablet o resize del
  // navegador refresquen el listado sin recargar.
  const [canDesktopOnly, setCanDesktopOnly] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(min-width: ${DESKTOP_ONLY_MIN_WIDTH}px)`);
    const update = () => setCanDesktopOnly(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Lista base: oculta los temas marcados como WIP en `lib/theme.ts` para
  // que no puedan activarse desde el selector hasta que estén pulidos.
  // Además, oculta los temas DESKTOP_ONLY cuando el viewport es móvil
  // para que el usuario no pueda activar un fondo pesado que no rinde.
  const AVAILABLE_OPTIONS = useMemo(
    () =>
      OPTIONS.filter((o) => {
        if (!isThemeAvailable(o.id)) return false;
        if (DESKTOP_ONLY_THEMES.has(o.id) && !canDesktopOnly) return false;
        return true;
      }),
    [canDesktopOnly]
  );

  // Filtro del buscador: matchea contra label, hint Y nombre de categoría.
  // Es case-insensitive y tolera espacios sobrantes.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return AVAILABLE_OPTIONS;
    return AVAILABLE_OPTIONS.filter((o) => {
      const cat = CATEGORY_LABEL[o.category].toLowerCase();
      return (
        o.label.toLowerCase().includes(q) ||
        o.hint.toLowerCase().includes(q) ||
        cat.includes(q)
      );
    });
  }, [query, AVAILABLE_OPTIONS]);

  // Agrupa los resultados por categoría preservando `CATEGORY_ORDER`. Se
  // recalcula cada vez que cambia el query.
  const grouped = useMemo(() => {
    const map = new Map<CategoryId, ThemeOption[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const opt of filtered) {
      const arr = map.get(opt.category);
      if (arr) arr.push(opt);
    }
    return CATEGORY_ORDER.map((cat) => ({
      id: cat,
      label: CATEGORY_LABEL[cat],
      items: map.get(cat) ?? [],
    })).filter((g) => g.items.length > 0);
  }, [filtered]);

  const current = OPTIONS.find((o) => o.id === theme) ?? OPTIONS[0];
  const ActiveIcon = current.Icon;
  const isLt = isLightTheme(theme);

  const panelDarkBg =
    "linear-gradient(155deg, rgb(13, 20, 40) 0%, rgb(10, 15, 28) 100%)";
  const panelLightBg =
    "linear-gradient(180deg, #f6f6f7 0%, #ececee 100%)";

  const dropdown =
    open &&
    coords &&
    portalReady &&
    createPortal(
      <div
        ref={panelRef}
        id="theme-selector-panel"
        role="listbox"
        aria-label="Elegir tema visual"
        className={cn(
          "animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden rounded-xl shadow-2xl flex flex-col",
          isLt ? "border border-zinc-200/90" : "border border-white/12"
        )}
        style={{
          position: "fixed",
          top: coords.top,
          right: coords.right,
          width: coords.width,
          maxHeight: coords.maxHeight,
          zIndex: 400,
          background: isLt ? panelLightBg : panelDarkBg,
          boxShadow: isLt
            ? "inset 0 1px 0 rgba(255,255,255,0.65), 0 1px 4px rgba(15,23,42,0.08)"
            : "0 16px 48px rgba(0,0,0,0.55)",
        }}
      >
        {/*
         * Buscador sticky en la cabecera. Filtra label/hint/categoría con
         * `includes` insensible a mayúsculas. Pensado para escalar a 15-20
         * temas — con pocos temas (≤6) podríamos ocultarlo, pero mantenerlo
         * siempre visible añade affordance (el usuario aprende a buscar
         * "ocaso", "claro", "cyber", etc.) sin sorprender cuando entren
         * nuevos temas.
         */}
        <div
          className={cn(
            "shrink-0 px-2.5 pt-2.5 pb-2 border-b",
            isLt ? "border-zinc-200/80" : "border-white/8"
          )}
        >
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors",
              isLt
                ? "bg-white/85 ring-1 ring-zinc-200/90 focus-within:ring-zinc-400/60"
                : "bg-white/[0.045] ring-1 ring-white/10 focus-within:ring-white/30"
            )}
          >
            <Search
              className={cn("w-3.5 h-3.5 shrink-0", isLt ? "text-zinc-400" : "text-white/40")}
              aria-hidden
            />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar tema..."
              aria-label="Buscar tema"
              className={cn(
                "min-w-0 flex-1 bg-transparent text-[12.5px] placeholder:opacity-50 focus:outline-none",
                isLt ? "text-zinc-800" : "text-white"
              )}
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  searchRef.current?.focus();
                }}
                aria-label="Limpiar búsqueda"
                className={cn(
                  "shrink-0 rounded p-0.5 transition-colors",
                  isLt
                    ? "text-zinc-400 hover:text-zinc-700 hover:bg-zinc-900/5"
                    : "text-white/40 hover:text-white hover:bg-white/10"
                )}
              >
                <X className="w-3 h-3" aria-hidden />
              </button>
            )}
          </div>
        </div>

        {/*
         * Lista scrolleable. `flex-1 min-h-0` permite que tome la altura
         * restante del flexbox del panel y muestre scroll cuando hay muchos
         * temas. La scrollbar custom evita los bordes pesados de Windows.
         */}
        <div
          ref={listRef}
          className="theme-selector-scroll flex-1 min-h-0 overflow-y-auto py-1"
        >
          {grouped.length === 0 && (
            <div
              className={cn(
                "px-3 py-6 text-center text-[12px]",
                isLt ? "text-zinc-500" : "text-white/45"
              )}
            >
              Sin resultados para &ldquo;{query}&rdquo;
            </div>
          )}
          {grouped.map((group) => (
            <div key={group.id} className="px-2 pb-1.5 last:pb-2">
              {/*
               * Cabecera de categoría: solo se muestra si no hay filtro, o
               * cuando hay filtro pero quedan ≥2 grupos. Con filtro a un
               * único grupo añadir la cabecera es ruidoso.
               */}
              {(query.trim() === "" || grouped.length > 1) && (
                <div
                  className={cn(
                    "px-1.5 pt-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] select-none",
                    isLt ? "text-zinc-400" : "text-white/35"
                  )}
                >
                  {group.label}
                </div>
              )}
              {/*
               * Grid de tarjetas. Cada tarjeta tiene:
               *   - Mini-preview (swatch) con el gradient característico del
               *     tema y el icono del tema superpuesto en la esquina
               *     inferior derecha.
               *   - Label centrada debajo.
               *   - Estado activo: ring amarillo CCMGC + check sobre el
               *     swatch (no como icono lateral).
               *   - Hint visible en `title` (tooltip nativo), NO debajo del
               *     label — eso es lo que mantiene la densidad alta y la
               *     estética limpia.
               */}
              <div className={cn("grid gap-1.5", CATEGORY_COLS[group.id])}>
                {group.items.map((opt, idx) => {
                  const sel = theme === opt.id;
                  const Icon = opt.Icon;
                  // Si el grupo tiene 2 columnas y un número impar de items,
                  // el último ocupa las 2 columnas (evita hueco vacío). Y
                  // si el grupo tiene 3 columnas y `items.length % 3 !== 0`,
                  // el último item se extiende para rellenar.
                  const cols = CATEGORY_COLS[group.id];
                  const count = group.items.length;
                  const isLast = idx === count - 1;
                  let spanClass = "";
                  if (isLast) {
                    if (cols === "grid-cols-2" && count % 2 === 1) {
                      spanClass = "col-span-2";
                    } else if (cols === "grid-cols-3" && count % 3 === 1) {
                      spanClass = "col-span-3";
                    } else if (cols === "grid-cols-3" && count % 3 === 2) {
                      spanClass = "col-span-2";
                    }
                  }
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="option"
                      aria-selected={sel}
                      onClick={() => {
                        setTheme(opt.id);
                        setOpen(false);
                      }}
                      title={`${opt.label} — ${opt.hint}`}
                      className={cn(
                        "group relative flex flex-col gap-1.5 rounded-lg p-1.5 text-left transition-all duration-150",
                        spanClass,
                        isLt
                          ? sel
                            ? "bg-amber-50/80 ring-2 ring-amber-300 shadow-sm"
                            : "ring-1 ring-zinc-900/5 hover:ring-zinc-900/20 hover:-translate-y-px"
                          : sel
                            ? "bg-[#ffeb66]/10 ring-2 ring-[#ffeb66]/70 shadow-[0_0_0_3px_rgba(255,235,102,0.10)]"
                            : "ring-1 ring-white/8 hover:ring-white/30 hover:-translate-y-px"
                      )}
                    >
                      {/* Swatch — el "alma visual" del tema. Va siempre, y es
                          lo único responsable de transmitir la identidad del
                          tema de un vistazo. Aspecto 16:6 para que sea
                          marcadamente horizontal y se distinga del simple
                          "círculo de color" típico. */}
                      <span
                        className="relative block w-full overflow-hidden rounded-md ring-1 ring-black/20"
                        style={{
                          background: opt.swatch,
                          aspectRatio: "16 / 6",
                        }}
                        aria-hidden
                      >
                        {/* Brillo sutil diagonal para dar profundidad al
                            swatch (estilo "card del tema") */}
                        <span
                          className="pointer-events-none absolute inset-0"
                          style={{
                            background:
                              "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 25%, transparent 55%)",
                          }}
                        />
                        {/* Icono del tema en la esquina inferior derecha del
                            swatch — apenas visible, sirve como "firma". Para
                            el tema Claro usamos icono oscuro porque el swatch
                            es blanco. */}
                        <Icon
                          className={cn(
                            "absolute bottom-1 right-1 w-3.5 h-3.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]",
                            opt.id === "light" ? "text-zinc-700" : "text-white/90"
                          )}
                          aria-hidden
                        />
                        {/* Check del tema activo, centrado sobre el swatch */}
                        {sel && (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                            <Check
                              className="w-4 h-4 text-[#ffeb66] drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]"
                              aria-hidden
                            />
                          </span>
                        )}
                      </span>
                      <span
                        className={cn(
                          "block text-center text-[11.5px] font-medium leading-tight truncate px-0.5",
                          isLt
                            ? sel ? "text-zinc-900" : "text-zinc-700 group-hover:text-zinc-900"
                            : sel ? "text-white" : "text-white/75 group-hover:text-white"
                        )}
                      >
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>,
      document.body
    );

  return (
    <div className="relative" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? "theme-selector-panel" : undefined}
        id="theme-selector-trigger"
        aria-label={`Tema visual: ${current.label}. Abrir selector`}
        title={`${current.label} — ${current.hint}`}
        className={cn(
          "relative flex items-center gap-0.5 p-2 rounded-lg transition-all duration-200",
          isLt
            ? "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-900/6"
            : "text-white/50 hover:text-white hover:bg-white/6"
        )}
      >
        <ActiveIcon className="w-4 h-4 shrink-0" aria-hidden />
        <ChevronDown
          className={cn(
            "w-3 h-3 shrink-0 opacity-50 transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      {dropdown}
    </div>
  );
}
