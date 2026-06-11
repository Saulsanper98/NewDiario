"use client";


import { isLightTheme } from "@/lib/theme";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AtSign,
  Bell,
  CheckSquare,
  KeyRound,
  Loader2,
  MessageSquare,
  Music,
  Play,
  Sparkles,
  Volume2,
  VolumeX,
  type LucideIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";
import { Listbox, type ListboxGroup } from "@/components/ui/Listbox";
import {
  CATEGORY_LABELS,
  type SoundCategory,
  SOUND_PRESETS,
  type SoundPreferences,
  playSoundId,
  setLocalPrefs,
  setUserSoundsCache,
} from "@/lib/notifications/sound-player";

const CATEGORIES: SoundCategory[] = ["chat", "mention", "login", "task"];

/**
 * Sanitiza las preferencias que llegan del servidor o del localStorage:
 * cualquier valor que apunte a `user:<id>` se elimina (los sonidos
 * personales fueron retirados; la clave queda undefined y el cliente
 * cae al sonido por defecto del sistema).
 */
function stripUserPrefs(prefs: SoundPreferences | null | undefined): SoundPreferences {
  if (!prefs) return {};
  const out: SoundPreferences = {};
  for (const k of Object.keys(prefs) as SoundCategory[]) {
    const v = prefs[k];
    if (typeof v === "string" && !v.startsWith("user:")) {
      out[k] = v;
    }
  }
  return out;
}

const CATEGORY_META: Record<
  SoundCategory,
  {
    icon: LucideIcon;
    short: string;
    description: string;
    toneLight: { bg: string; text: string; ring: string; bar: string };
    toneDark: { bg: string; text: string; ring: string; bar: string };
  }
> = {
  chat: {
    icon: MessageSquare,
    short: "Chat",
    description: "Cuando recibes un mensaje nuevo en el chat",
    toneLight: {
      bg: "bg-sky-50",
      text: "text-sky-700",
      ring: "ring-sky-200",
      bar: "bg-gradient-to-r from-sky-400/0 via-sky-400/60 to-sky-400/0",
    },
    toneDark: {
      bg: "bg-sky-500/12",
      text: "text-sky-200",
      ring: "ring-sky-400/25",
      bar: "bg-gradient-to-r from-sky-400/0 via-sky-400/40 to-sky-400/0",
    },
  },
  mention: {
    icon: AtSign,
    short: "Mención",
    description: "Cuando alguien te menciona con @",
    toneLight: {
      bg: "bg-amber-50",
      text: "text-amber-800",
      ring: "ring-amber-200",
      bar: "bg-gradient-to-r from-amber-400/0 via-amber-400/60 to-amber-400/0",
    },
    toneDark: {
      bg: "bg-amber-500/12",
      text: "text-amber-200",
      ring: "ring-amber-400/25",
      bar: "bg-gradient-to-r from-amber-400/0 via-amber-400/40 to-amber-400/0",
    },
  },
  login: {
    icon: KeyRound,
    short: "Login",
    description: "Al iniciar sesión correctamente",
    toneLight: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      ring: "ring-emerald-200",
      bar: "bg-gradient-to-r from-emerald-400/0 via-emerald-400/60 to-emerald-400/0",
    },
    toneDark: {
      bg: "bg-emerald-500/12",
      text: "text-emerald-200",
      ring: "ring-emerald-400/25",
      bar: "bg-gradient-to-r from-emerald-400/0 via-emerald-400/40 to-emerald-400/0",
    },
  },
  task: {
    icon: CheckSquare,
    short: "Tarea",
    description: "Tarea asignada o completada",
    toneLight: {
      bg: "bg-violet-50",
      text: "text-violet-700",
      ring: "ring-violet-200",
      bar: "bg-gradient-to-r from-violet-400/0 via-violet-400/60 to-violet-400/0",
    },
    toneDark: {
      bg: "bg-violet-500/12",
      text: "text-violet-200",
      ring: "ring-violet-400/25",
      bar: "bg-gradient-to-r from-violet-400/0 via-violet-400/40 to-violet-400/0",
    },
  },
};

