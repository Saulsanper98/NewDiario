"use client";

import { useEffect, useRef, useState } from "react";
import {
  Sun,
  Sunset,
  Moon,
  Loader2,
  Upload,
  Undo2,
  ImageOff,
  LayoutGrid,
  Settings2,
  Clock,
  Columns3,
} from "lucide-react";
import { useDensity } from "@/lib/hooks/useDensity";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { APP_NAME } from "@/lib/app-brand";
import { useTheme } from "@/components/layout/ThemeProvider";
import { cn } from "@/lib/utils";

const LOGO_MAX_BYTES = 280_000;

export function AppSettingsTab() {
  const { theme } = useTheme();
  const L = theme === "light";
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const { compact, toggle: toggleDensity } = useDensity();
  const [saving, setSaving] = useState(false);
  const [appName, setAppName] = useState(APP_NAME);
  const [shifts, setShifts] = useState({
    morning: { from: "06:00", to: "14:00" },
    afternoon: { from: "14:00", to: "22:00" },
    night: { from: "22:00", to: "06:00" },
  });
  /** Logo guardado en BD (data URL o ausente) */
  const [storedLogoDataUrl, setStoredLogoDataUrl] = useState<string | null>(null);
  /** null = no tocar logo al guardar; string (incl. "") = aplicar o borrar */
  const [logoPatch, setLogoPatch] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/app-settings");
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { settings: Record<string, string> };
        if (cancelled) return;
        const s = data.settings;
        if (s.app_name) setAppName(s.app_name);
        const logo = s.app_logo_data_url?.trim();
        setStoredLogoDataUrl(
          logo && logo.startsWith("data:image/") ? logo : null
        );
        setShifts({
          morning: {
            from: s.shift_morning_start ?? "06:00",
            to: s.shift_morning_end ?? "14:00",
          },
          afternoon: {
            from: s.shift_afternoon_start ?? "14:00",
            to: s.shift_afternoon_end ?? "22:00",
          },
          night: {
            from: s.shift_night_start ?? "22:00",
            to: s.shift_night_end ?? "06:00",
          },
        });
      } catch {
        toast.error("No se pudo cargar la configuración");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const previewSrc =
    logoPatch !== null ? logoPatch || "/logo.svg" : storedLogoDataUrl || "/logo.svg";

  function onPickLogoFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Elige un archivo de imagen (PNG, JPG, WebP o SVG).");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      toast.error(`Imagen demasiado grande (máx. ${Math.round(LOGO_MAX_BYTES / 1024)} KB).`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result;
      if (typeof r === "string" && r.startsWith("data:image/")) {
        setLogoPatch(r);
      } else {
        toast.error("No se pudo leer el archivo.");
      }
    };
    reader.onerror = () => toast.error("No se pudo leer el archivo.");
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const settings: Record<string, string> = {
        app_name: appName.trim(),
        shift_morning_start: shifts.morning.from,
        shift_morning_end: shifts.morning.to,
        shift_afternoon_start: shifts.afternoon.from,
        shift_afternoon_end: shifts.afternoon.to,
        shift_night_start: shifts.night.from,
        shift_night_end: shifts.night.to,
      };
      if (logoPatch !== null) {
        settings.app_logo_data_url = logoPatch;
      }

      const res = await fetch("/api/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Error");
      }
      if (logoPatch !== null) {
        setStoredLogoDataUrl(logoPatch === "" ? null : logoPatch);
        setLogoPatch(null);
        window.dispatchEvent(new Event("app-branding-updated"));
      }
      toast.success("Configuración guardada");
    } catch {
      toast.error("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={cn(
        "flex items-center gap-2 text-sm py-8",
        L ? "text-zinc-500" : "text-white/40"
      )}>
        <Loader2 className="w-4 h-4 animate-spin" />
        Cargando configuración…
      </div>
    );
  }

  const shiftBlocks = [
    { key: "morning" as const, label: "Mañana", icon: Sun, state: shifts.morning, accent: L ? "text-amber-600" : "text-amber-300" },
    { key: "afternoon" as const, label: "Tarde", icon: Sunset, state: shifts.afternoon, accent: L ? "text-orange-600" : "text-orange-300" },
    { key: "night" as const, label: "Noche", icon: Moon, state: shifts.night, accent: L ? "text-indigo-600" : "text-indigo-300" },
  ];

  return (
    <div className="config-appsettings-root space-y-5 max-w-3xl">
      {/* Hero */}
      <section
        className={cn(
          "relative overflow-hidden rounded-2xl border px-5 py-5 sm:px-6 sm:py-6",
          L
            ? "border-black/[0.08] bg-gradient-to-br from-white via-zinc-50/70 to-amber-50/40 shadow-[var(--lt-shadow-glass)]"
            : "border-white/10 bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-[#ffeb66]/[0.05]"
        )}
      >
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-14 -right-20 h-48 w-48 rounded-full blur-3xl",
            L ? "bg-amber-200/55" : "bg-[#ffeb66]/12"
          )}
        />
        <div className="relative flex items-start gap-3 sm:gap-4">
          <div
            className={cn(
              "shrink-0 flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-2xl",
              L
                ? "bg-amber-100 text-amber-700 border border-amber-200"
                : "bg-[#ffeb66]/15 text-[#ffeb66] border border-[#ffeb66]/25"
            )}
          >
            <Settings2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "mb-1 text-[10.5px] font-semibold uppercase tracking-[0.18em]",
                L ? "text-zinc-500" : "text-white/40"
              )}
            >
              Configuración · App
            </p>
            <h2
              className={cn(
                "text-lg sm:text-xl font-semibold leading-tight tracking-tight",
                L ? "text-zinc-900" : "text-white"
              )}
            >
              Aplicación, marca y turnos
            </h2>
            <p
              className={cn(
                "mt-1.5 text-xs sm:text-sm leading-relaxed",
                L ? "text-zinc-600" : "text-white/55"
              )}
            >
              Personaliza el nombre, el logo y los horarios de turno que la app usa para calcular
              avisos, traspasos y estadísticas.
            </p>
          </div>
        </div>
      </section>

      {/* General + Logo */}
      <Card className="space-y-5 min-w-0 overflow-hidden" light={L}>
        <div className="flex items-center gap-2">
          <Settings2 className={cn("w-4 h-4", L ? "text-zinc-500" : "text-white/40")} />
          <h3 className={cn("text-sm font-semibold", L ? "text-zinc-900" : "text-white")}>
            General
          </h3>
        </div>
        <Input
          label="Nombre de la aplicación"
          value={appName}
          onChange={(e) => setAppName(e.target.value)}
        />
        <div className="flex flex-col gap-2">
          <label className={cn(
            "text-[10.5px] font-semibold uppercase tracking-wider",
            L ? "text-zinc-600" : "text-white/60"
          )}>
            Logo
          </label>
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div
              className={cn(
                "w-16 h-16 sm:w-14 sm:h-14 rounded-xl overflow-hidden shrink-0 relative flex items-center justify-center border",
                L
                  ? "bg-zinc-50 border-zinc-200"
                  : "bg-white/5 border-white/10"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- vista previa puede ser data URL */}
              <img
                src={previewSrc}
                alt=""
                className="max-w-[90%] max-h-[90%] object-contain"
              />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg"
                  className="sr-only"
                  onChange={(e) => {
                    onPickLogoFile(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  className="gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Elegir imagen…
                </Button>
                {logoPatch !== null && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setLogoPatch(null)}
                    className="gap-1.5"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    Deshacer
                  </Button>
                )}
                {storedLogoDataUrl && logoPatch === null && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setLogoPatch("")}
                    className={cn(
                      "gap-1.5",
                      L ? "hover:text-red-700" : "hover:text-red-300"
                    )}
                  >
                    <ImageOff className="w-3.5 h-3.5" />
                    Quitar logo
                  </Button>
                )}
              </div>
              <p className={cn(
                "text-xs leading-relaxed",
                L ? "text-zinc-600" : "text-white/35"
              )}>
                PNG, JPG, WebP o SVG (máx. {Math.round(LOGO_MAX_BYTES / 1024)} KB). Se guarda en
                la base de datos y sustituye al logo por defecto en toda la app.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Turnos */}
      <Card className="space-y-4 min-w-0" light={L}>
        <div className="flex items-center gap-2">
          <Clock className={cn("w-4 h-4", L ? "text-zinc-500" : "text-white/40")} />
          <h3 className={cn("text-sm font-semibold", L ? "text-zinc-900" : "text-white")}>
            Turnos
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 min-w-0">
          {shiftBlocks.map(({ key, label, icon: Icon, state, accent }) => (
            <div
              key={key}
              className={cn(
                "p-3 rounded-xl border space-y-2 min-w-0 overflow-hidden",
                L
                  ? "bg-zinc-50 border-zinc-200"
                  : "bg-white/3 border-white/8"
              )}
            >
              <p
                className={cn(
                  "text-xs font-semibold flex items-center gap-1.5",
                  L ? "text-zinc-800" : "text-white/70"
                )}
              >
                <Icon className={cn("w-3.5 h-3.5 shrink-0", accent)} />
                {label}
              </p>
              <div className="flex items-center gap-1.5 min-w-0 w-full">
                <input
                  type="time"
                  value={state.from}
                  onChange={(e) =>
                    setShifts((prev) => ({
                      ...prev,
                      [key]: { ...prev[key], from: e.target.value },
                    }))
                  }
                  className={cn(
                    "min-w-0 flex-1 max-w-full rounded-md px-1.5 py-1.5 text-xs tabular-nums focus:outline-none focus:ring-2",
                    L
                      ? "bg-white border border-zinc-300 text-zinc-900 focus:ring-amber-300 focus:border-amber-400 [color-scheme:light]"
                      : "bg-white/5 border border-white/8 text-white focus:ring-[#ffeb66]/25 [color-scheme:dark]"
                  )}
                />
                <span className={cn("text-xs shrink-0", L ? "text-zinc-400" : "text-white/20")}>→</span>
                <input
                  type="time"
                  value={state.to}
                  onChange={(e) =>
                    setShifts((prev) => ({
                      ...prev,
                      [key]: { ...prev[key], to: e.target.value },
                    }))
                  }
                  className={cn(
                    "min-w-0 flex-1 max-w-full rounded-md px-1.5 py-1.5 text-xs tabular-nums focus:outline-none focus:ring-2",
                    L
                      ? "bg-white border border-zinc-300 text-zinc-900 focus:ring-amber-300 focus:border-amber-400 [color-scheme:light]"
                      : "bg-white/5 border border-white/8 text-white focus:ring-[#ffeb66]/25 [color-scheme:dark]"
                  )}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Save bar (sticky-feeling) */}
      <div
        className={cn(
          "rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4",
          L
            ? "border-amber-200 bg-amber-50/70"
            : "border-[#ffeb66]/22 bg-[#ffeb66]/[0.05]"
        )}
      >
        <p className={cn(
          "text-xs leading-relaxed flex-1",
          L ? "text-amber-900" : "text-amber-100/85"
        )}>
          Aplica el nombre, horarios de turno y, si has elegido o quitado un logo, esa decisión al
          pulsar el botón.
        </p>
        <Button
          type="button"
          variant="primary"
          size="md"
          loading={saving}
          onClick={() => void handleSave()}
          className="w-full sm:w-auto shrink-0 whitespace-nowrap font-semibold tracking-tight !h-auto min-h-[2.75rem] py-2.5 px-6 text-sm shadow-[0_6px_28px_rgba(255,235,102,0.28)] hover:shadow-[0_8px_32px_rgba(255,235,102,0.38)] transition-shadow"
        >
          Guardar cambios
        </Button>
      </div>

      {/* Vista compacta */}
      <Card className="space-y-3" light={L}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span
              className={cn(
                "shrink-0 flex w-8 h-8 items-center justify-center rounded-lg mt-0.5",
                L ? "bg-zinc-100 text-zinc-700 border border-zinc-200" : "bg-white/6 text-white/55 border border-white/10"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h3 className={cn("text-sm font-semibold", L ? "text-zinc-900" : "text-white")}>
                Vista compacta
              </h3>
              <p className={cn(
                "text-xs mt-0.5 leading-relaxed",
                L ? "text-zinc-600" : "text-white/45"
              )}>
                Reduce el padding de las tarjetas en un 25% para mostrar más contenido en pantalla.
                No cambia el tamaño del texto.
              </p>
            </div>
          </div>
          <Switch
            checked={compact}
            onCheckedChange={toggleDensity}
            size="sm"
            light={L}
            label="Vista compacta"
          />
        </div>
      </Card>

      {/* Columnas Kanban */}
      <Card className="space-y-3" light={L}>
        <div className="flex items-center gap-2">
          <Columns3 className={cn("w-4 h-4", L ? "text-zinc-500" : "text-white/40")} />
          <h3 className={cn("text-sm font-semibold", L ? "text-zinc-900" : "text-white")}>
            Columnas Kanban por defecto
          </h3>
        </div>
        <p className={cn("text-xs leading-relaxed", L ? "text-zinc-600" : "text-white/45")}>
          Estas columnas se usan como referencia al crear proyectos desde el flujo estándar
          (Backlog → Completado).
        </p>
        <ol className="space-y-1.5">
          {["Backlog", "Pendiente", "En Progreso", "En Revisión", "Completado"].map((col, i) => (
            <li
              key={i}
              className={cn(
                "flex items-center gap-3 p-2.5 rounded-lg border",
                L
                  ? "bg-zinc-50 border-zinc-200"
                  : "bg-white/3 border-white/6"
              )}
            >
              <span
                className={cn(
                  "shrink-0 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums",
                  i === 4
                    ? L
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-emerald-500/15 text-emerald-300 border border-emerald-400/30"
                    : L
                      ? "bg-zinc-200 text-zinc-700"
                      : "bg-white/10 text-white/50"
                )}
              >
                {i + 1}
              </span>
              <span className={cn(
                "text-sm flex-1",
                L ? "text-zinc-800" : "text-white/70"
              )}>{col}</span>
              {i === 4 && (
                <span className={cn(
                  "text-[10px] font-semibold uppercase tracking-wide",
                  L ? "text-emerald-700" : "text-emerald-300"
                )}>Final</span>
              )}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
