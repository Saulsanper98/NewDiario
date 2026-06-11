"use client";


import { isLightTheme } from "@/lib/theme";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Trash2, RotateCcw } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";
import { AnnouncementSeverity } from "@/app/generated/prisma/enums";
import { SEVERITY_META, ANNOUNCEMENT_RELOAD_URL } from "@/lib/novedades";
import type { AnnouncementItem } from "./types";

interface AnnouncementEditorProps {
  open: boolean;
  onClose: () => void;
  initial: AnnouncementItem | null;
  onSaved: () => void;
}

const SEVERITY_ORDER: AnnouncementSeverity[] = [
  AnnouncementSeverity.INFO,
  AnnouncementSeverity.WARNING,
  AnnouncementSeverity.CRITICAL,
];

export function AnnouncementEditor({
  open,
  onClose,
  initial,
  onSaved,
}: AnnouncementEditorProps) {
  const { theme } = useTheme();
  const isLight = isLightTheme(theme);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<AnnouncementSeverity>(
    AnnouncementSeverity.INFO
  );
  const [isActive, setIsActive] = useState(true);
  const [dismissible, setDismissible] = useState(true);
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [reload, setReload] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [resetDismissals, setResetDismissals] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title);
      setMessage(initial.message);
      setSeverity(initial.severity);
      setIsActive(initial.isActive);
      setDismissible(initial.dismissible);
      setCtaLabel(initial.ctaLabel ?? "");
      const url = initial.ctaUrl ?? "";
      if (url === ANNOUNCEMENT_RELOAD_URL) {
        setReload(true);
        setCtaUrl("");
      } else {
        setReload(false);
        setCtaUrl(url);
      }
      setExpiresAt(
        initial.expiresAt
          ? new Date(initial.expiresAt).toISOString().slice(0, 16)
          : ""
      );
      setResetDismissals(false);
    } else {
      setTitle("");
      setMessage("");
      setSeverity(AnnouncementSeverity.INFO);
      setIsActive(true);
      setDismissible(true);
      setCtaLabel("");
      setCtaUrl("");
      setReload(false);
      setExpiresAt("");
      setResetDismissals(false);
    }
  }, [open, initial]);

  async function handleSave() {
    if (title.trim().length === 0) {
      toast.error("Pon un título al aviso");
      return;
    }
    if (message.trim().length === 0) {
      toast.error("El mensaje no puede estar vacío");
      return;
    }
    setSaving(true);
    try {
      const finalCtaUrl = reload
        ? ANNOUNCEMENT_RELOAD_URL
        : ctaUrl.trim() || null;
      const payload = {
        title: title.trim(),
        message: message.trim(),
        severity,
        isActive,
        dismissible,
        ctaLabel: ctaLabel.trim() || null,
        ctaUrl: finalCtaUrl,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        ...(initial && resetDismissals ? { resetDismissals: true } : {}),
      };
      const res = await fetch(
        initial ? `/api/announcements/${initial.id}` : "/api/announcements",
        {
          method: initial ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          typeof data?.error === "string" ? data.error : "No se pudo guardar"
        );
      }
      toast.success(
        initial ? "Aviso actualizado" : "Aviso publicado para todos"
      );
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!initial) return;
    if (
      !confirm(
        "¿Eliminar este aviso? Desaparecerá inmediatamente para todos los usuarios."
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/announcements/${initial.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Aviso eliminado");
      onSaved();
      onClose();
    } catch {
      toast.error("No se pudo eliminar");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Editar aviso" : "Nuevo aviso global"}
      description="Aparecerá como banner pegado arriba de todas las páginas para los usuarios."
      size="lg"
    >
      <div className="space-y-5">
        <div className="space-y-1.5">
          <label
            className={cn(
              "block text-xs font-semibold uppercase tracking-wider",
              isLight ? "text-zinc-500" : "text-white/40"
            )}
          >
            Severidad
          </label>
          <div className="grid grid-cols-3 gap-2">
            {SEVERITY_ORDER.map((s) => {
              const meta = SEVERITY_META[s];
              const Icon = meta.Icon;
              const active = s === severity;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeverity(s)}
                  className={cn(
                    "relative flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium overflow-hidden transition-all",
                    active
                      ? meta.bannerClass +
                          " shadow-lg ring-2 ring-white/30"
                      : isLight
                        ? "border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                        : "border border-white/10 bg-white/3 text-white/55 hover:bg-white/6"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            className={cn(
              "block text-xs font-semibold uppercase tracking-wider",
              isLight ? "text-zinc-500" : "text-white/40"
            )}
          >
            Título
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="La app se reiniciará en 5 min"
            className={inputCn(isLight)}
          />
        </div>

        <div className="space-y-1.5">
          <label
            className={cn(
              "block text-xs font-semibold uppercase tracking-wider",
              isLight ? "text-zinc-500" : "text-white/40"
            )}
          >
            Mensaje
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Por favor, guarda los cambios. Reiniciaremos para aplicar una actualización."
            className={cn(inputCn(isLight), "resize-y")}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label
              className={cn(
                "block text-xs font-semibold uppercase tracking-wider",
                isLight ? "text-zinc-500" : "text-white/40"
              )}
            >
              Botón de acción (opcional)
            </label>
            <input
              type="text"
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              maxLength={60}
              placeholder="Recargar ahora"
              className={inputCn(isLight)}
            />
          </div>
          <div className="space-y-1.5">
            <label
              className={cn(
                "block text-xs font-semibold uppercase tracking-wider",
                isLight ? "text-zinc-500" : "text-white/40"
              )}
            >
              URL del botón
            </label>
            <input
              type="text"
              value={ctaUrl}
              onChange={(e) => setCtaUrl(e.target.value)}
              disabled={reload}
              maxLength={500}
              placeholder="/dashboard ó https://..."
              className={cn(inputCn(isLight), reload && "opacity-50")}
            />
          </div>
        </div>

        <label
          className={cn(
            "flex items-center gap-2 text-sm cursor-pointer",
            isLight ? "text-zinc-700" : "text-white/70"
          )}
        >
          <input
            type="checkbox"
            checked={reload}
            onChange={(e) => setReload(e.target.checked)}
            className="accent-[#ffeb66]"
          />
          <RotateCcw className="w-3.5 h-3.5" />
          El botón recarga la app (en lugar de navegar a una URL)
        </label>

        <div className="space-y-1.5">
          <label
            className={cn(
              "block text-xs font-semibold uppercase tracking-wider",
              isLight ? "text-zinc-500" : "text-white/40"
            )}
          >
            Caduca el (opcional)
          </label>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className={inputCn(isLight)}
          />
        </div>

        <div
          className={cn(
            "grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-xl",
            isLight ? "bg-zinc-50" : "bg-white/3"
          )}
        >
          <label
            className={cn(
              "flex items-center gap-2 text-sm cursor-pointer",
              isLight ? "text-zinc-700" : "text-white/70"
            )}
          >
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="accent-[#ffeb66]"
            />
            Activo (visible para todos)
          </label>
          <label
            className={cn(
              "flex items-center gap-2 text-sm cursor-pointer",
              isLight ? "text-zinc-700" : "text-white/70"
            )}
          >
            <input
              type="checkbox"
              checked={dismissible}
              onChange={(e) => setDismissible(e.target.checked)}
              className="accent-[#ffeb66]"
            />
            El usuario puede cerrarlo
          </label>
          {initial && (
            <label
              className={cn(
                "flex items-center gap-2 text-sm cursor-pointer md:col-span-2",
                isLight ? "text-zinc-700" : "text-white/70"
              )}
            >
              <input
                type="checkbox"
                checked={resetDismissals}
                onChange={(e) => setResetDismissals(e.target.checked)}
                className="accent-[#ffeb66]"
              />
              Volver a mostrar a los usuarios que lo habían cerrado (
              {initial.dismissalsCount})
            </label>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <div>
            {initial && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => void handleDelete()}
                loading={deleting}
              >
                <Trash2 className="w-3.5 h-3.5" /> Eliminar
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="md" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => void handleSave()}
              loading={saving}
            >
              {initial ? "Guardar cambios" : "Publicar aviso"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function inputCn(isLight: boolean): string {
  return cn(
    "w-full px-3 py-2 rounded-lg text-sm transition-colors border outline-none",
    isLight
      ? "bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-[color:var(--lt-yellow-solid)] focus:ring-2 focus:ring-[color:var(--lt-yellow-solid)]/30"
      : "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#ffeb66]/40 focus:ring-2 focus:ring-[#ffeb66]/20"
  );
}
