"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Link2,
  Loader2,
  Music,
  Play,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
} from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";
import {
  CATEGORY_LABELS,
  type SoundCategory,
  SOUND_PRESETS,
  type SoundPreferences,
  type UserSoundLite,
  playSoundId,
  setLocalPrefs,
  setUserSoundsCache,
} from "@/lib/notifications/sound-player";

interface UserSoundFull extends UserSoundLite {
  mimeType: string;
  sizeBytes: number;
  source: "UPLOAD" | "URL";
  originalUrl: string | null;
  createdAt: string;
}

const CATEGORIES: SoundCategory[] = ["chat", "mention", "login", "task"];

const CATEGORY_ICON: Record<SoundCategory, string> = {
  chat: "💬",
  mention: "@",
  login: "🔑",
  task: "📋",
};

/**
 * Tarjeta "Sonidos personalizados" para la pestaña Mi cuenta.
 *
 * Permite al usuario:
 *  - Ver y reproducir los presets del sistema (sintéticos, sin archivos).
 *  - Subir audios propios desde el PC (hasta 10 MB).
 *  - Importar un audio desde una URL pública (lo descarga el servidor).
 *  - Borrar cualquier sonido propio.
 *  - Asignar un sonido distinto a cada categoría (chat / mención / login / tarea)
 *    y previsualizarlo en el momento.
 */
