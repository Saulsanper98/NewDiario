"use client";

import { useEffect, useRef, useState } from "react";
import { Sun, Sunset, Moon, Loader2, Upload, Undo2, ImageOff } from "lucide-react";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { APP_NAME } from "@/lib/app-brand";

const LOGO_MAX_BYTES = 280_000;

export function AppSettingsTab() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
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
      <div className="flex items-center gap-2 text-sm text-white/40 py-8">
        <Loader2 className="w-4 h-4 animate-spin" />
        Cargando configuración…
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <Card className="space-y-6 min-w-0 overflow-hidden">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-white">General</h3>
          <Input
            label="Nombre de la aplicación"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
          />
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-white/60 uppercase tracking-wide">
              Logo
            </label>
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 overflow-hidden shrink-0 relative flex items-center justify-center">
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
                      className="gap-1.5 text-white/55 hover:text-white"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      Deshacer cambio de logo
                    </Button>
                  )}
                  {storedLogoDataUrl && logoPatch === null && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setLogoPatch("")}
                      className="gap-1.5 text-white/50 hover:text-red-300"
                    >
                      <ImageOff className="w-3.5 h-3.5" />
                      Quitar logo guardado
                    </Button>
                  )}
                </div>
                <p className="text-xs text-white/35 leading-relaxed">
                  PNG, JPG, WebP o SVG (máx. {Math.round(LOGO_MAX_BYTES / 1024)} KB). Se guarda en la base de datos y
                  sustituye al <code className="text-white/45">/logo.svg</code> por defecto en toda la app. En
                  despliegues estáticos también puedes seguir usando{" "}
                  <code className="text-white/45">public/logo.svg</code>.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Turnos</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 min-w-0">
            {[
              {
                key: "morning" as const,
                label: "Mañana",
                icon: Sun,
                state: shifts.morning,
              },
              {
                key: "afternoon" as const,
                label: "Tarde",
                icon: Sunset,
                state: shifts.afternoon,
              },
              {
                key: "night" as const,
                label: "Noche",
                icon: Moon,
                state: shifts.night,
              },
            ].map(({ key, label, icon: Icon, state }) => (
              <div
                key={key}
                className="p-3 rounded-lg bg-white/3 border border-white/8 space-y-2 min-w-0 overflow-hidden"
              >
                <p className="text-xs font-medium text-white/60 flex items-center gap-1.5">
                  <Icon className="w-3 h-3 shrink-0" />
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
                    className="min-w-0 flex-1 max-w-full bg-white/5 border border-white/8 rounded-md px-1.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#ffeb66]/25 tabular-nums [color-scheme:dark]"
                  />
                  <span className="text-white/20 text-xs shrink-0">→</span>
                  <input
                    type="time"
                    value={state.to}
                    onChange={(e) =>
                      setShifts((prev) => ({
                        ...prev,
                        [key]: { ...prev[key], to: e.target.value },
                      }))
                    }
                    className="min-w-0 flex-1 max-w-full bg-white/5 border border-white/8 rounded-md px-1.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#ffeb66]/25 tabular-nums [color-scheme:dark]"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-white/10 pt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <Button
            type="button"
            variant="primary"
            size="md"
            loading={saving}
            onClick={() => void handleSave()}
            className="w-full sm:w-auto shrink-0 whitespace-nowrap font-semibold tracking-tight !h-auto min-h-[2.75rem] py-2.5 px-8 text-sm shadow-[0_6px_28px_rgba(255,235,102,0.28)] hover:shadow-[0_8px_32px_rgba(255,235,102,0.38)] transition-shadow"
          >
            Guardar cambios
          </Button>
          <p className="text-[11px] text-white/35 leading-relaxed sm:max-w-md sm:pt-0.5">
            Aplica el nombre, horarios de turno y, si has elegido o quitado un logo, esa decisión al pulsar el botón.
          </p>
        </div>
      </Card>

      <Card className="space-y-4">
        <h3 className="text-sm font-semibold text-white">
          Columnas Kanban por defecto
        </h3>
        <p className="text-xs text-white/40">
          Estas columnas se usan como referencia al crear proyectos desde el flujo
          estándar (Backlog → Completado).
        </p>
        <div className="space-y-2">
          {["Backlog", "Pendiente", "En Progreso", "En Revisión", "Completado"].map(
            (col, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2.5 rounded-lg bg-white/3 border border-white/6"
              >
                <span className="text-xs text-white/30 w-4">{i + 1}</span>
                <span className="text-sm text-white/70 flex-1">{col}</span>
                {i === 4 && (
                  <span className="text-xs text-[#ffeb66]/60">(final)</span>
                )}
              </div>
            )
          )}
        </div>
      </Card>
    </div>
  );
}