/**
 * Tarjeta "Sonidos" para la pestaña Mi cuenta.
 *
 * Permite al usuario:
 *  - Ver y reproducir los presets del sistema (sintéticos, sin archivos).
 *  - Asignar un sonido distinto a cada categoría (chat / mención / login / tarea)
 *    y previsualizarlo en el momento.
 *
 * NOTA: La biblioteca personal (subir/importar audios) fue retirada por
 * decisión de producto. La UI conserva el catálogo de presets para que
 * cada usuario siga pudiendo personalizar qué tono escucha por categoría.
 */
export function SoundLibraryCard() {
  const { theme } = useTheme();
  const L = isLightTheme(theme);

  const [prefs, setPrefs] = useState<SoundPreferences>({});
  const [, setLoading] = useState(true);
  const [savingCat, setSavingCat] = useState<SoundCategory | null>(null);

  // Carga inicial: solo preferencias. Las normalizamos quitando cualquier
  // referencia legacy a `user:<id>` para que la UI no muestre un valor
  // huérfano si el usuario tenía una preferencia previa a la purga.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/me/sounds");
        if (!r.ok) throw new Error("No se pudieron cargar los sonidos");
        const data = (await r.json()) as {
          preferences: SoundPreferences;
        };
        if (cancelled) return;
        const safe = stripUserPrefs(data.preferences);
        setPrefs(safe);
        // Borramos la cache de URLs de sonidos personales (ya no existen).
        setUserSoundsCache([]);
        setLocalPrefs(safe);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error cargando sonidos");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const allOptions = useMemo(() => {
    return [
      { value: "default", label: "Predeterminado del sistema", group: "default" as const },
      { value: "off", label: "Silenciar", group: "default" as const },
      ...SOUND_PRESETS.map((p) => ({
        value: `preset:${p.id}`,
        label: p.name,
        hint: p.description,
        group: "preset" as const,
      })),
    ];
  }, []);

  const listboxGroups = useMemo<ListboxGroup[]>(() => {
    return [
      {
        label: "Sistema",
        options: allOptions
          .filter((o) => o.group === "default")
          .map((o) => ({ value: o.value, label: o.label })),
      },
      {
        label: "Presets del sistema",
        options: allOptions
          .filter((o) => o.group === "preset")
          .map((o) => ({
            value: o.value,
            label: o.label,
            hint: (o as { hint?: string }).hint,
          })),
      },
    ];
  }, [allOptions]);

  const handlePreview = useCallback((soundId: string) => {
    void playSoundId(soundId);
  }, []);

  const handleSetPref = useCallback(
    async (cat: SoundCategory, value: string) => {
      setSavingCat(cat);
      try {
        const r = await fetch("/api/me/sound-preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preferences: { [cat]: value } }),
        });
        if (!r.ok) {
          const err = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? "No se pudo guardar");
        }
        const data = (await r.json()) as { preferences: SoundPreferences };
        setPrefs(data.preferences);
        setLocalPrefs(data.preferences);
        // Auto-preview salvo cuando elegimos "off"
        if (value !== "off") handlePreview(value);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error guardando");
      } finally {
        setSavingCat(null);
      }
    },
    [handlePreview]
  );

  // Etiqueta legible para la opción seleccionada (en la card de preview).
  const labelForValue = (val: string) => {
    const opt = allOptions.find((o) => o.value === val);
    return opt?.label ?? val;
  };

  return (
    <section
      className={cn(
        "rounded-2xl border shadow-xl overflow-hidden",
        L
          ? "border-zinc-200/90 bg-white shadow-zinc-200/40"
          : "border-white/10 bg-gradient-to-b from-[#121a2e]/95 to-[#0d1427]/98 shadow-black/30"
      )}
    >
      {/* Hero con gradiente + iconografía */}
      <header
        className={cn(
          "relative overflow-hidden px-5 py-5 border-b",
          L
            ? "border-zinc-200/80 bg-gradient-to-br from-amber-50/85 via-amber-50/35 to-white"
            : "border-white/8 bg-gradient-to-br from-amber-500/[0.06] via-transparent to-amber-500/[0.02]"
        )}
      >
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl",
            L ? "bg-amber-200/40" : "bg-amber-400/15"
          )}
        />
        <div className="relative flex items-start gap-3.5">
          <span
            className={cn(
              "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1",
              L
                ? "bg-gradient-to-br from-amber-200 to-amber-300 text-amber-900 ring-amber-200/70 shadow-[0_4px_18px_rgba(217,168,29,0.30)]"
                : "bg-gradient-to-br from-amber-500/30 to-amber-500/10 text-amber-200 ring-amber-400/25 shadow-[0_4px_18px_rgba(255,191,67,0.18)]"
            )}
          >
            <Music className="h-6 w-6" strokeWidth={2.1} />
            <span
              aria-hidden
              className={cn(
                "absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px]",
                L
                  ? "bg-white text-amber-700 ring-1 ring-amber-200"
                  : "bg-[#1a2238] text-amber-200 ring-1 ring-amber-400/40"
              )}
            >
              <Sparkles className="h-2.5 w-2.5" />
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3
                className={cn(
                  "text-base font-semibold tracking-tight",
                  L ? "text-zinc-900" : "text-white"
                )}
              >
                Sonidos de notificaciones
              </h3>
            </div>
            <p
              className={cn(
                "mt-1 text-xs leading-snug",
                L ? "text-zinc-600" : "text-white/55"
              )}
            >
              Elige qué tono escuchas en cada evento. Catálogo del sistema
              con presets sintéticos siempre disponibles.
            </p>
          </div>
        </div>
      </header>

      <div className="px-5 py-5 space-y-5">

      {/* Selectores por categoría — cards más visuales con tono propio */}
      <div className="grid gap-2 sm:grid-cols-2">
        {CATEGORIES.map((cat) => {
          const value = prefs[cat] ?? "default";
          const isSaving = savingCat === cat;
          const isOff = value === "off";
          const meta = CATEGORY_META[cat];
          const tone = L ? meta.toneLight : meta.toneDark;
          const Icon = meta.icon;
          return (
            <div
              key={cat}
              className={cn(
                "group relative overflow-hidden rounded-xl border p-3 transition-colors",
                L
                  ? "border-zinc-200 bg-white hover:border-zinc-300"
                  : "border-white/10 bg-white/[0.025] hover:border-white/18"
              )}
            >
              {/* Barra superior con el tono de la categoría */}
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-x-0 top-0 h-[2px]",
                  tone.bar
                )}
              />
              <div className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1",
                    tone.bg,
                    tone.text,
                    tone.ring
                  )}
                  aria-hidden="true"
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-[13px] font-semibold leading-tight",
                      L ? "text-zinc-900" : "text-white/95"
                    )}
                  >
                    {CATEGORY_LABELS[cat]}
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 text-[11px] leading-tight",
                      L ? "text-zinc-500" : "text-white/45"
                    )}
                  >
                    {meta.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handlePreview(value)}
                  disabled={isOff || isSaving}
                  aria-label={`Probar sonido de ${CATEGORY_LABELS[cat]}`}
                  title={isOff ? "Silenciado" : "Probar este sonido"}
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ring-1",
                    L
                      ? "bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50 hover:text-zinc-900"
                      : "bg-white/[0.06] text-white/65 ring-white/10 hover:bg-white/[0.1] hover:text-white",
                    (isOff || isSaving) && "opacity-40 cursor-not-allowed"
                  )}
                >
                  {isOff ? (
                    <VolumeX className="h-3.5 w-3.5" />
                  ) : isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5 translate-x-px" />
                  )}
                </button>
              </div>

              <div className="mt-2.5 flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Listbox
                    value={value}
                    onChange={(v) => void handleSetPref(cat, v)}
                    groups={listboxGroups}
                    disabled={isSaving}
                    light={L}
                    ariaLabel={`Sonido para ${CATEGORY_LABELS[cat]}`}
                    className={cn(isOff && (L ? "text-zinc-400" : "text-white/35"))}
                  />
                </div>
                {isOff && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium ring-1",
                      L
                        ? "bg-zinc-100 text-zinc-600 ring-zinc-200"
                        : "bg-white/5 text-white/55 ring-white/10"
                    )}
                  >
                    <VolumeX className="h-3 w-3" />
                    Silencio
                  </span>
                )}
              </div>
              {/* Etiqueta del valor actual (cuando no está silenciado) */}
              {!isOff && (
                <p
                  className={cn(
                    "mt-1.5 truncate text-[10.5px]",
                    L ? "text-zinc-400" : "text-white/35"
                  )}
                >
                  <Bell className="mr-1 inline-block h-2.5 w-2.5 align-middle opacity-70" />
                  {labelForValue(value)}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Biblioteca de presets del sistema */}
      <div className="space-y-4">
        <SoundList
          title="Sonidos del sistema"
          subtitle="Tonos integrados sin archivo, siempre disponibles"
          icon={Sparkles}
          isLight={L}
          items={SOUND_PRESETS.map((p) => ({
            id: `preset:${p.id}`,
            name: p.name,
            sub: p.description,
            removable: false,
          }))}
          onPreview={handlePreview}
        />
      </div>
      </div>
    </section>
  );
}

