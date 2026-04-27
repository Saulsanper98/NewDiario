"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Sun, Moon } from "lucide-react";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { APP_NAME } from "@/lib/app-brand";

export function AppSettingsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [appName, setAppName] = useState(APP_NAME);
  const [shifts, setShifts] = useState({
    morning: { from: "06:00", to: "14:00" },
    afternoon: { from: "14:00", to: "22:00" },
    night: { from: "22:00", to: "06:00" },
  });

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

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            app_name: appName.trim(),
            shift_morning_start: shifts.morning.from,
            shift_morning_end: shifts.morning.to,
            shift_afternoon_start: shifts.afternoon.from,
            shift_afternoon_end: shifts.afternoon.to,
            shift_night_start: shifts.night.from,
            shift_night_end: shifts.night.to,
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Error");
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
      <div className="text-sm text-white/40 py-8">Cargando configuración…</div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <Card className="space-y-4">
        <h3 className="text-sm font-semibold text-white">General</h3>
        <Input
          label="Nombre de la aplicación"
          value={appName}
          onChange={(e) => setAppName(e.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-white/60 uppercase tracking-wide">
            Logo
          </label>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 overflow-hidden shrink-0 relative">
              <Image
                src="/logo.svg"
                alt=""
                width={40}
                height={40}
                className="object-contain p-1"
              />
            </div>
            <p className="text-xs text-white/35">
              Sustituye <code className="text-white/50">public/logo.svg</code> en el
              despliegue para cambiar el logo global.
            </p>
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <h3 className="text-sm font-semibold text-white">Turnos</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
              icon: Sun,
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
              className="p-3 rounded-lg bg-white/3 border border-white/8 space-y-2"
            >
              <p className="text-xs font-medium text-white/60 flex items-center gap-1.5">
                <Icon className="w-3 h-3" />
                {label}
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={state.from}
                  onChange={(e) =>
                    setShifts((prev) => ({
                      ...prev,
                      [key]: { ...prev[key], from: e.target.value },
                    }))
                  }
                  className="bg-white/5 border border-white/8 rounded px-2 py-1 text-xs text-white focus:outline-none w-full"
                />
                <span className="text-white/20 text-xs">→</span>
                <input
                  type="time"
                  value={state.to}
                  onChange={(e) =>
                    setShifts((prev) => ({
                      ...prev,
                      [key]: { ...prev[key], to: e.target.value },
                    }))
                  }
                  className="bg-white/5 border border-white/8 rounded px-2 py-1 text-xs text-white focus:outline-none w-full"
                />
              </div>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="primary"
          size="sm"
          loading={saving}
          onClick={() => void handleSave()}
        >
          Guardar cambios
        </Button>
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
