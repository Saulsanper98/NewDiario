"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Trash2, Loader2, CalendarOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";

type Row = {
  id: string;
  startsAt: string;
  endsAt: string;
  label: string | null;
};

export function UnavailabilityPanel() {
  const { theme } = useTheme();
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me/unavailability");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { items: Row[] };
      setItems(data.items ?? []);
    } catch {
      toast.error("No se pudieron cargar las ventanas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!startsAt || !endsAt) {
      toast.error("Indica inicio y fin");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/me/unavailability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          label: label.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(typeof err.error === "string" ? err.error : "No se pudo guardar");
        return;
      }
      toast.success("Ventana registrada");
      setLabel("");
      setStartsAt("");
      setEndsAt("");
      await load();
    } catch {
      toast.error("Error de red");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    try {
      const res = await fetch(`/api/me/unavailability/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Eliminada");
      setItems((prev) => prev.filter((r) => r.id !== id));
    } catch {
      toast.error("No se pudo eliminar");
    }
  }

  function fmt(iso: string) {
    try {
      return new Date(iso).toLocaleString("es-ES", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return iso;
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
            theme === "light"
              ? "border-zinc-200 bg-zinc-50 text-zinc-700"
              : "border-white/12 bg-white/5 text-[#ffeb66]/85"
          )}
        >
          <CalendarOff className="w-5 h-5" />
        </div>
        <div>
          <h1
            className={cn(
              "text-lg font-semibold tracking-tight",
              theme === "light" ? "text-zinc-900" : "text-white"
            )}
          >
            Indisponibilidad
          </h1>
          <p
            className={cn(
              "text-sm mt-1",
              theme === "light" ? "text-zinc-600" : "text-white/45"
            )}
          >
            Registra ventanas (turno de noche, formación, etc.). Si alguien te asigna una
            tarea durante una ventana activa, verá un aviso informativo.
          </p>
        </div>
      </div>

      <Card
        className={cn(
          "p-4 sm:p-5 space-y-4",
          theme === "light" && "border-zinc-200/90 bg-white shadow-sm"
        )}
      >
        <h2
          className={cn(
            "text-sm font-medium",
            theme === "light" ? "text-zinc-800" : "text-white/80"
          )}
        >
          Nueva ventana
        </h2>
        <form onSubmit={onCreate} className="space-y-3">
          <div>
            <label
              className={cn(
                "text-xs font-medium uppercase tracking-wide",
                theme === "light" ? "text-zinc-500" : "text-white/40"
              )}
            >
              Motivo (opcional)
            </label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={200}
              placeholder="Ej: Curso PRL · Turno de descanso"
              className="mt-1"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                className={cn(
                  "text-xs font-medium uppercase tracking-wide",
                  theme === "light" ? "text-zinc-500" : "text-white/40"
                )}
              >
                Inicio
              </label>
              <input
                type="datetime-local"
                required
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className={cn(
                  "mt-1 w-full rounded-lg border px-3 py-2 text-sm",
                  theme === "light"
                    ? "border-zinc-200 bg-white text-zinc-900"
                    : "border-white/12 bg-white/5 text-white/90"
                )}
              />
            </div>
            <div>
              <label
                className={cn(
                  "text-xs font-medium uppercase tracking-wide",
                  theme === "light" ? "text-zinc-500" : "text-white/40"
                )}
              >
                Fin
              </label>
              <input
                type="datetime-local"
                required
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className={cn(
                  "mt-1 w-full rounded-lg border px-3 py-2 text-sm",
                  theme === "light"
                    ? "border-zinc-200 bg-white text-zinc-900"
                    : "border-white/12 bg-white/5 text-white/90"
                )}
              />
            </div>
          </div>
          <Button type="submit" variant="primary" disabled={saving} loading={saving}>
            Guardar ventana
          </Button>
        </form>
      </Card>

      <Card
        className={cn(
          "p-4 sm:p-5",
          theme === "light" && "border-zinc-200/90 bg-white shadow-sm"
        )}
      >
        <h2
          className={cn(
            "text-sm font-medium mb-3",
            theme === "light" ? "text-zinc-800" : "text-white/80"
          )}
        >
          Tus ventanas
        </h2>
        {loading ? (
          <div className="flex justify-center py-8 text-white/40">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className={cn("text-sm", theme === "light" ? "text-zinc-500" : "text-white/35")}>
            No hay ventanas registradas.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((row) => (
              <li
                key={row.id}
                className={cn(
                  "flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5",
                  theme === "light"
                    ? "border-zinc-200/80 bg-zinc-50/50"
                    : "border-white/10 bg-white/[0.03]"
                )}
              >
                <div className="min-w-0 text-sm">
                  <p className={theme === "light" ? "text-zinc-900" : "text-white/85"}>
                    {row.label?.trim() || "Sin motivo indicado"}
                  </p>
                  <p
                    className={cn(
                      "text-xs mt-0.5",
                      theme === "light" ? "text-zinc-500" : "text-white/40"
                    )}
                  >
                    {fmt(row.startsAt)} → {fmt(row.endsAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(row.id)}
                  className={cn(
                    "shrink-0 p-1.5 rounded-lg transition-colors",
                    theme === "light"
                      ? "text-zinc-400 hover:text-red-600 hover:bg-red-50"
                      : "text-white/30 hover:text-red-400 hover:bg-red-400/10"
                  )}
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
