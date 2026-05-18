"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Camera,
  ChevronDown,
  KeyRound,
  Loader2,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth/types";
import { useAvatarFrameEffect } from "@/lib/hooks/useAvatarFrameEffect";
import { useTheme } from "@/components/layout/ThemeProvider";

interface MyProfileTabProps {
  currentUser: SessionUser;
}

export function MyProfileTab({ currentUser }: MyProfileTabProps) {
  const { theme } = useTheme();
  const L = theme === "light";
  const { update } = useSession();
  const avatarEffect = useAvatarFrameEffect();

  const [image, setImage] = useState(currentUser.image ?? "");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showImageUrl, setShowImageUrl] = useState(false);

  const trimmedImage = image.trim();
  const imageDirty = trimmedImage !== (currentUser.image ?? "");
  const passwordDirty = password.length > 0;
  const hasChanges = imageDirty || passwordDirty;

  const defaultDept = useMemo(
    () =>
      currentUser.departments.find((d) => d.id === currentUser.activeDepartmentId) ??
      currentUser.departments.find((d) => d.isDefault) ??
      currentUser.departments[0],
    [currentUser]
  );

  async function persistImage(url: string) {
    const res = await fetch(`/api/users/${currentUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: url || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        typeof data?.error === "string"
          ? data.error
          : "No se pudo guardar la foto";
      throw new Error(msg);
    }
    await update({ image: url || null });
  }

  async function uploadAvatar(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecciona una imagen válida (JPG, PNG, GIF o WebP)");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "No se pudo subir el avatar");
      }
      setImage(data.url);
      await persistImage(data.url);
      toast.success("Foto de perfil actualizada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password && password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (password && password !== password2) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    if (!hasChanges) {
      toast.error("No hay cambios que guardar");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (imageDirty) body.image = trimmedImage;
      if (password) body.password = password;

      const res = await fetch(`/api/users/${currentUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data?.error === "string"
            ? data.error
            : "No se pudieron guardar los cambios";
        throw new Error(msg);
      }

      if (imageDirty) {
        await update({
          image: trimmedImage !== "" ? trimmedImage : null,
        });
      }

      setPassword("");
      setPassword2("");
      toast.success(password ? "Contraseña actualizada" : "Cambios guardados");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  const cardClass = cn(
    "my-profile-card overflow-hidden rounded-2xl border shadow-xl",
    L
      ? "border-zinc-200/90 bg-gradient-to-b from-white to-zinc-50/95 shadow-zinc-200/40"
      : "border-white/10 bg-gradient-to-b from-[#121a2e]/95 to-[#0d1427]/98 shadow-black/30"
  );

  return (
    <div className="mx-auto w-full max-w-lg pb-8">
      <div className="mb-6">
        <h1
          className={cn(
            "text-xl font-semibold tracking-tight",
            L ? "text-zinc-900" : "text-white"
          )}
        >
          Mi cuenta
        </h1>
        <p className={cn("mt-1 text-sm", L ? "text-zinc-600" : "text-white/45")}>
          Actualiza tu foto y tu contraseña de acceso.
        </p>
      </div>

      <form onSubmit={handleSubmit} className={cardClass}>
        {/* Cabecera con avatar */}
        <div
          className={cn(
            "relative px-6 pb-6 pt-8 text-center",
            L
              ? "border-b border-zinc-200/80 bg-zinc-50/50"
              : "border-b border-white/8 bg-white/[0.02]"
          )}
        >
          <label
            className={cn(
              "group relative mx-auto inline-flex cursor-pointer rounded-full",
              uploading && "pointer-events-none opacity-70"
            )}
          >
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadAvatar(f);
                e.currentTarget.value = "";
              }}
            />
            <Avatar
              name={currentUser.name}
              image={trimmedImage || null}
              size="xl"
              effect={avatarEffect}
            />
            <span
              className={cn(
                "absolute inset-0 flex items-center justify-center rounded-full transition-opacity",
                L ? "bg-zinc-900/40" : "bg-black/45",
                uploading ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
            >
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              ) : (
                <Camera className="h-6 w-6 text-white drop-shadow" />
              )}
            </span>
          </label>

          <p
            className={cn(
              "mt-4 text-base font-semibold",
              L ? "text-zinc-900" : "text-white"
            )}
          >
            {currentUser.name}
          </p>
          <p className={cn("text-sm", L ? "text-zinc-500" : "text-white/40")}>
            {currentUser.email}
          </p>

          {defaultDept && (
            <span
              className={cn(
                "mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                L ? "bg-zinc-100 text-zinc-600" : "bg-white/6 text-white/50"
              )}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: defaultDept.accentColor }}
              />
              {defaultDept.name}
            </span>
          )}

          <p className={cn("mt-3 text-xs", L ? "text-zinc-400" : "text-white/30")}>
            Pulsa la foto para cambiarla · JPG, PNG o WebP
          </p>

          <p
            className={cn(
              "mt-2 inline-flex items-center gap-1 text-[11px]",
              L ? "text-zinc-400" : "text-white/28"
            )}
          >
            <Sparkles className="h-3 w-3 shrink-0" />
            El marco decorativo se elige en el menú lateral
          </p>
        </div>

        {/* URL opcional */}
        <div className="px-6 pt-4">
          <button
            type="button"
            onClick={() => setShowImageUrl((v) => !v)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs font-medium transition-colors",
              L
                ? "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                : "text-white/40 hover:bg-white/5 hover:text-white/70"
            )}
          >
            Usar enlace de imagen
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                showImageUrl && "rotate-180"
              )}
            />
          </button>
          {showImageUrl && (
            <div className="mt-2 pb-1">
              <Input
                light={L}
                label="URL de imagen"
                type="text"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="/api/media/... o https://..."
                autoComplete="off"
              />
            </div>
          )}
        </div>

        {/* Contraseña */}
        <div
          className={cn(
            "space-y-4 px-6 py-5",
            L ? "border-t border-zinc-200/80" : "border-t border-white/8"
          )}
        >
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg",
                L ? "bg-amber-50 text-amber-700" : "bg-[#ffeb66]/10 text-[#ffeb66]"
              )}
            >
              <KeyRound className="h-4 w-4" />
            </span>
            <div>
              <p
                className={cn(
                  "text-sm font-medium",
                  L ? "text-zinc-900" : "text-white"
                )}
              >
                Contraseña
              </p>
              <p className={cn("text-xs", L ? "text-zinc-500" : "text-white/35")}>
                Déjala vacía si no quieres cambiarla
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              light={L}
              label="Nueva contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              autoComplete="new-password"
              placeholder="Mín. 8 caracteres"
            />
            <Input
              light={L}
              label="Confirmar"
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              minLength={8}
              autoComplete="new-password"
            />
          </div>
        </div>

        {/* Acciones */}
        <div
          className={cn(
            "flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between",
            L ? "border-t border-zinc-200/80 bg-zinc-50/60" : "border-t border-white/8 bg-black/15"
          )}
        >
          <p className={cn("text-xs", L ? "text-zinc-500" : "text-white/35")}>
            {hasChanges
              ? "Tienes cambios sin guardar"
              : "Sin cambios pendientes"}
          </p>
          <Button
            type="submit"
            variant="primary"
            loading={saving}
            disabled={!hasChanges || saving}
            className="w-full sm:w-auto sm:min-w-[10rem]"
          >
            Guardar cambios
          </Button>
        </div>
      </form>
    </div>
  );
}
