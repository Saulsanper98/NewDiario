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
import { Loader2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { AvatarImagePreview } from "@/components/ui/AvatarImagePreview";
import { ProfileMenuBanner } from "@/components/ui/ProfileMenuBanner";
import type { PublicUserProfile } from "@/lib/types/public-user-profile";
import { ROLE_LABELS, cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";

interface UserProfilePopoverProps {
  userId: string;
  name: string;
  email?: string | null;
  image?: string | null;
  profileBanner?: string | null;
  children?: ReactNode;
  className?: string;
  /** Estilos del botón cuando no hay children */
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null
  );
  const [avatarPreview, setAvatarPreview] = useState(false);
  const [bannerPreview, setBannerPreview] = useState(false);
  const panelId = useId();

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
        profileBanner: profileBanner ?? null,
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
      const panelW = panel?.offsetWidth ?? 280;
      const panelH = panel?.offsetHeight ?? 220;
      const gap = 8;
      const margin = 12;

      let top = rect.bottom + gap;
      let left = rect.left;

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
    if (!open) return;
    setProfile(null);
    void loadProfile();
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
    profileBanner: profileBanner ?? null,
    role: "OPERATOR" as const,
    departmentName: null,
    departmentAccent: null,
  };

  const accent = display.departmentAccent ?? "#ffeb66";

  const panel = open && position && (
    <div
      ref={panelRef}
      id={panelId}
      role="dialog"
      aria-label={`Perfil de ${display.name}`}
      style={{ top: position.top, left: position.left }}
      className={cn(
        "fixed z-[200] w-[min(17.5rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border shadow-2xl backdrop-blur-md",
        isLight
          ? "border-zinc-200/90 bg-[#f4f4f5]"
          : "border-white/10 bg-[#0d1427]/98"
      )}
    >
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2
            className={cn(
              "h-6 w-6 animate-spin",
              isLight ? "text-zinc-400" : "text-white/40"
            )}
          />
        </div>
      ) : (
        <>
          <button
            type="button"
            className="block w-full text-left"
            disabled={!display.profileBanner}
            onClick={() => display.profileBanner && setBannerPreview(true)}
            title={display.profileBanner ? "Ver fondo" : undefined}
          >
            <ProfileMenuBanner
              bannerUrl={display.profileBanner}
              accentColor={accent}
            />
          </button>
          <div className="relative px-3 pb-3">
            <div className="-mt-7 mb-2">
              <button
                type="button"
                disabled={!display.image}
                onClick={() => display.image && setAvatarPreview(true)}
                title={display.image ? "Ver foto de perfil" : undefined}
                className={cn(
                  "rounded-full ring-4 focus:outline-none focus-visible:ring-[#ffeb66]/50",
                  isLight ? "ring-[#f4f4f5]" : "ring-[#0d1427]",
                  display.image ? "cursor-zoom-in" : "cursor-default"
                )}
              >
                <Avatar name={display.name} image={display.image} size="lg" />
              </button>
            </div>
            <p
              className={cn(
                "truncate text-sm font-bold",
                isLight ? "text-zinc-900" : "text-white"
              )}
            >
              {display.name}
            </p>
            {display.email ? (
              <p
                className={cn(
                  "truncate text-xs",
                  isLight ? "text-zinc-500" : "text-white/45"
                )}
              >
                {display.email}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  isLight
                    ? "bg-zinc-200/80 text-zinc-600"
                    : "bg-white/10 text-white/55"
                )}
              >
                {ROLE_LABELS[display.role]}
              </span>
              {display.departmentName ? (
                <span
                  className={cn(
                    "flex items-center gap-1 text-[10px]",
                    isLight ? "text-zinc-500" : "text-white/40"
                  )}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: accent }}
                  />
                  {display.departmentName}
                </span>
              ) : null}
            </div>
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
          "inline max-w-full truncate text-left transition-colors",
          "hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffeb66]/40 rounded-sm",
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
