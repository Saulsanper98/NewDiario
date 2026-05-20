"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Copy, Loader2, Mail } from "lucide-react";
import toast from "react-hot-toast";
import { Avatar } from "@/components/ui/Avatar";
import { AvatarImagePreview } from "@/components/ui/AvatarImagePreview";
import { ProfileMenuBanner } from "@/components/ui/ProfileMenuBanner";
import { useAvatarFrameEffect } from "@/lib/hooks/useAvatarFrameEffect";
import type { PublicUserProfile } from "@/lib/types/public-user-profile";
import { ROLE_LABELS, cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";

const PANEL_W = 300;

interface UserProfilePopoverProps {
  userId: string;
  name: string;
  email?: string | null;
  image?: string | null;
  profileBanner?: string | null;
  children?: ReactNode;
  className?: string;
  nameClassName?: string;
}

export function UserProfilePopover({
  userId,
  name,
  email,
  image,
  profileBanner,
  children,
  className,
  nameClassName,
}: UserProfilePopoverProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const avatarEffect = useAvatarFrameEffect();
  const cardBg = isLight ? "#f4f4f5" : "#0d1427";
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null
  );
  const [avatarPreview, setAvatarPreview] = useState(false);
  const [bannerPreview, setBannerPreview] = useState(false);
  const panelId = useId();
  const hasCustomTrigger = children != null;

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${userId}/profile`);
      if (!res.ok) throw new Error("No se pudo cargar el perfil");
      const data = (await res.json()) as PublicUserProfile;
      setProfile(data);
    } catch {
      setProfile({
        id: userId,
        name,
        email: email ?? "",
        image: image ?? null,
        imageFocusX: null,
        imageFocusY: null,
        profileBanner: profileBanner ?? null,
        bannerFocusX: null,
        bannerFocusY: null,
        role: "OPERATOR",
        departmentName: null,
        departmentAccent: null,
      });
    } finally {
      setLoading(false);
    }
  }, [userId, name, email, image, profileBanner]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    function place() {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const panelW = panel?.offsetWidth ?? PANEL_W;
      const panelH = panel?.offsetHeight ?? 240;
      const gap = 10;
      const margin = 16;

      let top = rect.bottom + gap;
      let left = rect.left + rect.width / 2 - panelW / 2;

      if (top + panelH > window.innerHeight - margin) {
        top = rect.top - panelH - gap;
      }
      if (left + panelW > window.innerWidth - margin) {
        left = window.innerWidth - panelW - margin;
      }
      if (left < margin) left = margin;
      if (top < margin) top = margin;

      setPosition({ top, left });
    }

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, loading, profile]);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    setProfile(null);
    void loadProfile();
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, [open, loadProfile]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const display = profile ?? {
    id: userId,
    name,
    email: email ?? "",
    image: image ?? null,
    imageFocusX: null as number | null,
    imageFocusY: null as number | null,
    profileBanner: profileBanner ?? null,
    bannerFocusX: null as number | null,
    bannerFocusY: null as number | null,
    role: "OPERATOR" as const,
    departmentName: null,
    departmentAccent: null,
  };

  const accent = display.departmentAccent ?? "#ffeb66";
  const canPreview = Boolean(display.image || display.profileBanner);

  async function copyEmail() {
    if (!display.email) return;
    try {
      await navigator.clipboard.writeText(display.email);
      toast.success("Correo copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  const panel = open && position && (
    <div
      ref={panelRef}
      id={panelId}
      role="dialog"
      aria-label={`Perfil de ${display.name}`}
      style={{ top: position.top, left: position.left, width: PANEL_W }}
      className={cn(
        "fixed z-[200] overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl transition-all duration-200 ease-out",
        visible ? "scale-100 opacity-100" : "scale-[0.97] opacity-0",
        isLight
          ? "border-zinc-200/90 bg-[#f4f4f5]/98 shadow-zinc-400/20"
          : "border-white/12 bg-[#0d1427]/98 shadow-[0_20px_50px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,235,102,0.06)]"
      )}
    >
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2
            className={cn(
              "h-6 w-6 animate-spin",
              isLight ? "text-zinc-400" : "text-white/40"
            )}
          />
        </div>
      ) : (
        <>
          {(() => {
            // Si el banner es exactamente la misma URL que la foto del avatar,
            // mostrar solo el degradado decorativo para evitar el efecto de
            // "foto continua" detrás del avatar.
            const effectiveBanner =
              display.profileBanner && display.profileBanner !== display.image
                ? display.profileBanner
                : null;
            return (
              <button
                type="button"
                className={cn(
                  "group/banner relative block w-full text-left",
                  effectiveBanner && "cursor-zoom-in"
                )}
                disabled={!effectiveBanner}
                onClick={() => effectiveBanner && setBannerPreview(true)}
                title={effectiveBanner ? "Ver fondo de perfil" : undefined}
              >
                <ProfileMenuBanner
                  bannerUrl={effectiveBanner}
                  focusX={display.bannerFocusX}
                  focusY={display.bannerFocusY}
                  accentColor={accent}
                  blendToColor={cardBg}
                  heightClass="h-[4.5rem]"
                />
                {effectiveBanner && (
                  <span className="absolute bottom-2 right-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[9px] font-medium text-white/80 opacity-0 transition-opacity group-hover/banner:opacity-100">
                    Ampliar
                  </span>
                )}
              </button>
            );
          })()}

          <div className="relative px-4 pb-4 pt-0">
            <div className="-mt-9 mb-3 flex items-end justify-between gap-2">
              <button
                type="button"
                disabled={!display.image}
                onClick={() => display.image && setAvatarPreview(true)}
                title={display.image ? "Ver foto de perfil" : undefined}
                className={cn(
                  "group/avatar relative rounded-full ring-[3px] transition-transform hover:scale-[1.02] focus:outline-none focus-visible:ring-[#ffeb66]/60",
                  isLight ? "ring-[#f4f4f5]" : "ring-[#0d1427]",
                  display.image ? "cursor-zoom-in" : "cursor-default"
                )}
                style={{
                  // Solo sombra suave simetrica. No anadir un anillo de color
                  // de departamento porque cuando el avatar ya lleva su propio
                  // efecto de marco se ve como una linea extra detras.
                  boxShadow: "0 0 18px rgba(0,0,0,0.5)",
                }}
              >
                <Avatar
                  name={display.name}
                  image={display.image}
                  focusX={display.imageFocusX}
                  focusY={display.imageFocusY}
                  size="xl"
                  effect={avatarEffect}
                />
              </button>
            </div>

            <h3
              className={cn(
                "text-base font-bold leading-tight tracking-tight",
                isLight ? "text-zinc-900" : "text-white"
              )}
            >
              {display.name}
            </h3>

            {display.email ? (
              <div className="mt-1 flex min-w-0 items-center gap-1">
                <a
                  href={`mailto:${display.email}`}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-1 truncate text-xs transition-colors",
                    isLight
                      ? "text-zinc-500 hover:text-zinc-800"
                      : "text-white/50 hover:text-white/75"
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Mail className="h-3 w-3 shrink-0 opacity-60" />
                  <span className="truncate">{display.email}</span>
                </a>
                <button
                  type="button"
                  title="Copiar correo"
                  onClick={(e) => {
                    e.stopPropagation();
                    void copyEmail();
                  }}
                  className={cn(
                    "shrink-0 rounded p-1 transition-colors",
                    isLight
                      ? "text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
                      : "text-white/35 hover:bg-white/10 hover:text-white/70"
                  )}
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            ) : null}

            <div
              className={cn(
                "mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3",
                isLight ? "border-zinc-200/80" : "border-white/8"
              )}
            >
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  isLight
                    ? "bg-amber-100/80 text-amber-900"
                    : "bg-[#ffeb66]/12 text-[#ffeb66] border border-[#ffeb66]/20"
                )}
              >
                {ROLE_LABELS[display.role]}
              </span>
              {display.departmentName ? (
                <span
                  className={cn(
                    "inline-flex max-w-full items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium",
                    isLight
                      ? "bg-zinc-100 text-zinc-600"
                      : "bg-white/6 text-white/45"
                  )}
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: accent }}
                  />
                  <span className="truncate">{display.departmentName}</span>
                </span>
              ) : null}
            </div>

            {canPreview && (
              <p
                className={cn(
                  "mt-2.5 text-center text-[10px]",
                  isLight ? "text-zinc-400" : "text-white/28"
                )}
              >
                Pulsa la foto o el fondo para verlos en grande
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? panelId : undefined}
        className={cn(
          hasCustomTrigger
            ? "flex max-w-full items-center gap-3 rounded-lg text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffeb66]/45"
            : "inline max-w-full truncate text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffeb66]/40 rounded-sm hover:underline",
          hasCustomTrigger &&
            (isLight
              ? "hover:bg-zinc-100/80"
              : "hover:bg-white/[0.05]"),
          open &&
            !hasCustomTrigger &&
            (isLight ? "text-zinc-900" : "text-[#ffeb66]"),
          nameClassName,
          className
        )}
      >
        {children ?? name}
      </button>

      {typeof document !== "undefined" && panel
        ? createPortal(panel, document.body)
        : null}

      <AvatarImagePreview
        open={avatarPreview}
        name={display.name}
        imageUrl={display.image}
        onClose={() => setAvatarPreview(false)}
      />
      <AvatarImagePreview
        open={bannerPreview}
        name={display.name}
        imageUrl={display.profileBanner}
        onClose={() => setBannerPreview(false)}
      />
    </>
  );
}
