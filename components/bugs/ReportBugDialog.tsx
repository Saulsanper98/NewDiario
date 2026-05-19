"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import toast from "react-hot-toast";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/components/layout/ThemeProvider";
import { cn } from "@/lib/utils";
import { BugReportPriority } from "@/app/generated/prisma/enums";
import { BUG_REPORT_PRIORITY_LABELS } from "@/lib/bug-reports";

interface ReportBugDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ReportBugDialog({ open, onClose }: ReportBugDialogProps) {
  const { theme } = useTheme();
  const L = theme === "light";
  const pathname = usePathname();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<BugReportPriority>(BugReportPriority.MEDIUM);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setTitle("");
    setDescription("");
    setPriority(BugReportPriority.MEDIUM);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const pageUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}${pathname}${window.location.search}`
          : pathname;

      const res = await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          pageUrl,
          priority,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = data?.error;
        if (err && typeof err === "object") {
          const first = Object.values(err as Record<string, string[]>)[0]?.[0];
          throw new Error(first ?? "No se pudo enviar el reporte");
        }
        throw new Error(
          typeof data?.error === "string" ? data.error : "No se pudo enviar el reporte"
        );
      }
      toast.success("Reporte enviado. Gracias por avisar.");
      reset();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al enviar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reportar un bug"
      description="Cuéntanos qué ha fallado. Se guardará la página actual para localizarlo."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          light={L}
          label="Título breve"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej. No guarda la nota al publicar"
          required
          maxLength={200}
          autoFocus
        />

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="bug-description"
            className={cn(
              "text-xs font-medium uppercase tracking-wide",
              L ? "text-zinc-500" : "text-white/60"
            )}
          >
            Qué pasó <span className="text-red-400/80">*</span>
          </label>
          <textarea
            id="bug-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            minLength={10}
            maxLength={10000}
            rows={5}
            placeholder="Pasos para reproducirlo, mensaje de error, qué esperabas…"
            className={cn(
              "w-full resize-y rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1",
              L
                ? "border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-amber-400/80 focus:ring-amber-400/30"
                : "border-white/10 bg-white/5 text-white placeholder:text-white/30 focus:border-[#ffeb66]/50 focus:ring-[#ffeb66]/20"
            )}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="bug-priority"
            className={cn(
              "text-xs font-medium uppercase tracking-wide",
              L ? "text-zinc-500" : "text-white/60"
            )}
          >
            Urgencia
          </label>
          <select
            id="bug-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as BugReportPriority)}
            className={cn(
              "h-9 rounded-lg px-3 text-sm focus:outline-none",
              L
                ? "border border-zinc-200 bg-white text-zinc-900"
                : "border border-white/10 bg-white/5 text-white"
            )}
          >
            {(Object.keys(BUG_REPORT_PRIORITY_LABELS) as BugReportPriority[]).map((p) => (
              <option key={p} value={p}>
                {BUG_REPORT_PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </div>

        <p className={cn("text-[11px]", L ? "text-zinc-500" : "text-white/35")}>
          Se adjuntará la página actual ({pathname}) para localizar el fallo.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={submitting}>
            Enviar reporte
          </Button>
        </div>
      </form>
    </Modal>
  );
}
