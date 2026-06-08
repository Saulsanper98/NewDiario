"use client";

import { useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Camera,
  Check,
  ChevronDown,
  Crosshair,
  KeyRound,
  Loader2,
  Mail,
  Shield,
  Sparkles,
  X,
  Image as ImageIcon,
  User as UserIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { Avatar } from "@/components/ui/Avatar";
import { AvatarImagePreview } from "@/components/ui/AvatarImagePreview";
import { KioskSettingsCard } from "@/components/configuracion/KioskSettingsCard";
import { MirrorModeCard } from "@/components/configuracion/MirrorModeCard";
import { isMirroringEnabledForEmail } from "@/lib/presence/linked-account";
import { ProfileBannerFields } from "@/components/profile/ProfileBannerFields";
import { FocusPicker } from "@/components/profile/FocusPicker";
import { ProfileMenuBanner } from "@/components/ui/ProfileMenuBanner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth/types";
import { useAvatarFrameEffect } from "@/lib/hooks/useAvatarFrameEffect";
import { useTheme } from "@/components/layout/ThemeProvider";
import { USER_ROW_BANNER_HD } from "@/lib/feature-flags";
import {
  IMAGE_UPLOAD_ACCEPT,
  validateProfileImageFile,
} from "@/lib/upload-file";
/* SoundLibraryCard retirado por decisión de producto: ahora solo se ofrecen
 * los sonidos "de serie" (presets). El componente sigue en el repo y la API
 * `GET /api/me/sounds` continúa funcionando para los sonidos personalizados
 * que algún usuario ya tuviera asignados antes de la retirada. Los endpoints
 * de SUBIR nuevos sonidos (`POST /api/me/sounds/upload` y
 * `POST /api/me/sounds/from-url`) devuelven ahora 410 Gone. */
// import { SoundLibraryCard } from "@/components/configuracion/SoundLibraryCard";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth/password-policy";

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
  const [birthday, setBirthday] = useState(currentUser.birthday ?? "");
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
  const birthdayDirty = birthday !== (currentUser.birthday ?? "");
  const imageDirty = trimmedImage !== (currentUser.image ?? "");
  const passwordDirty = password.length > 0;
  const hasChanges = nameDirty || imageDirty || passwordDirty || birthdayDirty;

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

    if (password) {
      if (password.length < MIN_PASSWORD_LENGTH) {
        toast.error(
          `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`
        );
        return;
      }
      if (password.length > MAX_PASSWORD_LENGTH) {
        toast.error(
          `La contraseña no puede superar ${MAX_PASSWORD_LENGTH} caracteres`
        );
        return;
      }
      const classes =
        (/[a-z]/.test(password) ? 1 : 0) +
        (/[A-Z]/.test(password) ? 1 : 0) +
        (/\d/.test(password) ? 1 : 0) +
        (/[^A-Za-z0-9]/.test(password) ? 1 : 0);
      if (classes < 3) {
        toast.error(
          "La contraseña debe combinar al menos 3 de: mayúsculas, minúsculas, números y símbolos"
        );
        return;
      }
      if (password !== password2) {
        toast.error("Las contraseñas no coinciden");
        return;
      }
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
      const body: Record<string, string | null> = {};
      if (nameDirty) body.name = trimmedName;
      if (imageDirty) body.image = trimmedImage;
      if (password) body.password = password;
      if (birthdayDirty) body.birthday = birthday || null;

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

  // Rol "más alto" entre el rol global y los departamentos del usuario, para
  // mostrarlo como badge en la cabecera.
  const topRole = useMemo<"SUPERADMIN" | "ADMIN" | "OPERATOR" | null>(() => {
    if (currentUser.role === "SUPERADMIN") return "SUPERADMIN";
    const roles = currentUser.departments.map((d) => d.role);
    if (roles.includes("ADMIN")) return "ADMIN";
    if (roles.includes("OPERATOR")) return "OPERATOR";
    return null;
  }, [currentUser]);

  const ROLE_LABEL: Record<"SUPERADMIN" | "ADMIN" | "OPERATOR", string> = {
    SUPERADMIN: "Super admin",
    ADMIN: "Admin",
    OPERATOR: "Operador",
  };

  return (
    <div className="mx-auto w-full max-w-3xl pb-10">
      <form onSubmit={handleSubmit} className={cardClass}>
        {/* Cabecera con fondo de perfil + avatar */}
        <div
          className={cn(
            "relative overflow-hidden",
            L ? "border-b border-zinc-200/80" : "border-b border-white/8"
          )}
        >
          <ProfileMenuBanner
            bannerUrl={trimmedBanner || null}
            focusX={bannerFocusX}
            focusY={bannerFocusY}
            accentColor={defaultDept?.accentColor}
            blendToColor={L ? "#fafafa" : "#0d1427"}
            heightClass="h-36 sm:h-44"
          />
          {/* Sutil gradiente decorativo en la esquina sup-derecha para más
              profundidad visual sobre el banner. */}
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full blur-3xl",
              L ? "bg-amber-200/35" : "bg-amber-400/15"
            )}
          />
          <div className="relative px-6 pb-6 pt-0 text-center">
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
          <div className="-mt-12 relative mx-auto inline-flex flex-col items-center gap-2.5">
            {/* Avatar XL puro: sin wrapper de color, sin ring, sin padding.
             *  Solo el avatar. */}
            <button
              type="button"
              onClick={() => trimmedImage && setPreviewOpen(true)}
              disabled={!trimmedImage || uploading}
              title={trimmedImage ? "Ver foto en grande" : "Aún no hay foto"}
              className={cn(
                "group relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffeb66]/55",
                trimmedImage && "cursor-zoom-in"
              )}
            >
              <Avatar
                name={currentUser.name}
                image={trimmedImage || null}
                focusX={imageFocusX}
                focusY={imageFocusY}
                size="xl"
                effect={avatarEffect}
              />
              {/* Badge cámara discreto en la esquina, sin ring de color detrás
               * (el ring del badge antes pintaba un círculo grueso alrededor
               * del propio badge; ahora va sin ring para no añadir sombras). */}
              <span
                aria-hidden
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full transition-transform group-hover:scale-110",
                  L
                    ? "bg-white text-zinc-700 border border-zinc-200"
                    : "bg-[#1a2238] text-white/85 border border-white/10"
                )}
              >
                <Camera className="h-3.5 w-3.5" />
              </span>
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
              "mt-4 text-lg font-semibold tracking-tight",
              L ? "text-zinc-900" : "text-white"
            )}
          >
            {currentUser.name}
          </p>
          <p
            className={cn(
              "mt-0.5 inline-flex items-center justify-center gap-1.5 text-sm",
              L ? "text-zinc-500" : "text-white/45"
            )}
          >
            <Mail className="h-3.5 w-3.5 shrink-0 opacity-80" />
            {currentUser.email}
          </p>

          {/* Pills: departamento(s) + rol */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
            {currentUser.departments.map((d) => (
              <span
                key={d.id}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                  L
                    ? "border border-zinc-200 bg-white text-zinc-700"
                    : "border border-white/10 bg-white/[0.04] text-white/65"
                )}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: d.accentColor }}
                />
                {d.name}
              </span>
            ))}
            {topRole && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1",
                  topRole === "SUPERADMIN"
                    ? L
                      ? "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200"
                      : "bg-fuchsia-500/12 text-fuchsia-200 ring-fuchsia-400/25"
                    : topRole === "ADMIN"
                      ? L
                        ? "bg-amber-50 text-amber-800 ring-amber-200"
                        : "bg-amber-500/12 text-amber-200 ring-amber-400/25"
                      : L
                        ? "bg-zinc-100 text-zinc-700 ring-zinc-200"
                        : "bg-white/[0.06] text-white/65 ring-white/10"
                )}
              >
                <Shield className="h-3 w-3" />
                {ROLE_LABEL[topRole]}
              </span>
            )}
          </div>

          <p
            className={cn(
              "mt-3 inline-flex items-center gap-1 text-[11px]",
              L ? "text-zinc-400" : "text-white/28"
            )}
          >
            <Sparkles className="h-3 w-3 shrink-0" />
            El marco decorativo del avatar se elige en el menú lateral
          </p>
          </div>
        </div>

        {/* Nombre */}
        <div
          className={cn(
            "space-y-3 px-6 pt-5 pb-2",
            L ? "border-t border-zinc-200/80" : "border-t border-white/8"
          )}
        >
          <SectionHeader
            L={L}
            icon={UserIcon}
            tone="violet"
            title="Datos básicos"
            description="Tu nombre visible en toda la app."
          />
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
          <div className="mt-3">
            <Input
              light={L}
              label="Cumpleaños"
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              max="9999-12-31"
            />
            <p
              className={cn(
                "mt-1 text-[11px]",
                L ? "text-zinc-500" : "text-white/40"
              )}
            >
              Aparecerá como capa opcional en el calendario del equipo. Si lo dejas vacío, no se mostrará.
            </p>
          </div>
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
          <SectionHeader
            L={L}
            icon={ImageIcon}
            tone="sky"
            title="Fondo del menú de perfil"
            description="Se muestra en la cabecera de esta página y al abrir tu perfil en el menú lateral."
          />
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
                  "relative flex items-center gap-2.5 overflow-hidden rounded-lg border px-3",
                  USER_ROW_BANNER_HD ? "py-3.5" : "py-2.5",
                  L ? "border-zinc-200" : "border-white/10"
                )}
                style={{
                  backgroundImage: `linear-gradient(90deg, rgba(10,15,30,0.92) 0%, rgba(10,15,30,0.5) 35%, rgba(10,15,30,0.4) 65%, rgba(10,15,30,0.92) 100%), url(${trimmedBanner})`,
                  backgroundRepeat: "no-repeat, no-repeat",
                  backgroundSize: "cover, cover",
                  backgroundPosition: `center, ${bannerFocusX ?? 50}% ${bannerFocusY ?? 50}%`,
                  imageRendering: USER_ROW_BANNER_HD ? "-webkit-optimize-contrast" : "auto",
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
          <SectionHeader
            L={L}
            icon={KeyRound}
            tone="amber"
            title="Contraseña"
            description="Déjala vacía si no quieres cambiarla."
          />

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

          <PasswordRequirements
            L={L}
            password={password}
            password2={password2}
          />
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

      {/* Tarjeta "Modo Datawall": solo visible para cuentas con `kioskMode`
          activo (p. ej. tareas@). Permite cambiar qué sección (Proyectos /
          Bitácora) se muestra en el datawall sin tocar BD ni código. */}
      {currentUser.kioskMode === true && (
        <KioskSettingsCard
          initialSection={
            (currentUser.kioskSection ?? "proyectos") === "bitacora"
              ? "bitacora"
              : "proyectos"
          }
          isLight={L}
        />
      )}

      {/* Tarjeta "Espejado de pantalla": solo para las cuentas del par
          tareas@/abian@ que comparten linkedAccountEmail. Cada navegador
          puede marcarse como Operador (publica URL+scroll) o Datawall
          (sigue al operador en vivo via SSE). */}
      {isMirroringEnabledForEmail(currentUser.email) &&
        currentUser.linkedAccountEmail && (
          <MirrorModeCard
            isLight={L}
            userEmail={currentUser.email}
            linkedAccountEmail={currentUser.linkedAccountEmail}
          />
        )}

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

/* ──────────────────────────────────────────────────────────────
 *  Cabecera consistente para cada sección dentro de Mi cuenta:
 *  icono coloreado + título + descripción.
 * ────────────────────────────────────────────────────────────── */
function SectionHeader({
  L,
  icon: Icon,
  tone,
  title,
  description,
}: {
  L: boolean;
  icon: React.ComponentType<{ className?: string }>;
  tone: "violet" | "sky" | "amber";
  title: string;
  description?: string;
}) {
  const TONE = {
    violet: {
      bgDark: "bg-violet-500/12 text-violet-200 ring-violet-400/25",
      bgLight: "bg-violet-50 text-violet-700 ring-violet-200",
    },
    sky: {
      bgDark: "bg-sky-500/12 text-sky-200 ring-sky-400/25",
      bgLight: "bg-sky-50 text-sky-700 ring-sky-200",
    },
    amber: {
      bgDark: "bg-amber-500/12 text-amber-200 ring-amber-400/25",
      bgLight: "bg-amber-50 text-amber-700 ring-amber-200",
    },
  }[tone];
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1",
          L ? TONE.bgLight : TONE.bgDark
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p
          className={cn(
            "text-sm font-semibold leading-tight",
            L ? "text-zinc-900" : "text-white"
          )}
        >
          {title}
        </p>
        {description && (
          <p
            className={cn(
              "mt-0.5 text-[11.5px] leading-snug",
              L ? "text-zinc-500" : "text-white/45"
            )}
          >
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 *  Lista de requisitos de la contraseña.
 *  Se evalúa en tiempo real conforme el usuario teclea: cuando el
 *  campo está vacío todos aparecen en estado neutro (informativo);
 *  cuando empieza a escribir, los que cumple pasan a verde y los
 *  que no, a rojo. Replica la política de `lib/auth/password-policy`
 *  (longitud, complejidad ≥3 clases, no demasiado común, máximo)
 *  más la coincidencia de confirmación.
 * ────────────────────────────────────────────────────────────── */
function PasswordRequirements({
  L,
  password,
  password2,
}: {
  L: boolean;
  password: string;
  password2: string;
}) {
  const touched = password.length > 0;

  const classes =
    (/[a-z]/.test(password) ? 1 : 0) +
    (/[A-Z]/.test(password) ? 1 : 0) +
    (/\d/.test(password) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(password) ? 1 : 0);

  const checks: { label: React.ReactNode; ok: boolean; show: boolean }[] = [
    {
      label: (
        <>
          Mínimo <strong>{MIN_PASSWORD_LENGTH} caracteres</strong>
        </>
      ),
      ok: password.length >= MIN_PASSWORD_LENGTH,
      show: true,
    },
    {
      label: (
        <>
          Combina al menos <strong>3 de 4 clases</strong>: mayúsculas,
          minúsculas, números y símbolos
        </>
      ),
      ok: classes >= 3,
      show: true,
    },
    {
      label: <>No usar contraseñas comunes (ej. <code>Password1234</code>)</>,
      ok: true,
      show: true,
    },
    {
      label: (
        <>
          Máximo <strong>{MAX_PASSWORD_LENGTH} caracteres</strong>
        </>
      ),
      ok: password.length <= MAX_PASSWORD_LENGTH,
      show: password.length > 200,
    },
    {
      label: <>Las dos contraseñas coinciden</>,
      ok: password.length > 0 && password === password2,
      show: password2.length > 0,
    },
  ];

  return (
    <div
      className={cn(
        "rounded-xl border px-3.5 py-3 text-[12px] leading-snug",
        L
          ? "border-zinc-200/80 bg-zinc-50/60 text-zinc-700"
          : "border-white/8 bg-white/[0.025] text-white/70"
      )}
    >
      <p
        className={cn(
          "mb-1.5 text-[11px] font-semibold uppercase tracking-wider",
          L ? "text-zinc-500" : "text-white/45"
        )}
      >
        Requisitos
      </p>
      <ul className="space-y-1">
        {checks
          .filter((c) => c.show)
          .map((c, i) => {
            const okState = touched ? c.ok : null;
            return (
              <li key={i} className="flex items-start gap-2">
                <span
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-1",
                    okState === true
                      ? L
                        ? "bg-emerald-50 text-emerald-600 ring-emerald-200"
                        : "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30"
                      : okState === false
                        ? L
                          ? "bg-rose-50 text-rose-600 ring-rose-200"
                          : "bg-rose-500/15 text-rose-300 ring-rose-400/30"
                        : L
                          ? "bg-white text-zinc-400 ring-zinc-200"
                          : "bg-white/5 text-white/35 ring-white/10"
                  )}
                >
                  {okState === false ? (
                    <X className="h-2.5 w-2.5" strokeWidth={3} />
                  ) : (
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  )}
                </span>
                <span
                  className={cn(
                    "min-w-0",
                    okState === true && (L ? "text-zinc-700" : "text-white/80"),
                    okState === false && (L ? "text-rose-600" : "text-rose-300")
                  )}
                >
                  {c.label}
                </span>
              </li>
            );
          })}
      </ul>
    </div>
  );
}
