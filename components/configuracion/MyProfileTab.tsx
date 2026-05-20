"use client";

import { useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Camera,
  ChevronDown,
  Crosshair,
  KeyRound,
  Loader2,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import { Avatar } from "@/components/ui/Avatar";
import { AvatarImagePreview } from "@/components/ui/AvatarImagePreview";
import { ProfileBannerFields } from "@/components/profile/ProfileBannerFields";
import { FocusPicker } from "@/components/profile/FocusPicker";
import { ProfileMenuBanner } from "@/components/ui/ProfileMenuBanner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth/types";
import { useAvatarFrameEffect } from "@/lib/hooks/useAvatarFrameEffect";
import { useTheme } from "@/components/layout/ThemeProvider";
import {
  IMAGE_UPLOAD_ACCEPT,
  IMAGE_UPLOAD_HINT,
  validateProfileImageFile,
} from "@/lib/upload-file";

interface MyProfileTabProps {
  currentUser: SessionUser;
}

export function MyProfileTab({ currentUser }: MyProfileTabProps) {
  const { theme } = useTheme();
  const L = theme === "light";
  const { update } = useSession();
  const avatarEffect = useAvatarFrameEffect();

  const [name, setName] = useState(currentUser.name ?? "");
  const [image, setImage] = useState(currentUser.image ?? "");
  const [imageFocusX, setImageFocusX] = useState<number | null>(
    currentUser.imageFocusX ?? null
  );
  const [imageFocusY, setImageFocusY] = useState<number | null>(
    currentUser.imageFocusY ?? null
  );
  const [profileBanner, setProfileBanner] = useState(
    currentUser.profileBanner ?? ""
  );
  const [bannerFocusX, setBannerFocusX] = useState<number | null>(
    currentUser.bannerFocusX ?? null
  );
  const [bannerFocusY, setBannerFocusY] = useState<number | null>(
    currentUser.bannerFocusY ?? null
  );
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showImageUrl, setShowImageUrl] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [avatarFocusOpen, setAvatarFocusOpen] = useState(false);
  const [bannerFocusOpen, setBannerFocusOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const trimmedName = name.trim();
  const trimmedImage = image.trim();
  const trimmedBanner = profileBanner.trim();
  const nameDirty = trimmedName !== (currentUser.name ?? "");
  const imageDirty = trimmedImage !== (currentUser.image ?? "");
  const passwordDirty = password.length > 0;
  const hasChanges = nameDirty || imageDirty || passwordDirty;

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
    const validationError = validateProfileImageFile(file);
    if (validationError) {
      toast.error(validationError);
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
      setAvatarFocusOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir");
    } finally {
      setUploading(false);
    }
  }

  async function saveAvatarFocus(x: number, y: number) {
    const res = await fetch(`/api/users/${currentUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageFocusX: x, imageFocusY: y }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        typeof data?.error === "string" ? data.error : "No se pudo guardar el enfoque";
      throw new Error(msg);
    }
    setImageFocusX(x);
    setImageFocusY(y);
    await update({ imageFocusX: x, imageFocusY: y });
    toast.success("Enfoque del avatar guardado");
  }

  async function saveBannerFocus(x: number, y: number) {
    const res = await fetch(`/api/users/${currentUser.id}`, {
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
    setBannerFocusX(x);
    setBannerFocusY(y);
    await update({ bannerFocusX: x, bannerFocusY: y });
    toast.success("Enfoque del fondo guardado");
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

    if (nameDirty && trimmedName.length < 2) {
      toast.error("El nombre debe tener al menos 2 caracteres");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (nameDirty) body.name = trimmedName;
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

      if (nameDirty || imageDirty) {
        await update({
          ...(nameDirty ? { name: trimmedName } : {}),
          ...(imageDirty
            ? { image: trimmedImage !== "" ? trimmedImage : null }
            : {}),
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
          Actualiza tu foto, el fondo del menú de perfil y tu contraseña.
        </p>
      </div>

      <form onSubmit={handleSubmit} className={cardClass}>
        {/* Cabecera con fondo de perfil + avatar */}
        <div
          className={cn(
            "relative overflow-hidden text-center",
            L ? "border-b border-zinc-200/80" : "border-b border-white/8"
          )}
        >
          <ProfileMenuBanner
            bannerUrl={trimmedBanner || null}
            focusX={bannerFocusX}
            focusY={bannerFocusY}
            accentColor={defaultDept?.accentColor}
            blendToColor={L ? "#fafafa" : "#0d1427"}
            heightClass="h-28 sm:h-32"
          />
          <div className="relative px-6 pb-6 pt-0">
          <input
            ref={fileInputRef}
            type="file"
            accept={IMAGE_UPLOAD_ACCEPT}
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadAvatar(f);
              e.currentTarget.value = "";
            }}
          />
          <div className="-mt-10 relative mx-auto inline-flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => trimmedImage && setPreviewOpen(true)}
              disabled={!trimmedImage || uploading}
              title={trimmedImage ? "Ver foto en grande" : "Aún no hay foto"}
              className={cn(
                "group relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffeb66]/50",
                trimmedImage && "cursor-zoom-in",
                "ring-[3px]",
                L ? "ring-[#fafafa]" : "ring-[#0d1427]"
              )}
              style={{
                boxShadow: defaultDept?.accentColor
                  ? `0 0 0 1px ${defaultDept.accentColor}55, 0 8px 20px rgba(0,0,0,0.35)`
                  : undefined,
              }}
            >
              <Avatar
                name={currentUser.name}
                image={trimmedImage || null}
                focusX={imageFocusX}
                focusY={imageFocusY}
                size="xl"
                effect={avatarEffect}
              />
            </button>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  L
                    ? "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                    : "border-white/15 bg-white/5 text-white/75 hover:bg-white/10",
                  uploading && "pointer-events-none opacity-60"
                )}
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
                {uploading ? "Subiendo…" : "Cambiar foto"}
              </button>
              {trimmedImage && !uploading && (
                <button
                  type="button"
                  onClick={() => setAvatarFocusOpen(true)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                    L
                      ? "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                      : "border-white/15 bg-white/5 text-white/75 hover:bg-white/10"
                  )}
                  title="Ajustar qué parte de la foto se ve"
                >
                  <Crosshair className="h-3.5 w-3.5" />
                  Ajustar enfoque
                </button>
              )}
            </div>
          </div>

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
            Pulsa la foto para verla en grande · «Cambiar foto» o URL abajo para actualizarla
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
        </div>

        {/* Nombre */}
        <div
          className={cn(
            "px-6 pt-5 pb-2",
            L ? "border-t border-zinc-200/80" : "border-t border-white/8"
          )}
        >
          <Input
            light={L}
            label="Nombre"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre"
            autoComplete="name"
            minLength={2}
            maxLength={120}
            required
          />
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

        {/* Fondo menú perfil */}
        <div
          id="fondo-perfil"
          className={cn(
            "scroll-mt-6 px-6 py-5",
            L ? "border-t border-zinc-200/80" : "border-t border-white/8"
          )}
        >
          <p className={cn("text-sm font-medium", L ? "text-zinc-900" : "text-white")}>
            Fondo del menú de perfil
          </p>
          <p className={cn("mt-1 text-xs", L ? "text-zinc-500" : "text-white/35")}>
            Se muestra en la cabecera de esta página y al abrir tu perfil en el menú lateral.
          </p>
          {/* Vista previa: cómo se verá el fondo en la fila de Usuarios */}
          {trimmedBanner && (
            <div className="mt-3">
              <p
                className={cn(
                  "mb-1.5 text-[11px] uppercase tracking-wide",
                  L ? "text-zinc-500" : "text-white/40"
                )}
              >
                Vista previa en la lista de usuarios
              </p>
              <div
                className={cn(
                  "relative flex items-center gap-2.5 overflow-hidden rounded-lg border px-3 py-2.5",
                  L ? "border-zinc-200" : "border-white/10"
                )}
                style={{
                  backgroundImage: `linear-gradient(90deg, rgba(10,15,30,0.92) 0%, rgba(10,15,30,0.55) 35%, rgba(10,15,30,0.45) 65%, rgba(10,15,30,0.92) 100%), url(${trimmedBanner})`,
                  backgroundRepeat: "no-repeat, no-repeat",
                  backgroundSize: "cover, cover",
                  backgroundPosition: `center, ${bannerFocusX ?? 50}% ${bannerFocusY ?? 50}%`,
                }}
              >
                <div className="relative z-[1] flex items-center gap-2.5">
                  <Avatar
                    name={trimmedName || currentUser.name}
                    image={trimmedImage || null}
                    focusX={imageFocusX}
                    focusY={imageFocusY}
                    size="sm"
                  />
                  <div>
                    <p className="text-sm font-medium text-white">
                      {trimmedName || currentUser.name}
                    </p>
                    <p className="text-xs text-white/55">{currentUser.email}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="mt-3">
            <ProfileBannerFields
              userId={currentUser.id}
              value={profileBanner}
              onChange={setProfileBanner}
              isLight={L}
              focusX={bannerFocusX}
              focusY={bannerFocusY}
              onFocusChange={(x, y) => {
                setBannerFocusX(x);
                setBannerFocusY(y);
              }}
            />
          </div>
          {trimmedBanner && (
            <button
              type="button"
              onClick={() => setBannerFocusOpen(true)}
              className={cn(
                "mt-3 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                L
                  ? "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  : "border-white/15 bg-white/5 text-white/75 hover:bg-white/10"
              )}
              title="Ajustar qué parte del fondo se ve"
            >
              <Crosshair className="h-3.5 w-3.5" />
              Ajustar enfoque del fondo
            </button>
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

      <AvatarImagePreview
        open={previewOpen}
        name={currentUser.name}
        imageUrl={trimmedImage || null}
        onClose={() => setPreviewOpen(false)}
      />

      {trimmedImage && (
        <FocusPicker
          open={avatarFocusOpen}
          onClose={() => setAvatarFocusOpen(false)}
          imageUrl={trimmedImage}
          variant="avatar"
          initialFocusX={imageFocusX}
          initialFocusY={imageFocusY}
          onSave={saveAvatarFocus}
        />
      )}
      {trimmedBanner && (
        <FocusPicker
          open={bannerFocusOpen}
          onClose={() => setBannerFocusOpen(false)}
          imageUrl={trimmedBanner}
          variant="banner"
          initialFocusX={bannerFocusX}
          initialFocusY={bannerFocusY}
          onSave={saveBannerFocus}
        />
      )}
    </div>
  );
}