export function SoundLibraryCard() {
  const { theme } = useTheme();
  const L = theme === "light";

  const [userSounds, setUserSounds] = useState<UserSoundFull[]>([]);
  const [prefs, setPrefs] = useState<SoundPreferences>({});
  const [loading, setLoading] = useState(true);
  const [savingCat, setSavingCat] = useState<SoundCategory | null>(null);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlBusy, setUrlBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carga inicial: lista de sonidos + preferencias.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/me/sounds");
        if (!r.ok) throw new Error("No se pudieron cargar los sonidos");
        const data = (await r.json()) as {
          sounds: UserSoundFull[];
          preferences: SoundPreferences;
        };
        if (cancelled) return;
        setUserSounds(data.sounds);
        setPrefs(data.preferences ?? {});
        setUserSoundsCache(data.sounds);
        setLocalPrefs(data.preferences ?? {});
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
        group: "preset" as const,
      })),
      ...userSounds.map((s) => ({
        value: `user:${s.id}`,
        label: s.name,
        group: "user" as const,
      })),
    ];
  }, [userSounds]);

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

  const handleUpload = useCallback(async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("El audio no puede superar 10 MB");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", file.name.replace(/\.[^.]+$/, ""));
      const r = await fetch("/api/me/sounds/upload", { method: "POST", body: fd });
      const data = (await r.json()) as { sound?: UserSoundFull; error?: string };
      if (!r.ok || !data.sound) throw new Error(data.error ?? "No se pudo subir");
      setUserSounds((prev) => {
        const next = [data.sound!, ...prev];
        setUserSoundsCache(next);
        return next;
      });
      toast.success(`"${data.sound.name}" añadido`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error subiendo");
    } finally {
      setUploading(false);
    }
  }, []);

  const handleFromUrl = useCallback(async () => {
    const url = urlInput.trim();
    if (!url) return;
    setUrlBusy(true);
    try {
      const r = await fetch("/api/me/sounds/from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await r.json()) as { sound?: UserSoundFull; error?: string };
      if (!r.ok || !data.sound) throw new Error(data.error ?? "No se pudo importar");
      setUserSounds((prev) => {
        const next = [data.sound!, ...prev];
        setUserSoundsCache(next);
        return next;
      });
      setUrlInput("");
      toast.success(`"${data.sound.name}" importado`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error importando");
    } finally {
      setUrlBusy(false);
    }
  }, [urlInput]);

  const handleDelete = useCallback(
    async (sound: UserSoundFull) => {
      if (!window.confirm(`Borrar "${sound.name}"?`)) return;
      try {
        const r = await fetch(`/api/me/sounds/${sound.id}`, {
          method: "DELETE",
        });
        if (!r.ok) {
          const err = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? "No se pudo borrar");
        }
        setUserSounds((prev) => {
          const next = prev.filter((s) => s.id !== sound.id);
          setUserSoundsCache(next);
          return next;
        });
        // Si alguna preferencia apuntaba a este, el server ya la limpió: lo
        // reflejamos en el estado local.
        const updated: SoundPreferences = { ...prefs };
        const target = `user:${sound.id}`;
        let changed = false;
        for (const k of Object.keys(updated) as SoundCategory[]) {
          if (updated[k] === target) {
            delete updated[k];
            changed = true;
          }
        }
        if (changed) {
          setPrefs(updated);
          setLocalPrefs(updated);
        }
        toast.success(`"${sound.name}" eliminado`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error borrando");
      }
    },
    [prefs]
  );

  return (
    <section
      className={cn(
        "rounded-2xl border p-5",
        L
          ? "border-zinc-200 bg-white"
          : "border-white/10 bg-white/[0.03]"
      )}
    >
      <header className="mb-4 flex items-start gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            L
              ? "bg-gradient-to-br from-amber-100 to-amber-200 text-amber-900"
              : "bg-gradient-to-br from-amber-500/15 to-amber-500/5 text-amber-300"
          )}
        >
          <Music className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3
            className={cn(
              "text-base font-semibold tracking-tight",
              L ? "text-zinc-900" : "text-white"
            )}
          >
            Sonidos personalizados
          </h3>
          <p
            className={cn(
              "text-xs",
              L ? "text-zinc-500" : "text-white/55"
            )}
          >
            Elige qué tono escuchas en cada evento. Sube audios del PC o
            importa una URL pública (mp3, m4a, ogg, wav, webm hasta 10 MB).
          </p>
        </div>
      </header>

      {/* Selectores por categoría */}
      <div className="mb-4 space-y-2">
        {CATEGORIES.map((cat) => {
          const value = prefs[cat] ?? "default";
          const isSaving = savingCat === cat;
          const isOff = value === "off";
          return (
            <div
              key={cat}
              className={cn(
                "flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2",
                L
                  ? "border-zinc-200 bg-zinc-50/60"
                  : "border-white/10 bg-white/[0.025]"
              )}
            >
              <span
                className={cn(
                  "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sm",
                  L ? "bg-white text-zinc-700" : "bg-white/[0.06] text-white/75"
                )}
                aria-hidden="true"
              >
                {CATEGORY_ICON[cat]}
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-sm font-medium",
                  L ? "text-zinc-800" : "text-white/90"
                )}
              >
                {CATEGORY_LABELS[cat]}
              </span>
              <select
                value={value}
                onChange={(e) => void handleSetPref(cat, e.target.value)}
                disabled={isSaving}
                className={cn(
                  "max-w-[14rem] min-w-[8rem] rounded-lg border px-2 py-1.5 text-xs outline-none transition-colors",
                  "focus:border-[#ffeb66]/55 focus:shadow-[0_0_0_3px_rgba(255,235,102,0.12)]",
                  L
                    ? "border-zinc-200 bg-white text-zinc-900"
                    : "border-white/10 bg-white/[0.05] text-white",
                  isSaving && "opacity-60"
                )}
              >
                <optgroup label="Sistema">
                  {allOptions
                    .filter((o) => o.group === "default")
                    .map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Presets del sistema">
                  {allOptions
                    .filter((o) => o.group === "preset")
                    .map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                </optgroup>
                {userSounds.length > 0 && (
                  <optgroup label="Mis sonidos">
                    {allOptions
                      .filter((o) => o.group === "user")
                      .map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                  </optgroup>
                )}
              </select>
              <button
                type="button"
                onClick={() => handlePreview(value)}
                disabled={isOff || isSaving}
                aria-label={`Probar sonido de ${CATEGORY_LABELS[cat]}`}
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
                  L
                    ? "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                    : "text-white/55 hover:bg-white/10 hover:text-white",
                  (isOff || isSaving) && "opacity-40 cursor-not-allowed"
                )}
              >
                {isOff ? (
                  <VolumeX className="h-3.5 w-3.5" />
                ) : isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Acciones para añadir sonidos */}
      <div
        className={cn(
          "mb-4 grid gap-2 rounded-xl border p-3 sm:grid-cols-2",
          L ? "border-zinc-200 bg-white" : "border-white/10 bg-white/[0.02]"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleUpload(f);
            e.currentTarget.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all",
            "bg-gradient-to-br from-[#ffeb66] to-[#d4a700] text-[#0a0f1e]",
            "shadow-[0_3px_12px_rgba(255,235,102,0.32)] hover:brightness-110 hover:-translate-y-0.5",
            uploading && "opacity-70 hover:translate-y-0"
          )}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Subir audio del PC
        </button>
        <div className="flex items-center gap-1.5">
          <Link2
            className={cn(
              "h-4 w-4 shrink-0",
              L ? "text-zinc-400" : "text-white/40"
            )}
          />
          <input
            type="url"
            placeholder="Pega una URL https://… con un audio"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleFromUrl();
              }
            }}
            disabled={urlBusy}
            className={cn(
              "min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-xs outline-none",
              "focus:border-[#ffeb66]/55 focus:shadow-[0_0_0_3px_rgba(255,235,102,0.12)]",
              L
                ? "border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400"
                : "border-white/10 bg-white/[0.05] text-white placeholder:text-white/40"
            )}
          />
          <button
            type="button"
            onClick={() => void handleFromUrl()}
            disabled={urlBusy || !urlInput.trim()}
            className={cn(
              "shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40",
              L
                ? "bg-zinc-900 text-white hover:bg-zinc-800"
                : "bg-white text-zinc-900 hover:bg-zinc-100"
            )}
          >
            {urlBusy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              "Importar"
            )}
          </button>
        </div>
      </div>

      {/* Biblioteca de presets + propios */}
      <div className="space-y-3">
        <SoundList
          title="Sonidos del sistema"
          isLight={L}
          items={SOUND_PRESETS.map((p) => ({
            id: `preset:${p.id}`,
            name: p.name,
            sub: p.description,
            removable: false,
          }))}
          onPreview={handlePreview}
        />
        <SoundList
          title="Mis sonidos"
          isLight={L}
          emptyText={
            loading
              ? "Cargando…"
              : "Todavía no has añadido ninguno. Sube uno o importa una URL."
          }
          items={userSounds.map((s) => ({
            id: `user:${s.id}`,
            name: s.name,
            sub:
              s.source === "URL"
                ? `Importado desde ${truncate(s.originalUrl ?? "URL", 50)}`
                : `${(s.sizeBytes / 1024).toFixed(0)} KB · ${s.mimeType.replace(
                    "audio/",
                    ""
                  )}`,
            removable: true,
            onDelete: () => void handleDelete(s),
          }))}
          onPreview={handlePreview}
        />
      </div>
    </section>
  );
}