function SoundList({
  title,
  subtitle,
  icon: Icon,
  items,
  isLight,
  onPreview,
  emptyText,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  items: {
    id: string;
    name: string;
    sub: string;
    removable: boolean;
  }[];
  isLight: boolean;
  onPreview: (id: string) => void;
  emptyText?: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        {Icon && (
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1",
              isLight
                ? "bg-zinc-100 text-zinc-600 ring-zinc-200"
                : "bg-white/[0.05] text-white/65 ring-white/10"
            )}
            aria-hidden
          >
            <Icon className="h-3 w-3" />
          </span>
        )}
        <div className="min-w-0">
          <p
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.12em]",
              isLight ? "text-zinc-700" : "text-white/65"
            )}
          >
            {title}
            <span
              className={cn(
                "ml-1.5 inline-flex items-center rounded-full px-1.5 py-px text-[10px] font-medium normal-case tracking-normal",
                isLight
                  ? "bg-zinc-100 text-zinc-600"
                  : "bg-white/[0.06] text-white/55"
              )}
            >
              {items.length}
            </span>
          </p>
          {subtitle && (
            <p
              className={cn(
                "mt-0.5 text-[10.5px] leading-tight",
                isLight ? "text-zinc-400" : "text-white/35"
              )}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {items.length === 0 ? (
        <p
          className={cn(
            "rounded-xl border border-dashed px-3 py-3 text-xs italic",
            isLight
              ? "border-zinc-200 text-zinc-500"
              : "border-white/10 text-white/45"
          )}
        >
          {emptyText ?? "Sin elementos"}
        </p>
      ) : (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {items.map((it) => (
            <li
              key={it.id}
              className={cn(
                "group flex items-center gap-2 rounded-xl border px-2.5 py-2 transition-colors",
                isLight
                  ? "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/60"
                  : "border-white/10 bg-white/[0.025] hover:border-white/18 hover:bg-white/[0.04]"
              )}
            >
              <button
                type="button"
                onClick={() => onPreview(it.id)}
                aria-label={`Probar ${it.name}`}
                title="Probar"
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all ring-1",
                  isLight
                    ? "bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100"
                    : "bg-amber-500/12 text-amber-200 ring-amber-400/25 hover:bg-amber-500/20",
                  "group-hover:scale-[1.05]"
                )}
              >
                <Play className="h-3.5 w-3.5 translate-x-px" />
              </button>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate text-[13px] font-medium leading-tight",
                    isLight ? "text-zinc-900" : "text-white/95"
                  )}
                >
                  {it.name}
                </span>
                <span
                  className={cn(
                    "block truncate text-[11px] leading-tight",
                    isLight ? "text-zinc-500" : "text-white/45"
                  )}
                >
                  {it.sub}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onPreview(it.id)}
                aria-label={`Probar ${it.name} (volumen)`}
                title="Probar"
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
                  isLight
                    ? "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                    : "text-white/35 hover:bg-white/8 hover:text-white/70"
                )}
              >
                <Volume2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
