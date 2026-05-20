"use client";

import { useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Crosshair, ImageIcon, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { patchProfileBanner, uploadProfileBannerFile } from "@/lib/profile-banner";
import { FocusPicker } from "@/components/profile/FocusPicker";
import { cn } from "@/lib/utils";
import { IMAGE_UPLOAD_ACCEPT } from "@/lib/upload-file";

interface ProfileBannerFieldsProps {
  userId: string;
  value: string;
  onChange: (url: string) => void;
  isLight: boolean;
  /** Panel compacto para el menú lateral */
  compact?: boolean;
  focusX?: number | null;
  focusY?: number | null;
  /** Callback opcional para sincronizar el foco con el padre tras guardarlo. */
  onFocusChange?: (x: number, y: number) => void;
}

export function ProfileBannerFields({
  userId,
  value,
  onChange,
  isLight,
  compact = false,
  focusX,
  focusY,
  onFocusChange,
}: ProfileBannerFieldsProps) {
  const { update } = useSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [savingUrl, setSavingUrl] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);

  async function saveBanner(url: string | null) {
    const trimmed = url?.trim() ?? "";
    await patchProfileBanner(userId, trimmed || null);
    await update({ profileBanner: trimmed || null });
    onChange(trimmed);
  }

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const url = await uploadProfileBannerFile(file);
      await saveBanner(url);
      toast.success("Fondo actualizado");
      setFocusOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir");
    } finally {
      setUploading(false);
    }
  }

  async function persistFocus(x: number, y: number) {
    const res = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bannerFocusX: x, bannerFocusY: y }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        typeof data?.error === "string" ? data.error : "No se pudo guardar el enfoque";
      throw new Error(msg);
    }
    await update({ bannerFocusX: x, bannerFocusY: y });
    onFocusChange?.(x, y);
    toast.success("Enfoque del fondo guardado");
  }

  async function applyUrl() {
    const trimmed = value.trim();
    if (!trimmed) {
      toast.error("Escribe una URL o sube una imagen");
      return;
    }
    setSavingUrl(true);
    try {
      await saveBanner(trimmed);
      toast.success("Fondo actualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSavingUrl(false);
    }
  }

  async function removeBanner() {
    setUploading(true);
    try {
      await saveBanner(null);
      toast.success("Fondo eliminado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al quitar");
    } finally {
      setUploading(false);
    }
  }

  const busy = uploading || savingUrl;
  const inputClass = cn(
    "w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none transition-colors",
    isLight
      ? "border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-amber-400"
      : "border-white/12 bg-white/5 text-white placeholder:text-white/30 focus:border-[#ffeb66]/40"
  );
  const btnClass = cn(
    "inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
    isLight
      ? "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
      : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
  );

  return (
    <div className={cn("space-y-2", compact ? "px-1 pb-1" : "")}>
      <input
        ref={fileRef}
        type="file"
        accept={IMAGE_UPLOAD_ACCEPT}
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.currentTarget.value = "";
        }}
      />

      <div className={cn("flex flex-wrap gap-1.5", compact && "flex-col")}>
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className={btnClass}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ImageIcon className="h-3.5 w-3.5" />
          )}
          {uploading ? "Subiendo…" : "Subir imagen"}
        </button>
        {value.trim() ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => setFocusOpen(true)}
              className={btnClass}
              title="Ajustar qué parte del fondo se ve"
            >
              <Crosshair className="h-3.5 w-3.5" />
              Enfoque
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void removeBanner()}
              className={cn(btnClass, "text-red-400 hover:bg-red-500/10")}
            >
              Quitar
            </button>
          </>
        ) : null}
      </div>

      <div className="flex gap-1.5">
        <input
          type="text"
          value={value}
          disabled={busy}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void applyUrl();
            }
          }}
          placeholder="/api/media/... o https://..."
          className={cn(inputClass, "min-w-0 flex-1")}
          aria-label="URL del fondo"
        />
        <button
          type="button"
          disabled={busy || !value.trim()}
          onClick={() => void applyUrl()}
          className={cn(btnClass, "shrink-0")}
        >
          {savingUrl ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Aplicar"}
        </button>
      </div>

      {value.trim() && (
        <FocusPicker
          open={focusOpen}
          onClose={() => setFocusOpen(false)}
          imageUrl={value.trim()}
          variant="banner"
          initialFocusX={focusX ?? null}
          initialFocusY={focusY ?? null}
          onSave={persistFocus}
        />
      )}
    </div>
  );
}