function SoundList({
  title,
  items,
  isLight,
  onPreview,
  emptyText,
}: {
  title: string;
  items: {
    id: string;
    name: string;
    sub: string;
    removable: boolean;
    onDelete?: () => void;
  }[];
  isLight: boolean;
  onPreview: (id: string) => void;
  emptyText?: string;
}) {
  return (
    <div>
      <p
        className={cn(
          "mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]",
          isLight ? "text-zinc-500" : "text-white/45"
        )}
      >
        {title}
      </p>
      {items.length === 0 ? (
        <p
          className={cn(
            "rounded-lg border border-dashed px-3 py-3 text-xs italic",
            isLight
              ? "border-zinc-200 text-zinc-500"
              : "border-white/10 text-white/45"
          )}
        >
          {emptyText ?? "Sin elementos"}
        </p>
      ) : (
        <ul className="space-y-1">
          {items.map((it) => (
            <li
              key={it.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2",
                isLight
                  ? "border-zinc-200 bg-white"
                  : "border-white/10 bg-white/[0.025]"
              )}
            >
              <button
                type="button"
                onClick={() => onPreview(it.id)}
                aria-label={`Probar ${it.name}`}
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
                  isLight
                    ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                    : "bg-white/[0.06] text-white/70 hover:bg-white/[0.12]"
                )}
              >
                <Volume2 className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate text-sm font-medium",
                    isLight ? "text-zinc-900" : "text-white"
                  )}
                >
                  {it.name}
                </span>
                <span
                  className={cn(
                    "block truncate text-[11px]",
                    isLight ? "text-zinc-500" : "text-white/45"
                  )}
                >
                  {it.sub}
                </span>
              </span>
              {it.removable && it.onDelete && (
                <button
                  type="button"
                  onClick={it.onDelete}
                  aria-label={`Borrar ${it.name}`}
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
                    isLight
                      ? "text-zinc-400 hover:bg-red-50 hover:text-red-600"
                      : "text-white/40 hover:bg-red-500/15 hover:text-red-300"
                  )}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}
