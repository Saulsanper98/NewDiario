"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  ImageIcon,
  LogOut,
  Pencil,
  Sparkles,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { AvatarImagePreview } from "@/components/ui/AvatarImagePreview";
import { AvatarFrameGrid } from "@/components/ui/AvatarFramePicker";
import { ProfileBannerFields } from "@/components/profile/ProfileBannerFields";
import type { SessionUser } from "@/lib/auth/types";
import type { AvatarFrameEffect } from "@/lib/avatar-frame";
import { avatarFrameLabel } from "@/lib/avatar-frame";
import { ProfileMenuBanner } from "@/components/ui/ProfileMenuBanner";
import { ROLE_LABELS, cn } from "@/lib/utils";

interface SidebarProfileMenuProps {
  user: SessionUser;
  isAdmin: boolean;
  isExpanded: boolean;
  isLight: boolean;
  avatarEffect: AvatarFrameEffect;
  onAvatarEffectChange: (effect: AvatarFrameEffect) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signingOut: boolean;
  onSignOut: () => void;
}

export function SidebarProfileMenu({
  user,
  isAdmin,
  isExpanded,
  isLight,
  avatarEffect,
  onAvatarEffectChange,
  open,
  onOpenChange,
  signingOut,
  onSignOut,
}: SidebarProfileMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [framesOpen, setFramesOpen] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [bannerDraft, setBannerDraft] = useState(user.profileBanner ?? "");

  const activeDept = user.departments.find((d) => d.id === user.activeDepartmentId);
  const bannerColor = activeDept?.accentColor ?? "#ffeb66";
  const profileHref = "/configuracion";

  useEffect(() => {
    setBannerDraft(user.profileBanner ?? "");
  }, [user.profileBanner]);

  useEffect(() => {
    if (!open) {
      setFramesOpen(false);
      setBannerOpen(false);
      return;
    }
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  const menuItemClass = cn(
    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
    isLight
      ? "text-zinc-700 hover:bg-zinc-900/[0.06] hover:text-zinc-900"
      : "text-white/80 hover:bg-white/[0.08] hover:text-white"
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Menú de perfil"
        title="Perfil"
        className={cn(
          "flex w-full items-center rounded-lg transition-colors",
          isExpanded ? "gap-2.5 px-1 py-1.5" : "justify-center py-1.5",
          open
            ? isLight
              ? "bg-zinc-100"
              : "bg-white/[0.08]"
            : isLight
              ? "hover:bg-zinc-100/80"
              : "hover:bg-white/[0.06]"
        )}
      >
        <Avatar
          name={user.name}
          image={user.image}
          size="sm"
          effect={avatarEffect}
        />
        {isExpanded && (
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-xs font-semibold text-white">
              {user.name}
            </p>
            <p className="truncate text-[10px] text-white/40">{user.email}</p>
          </div>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Perfil"
          className={cn(
            "absolute bottom-full z-[60] mb-2 overflow-hidden rounded-xl border shadow-2xl backdrop-blur-md",
            isExpanded ? "left-0 right-0 w-full min-w-[15.5rem]" : "left-0 w-[17.5rem]",
            isLight
              ? "border-zinc-200/90 bg-[#f4f4f5] shadow-[0_12px_40px_rgba(15,23,42,0.15)]"
              : "border-white/10 bg-[#0d1427]/98 shadow-[0_16px_48px_rgba(0,0,0,0.55)]"
          )}
        >
          <ProfileMenuBanner
            bannerUrl={bannerDraft || user.profileBanner}
            accentColor={bannerColor}
          />
          <div className="relative px-3 pb-1">
            <div className="-mt-7 mb-2 flex items-end justify-between gap-2">
              <button
                type="button"
                onClick={() => user.image && setPreviewOpen(true)}
                disabled={!user.image}
                title={user.image ? "Ver foto" : undefined}
                className={cn(
                  "rounded-full ring-4 focus:outline-none focus-visible:ring-[#ffeb66]/50",
                  isLight ? "ring-[#f4f4f5]" : "ring-[#0d1427]",
                  user.image ? "cursor-zoom-in" : "cursor-default"
                )}
              >
                <Avatar
                  name={user.name}
                  image={user.image}
                  size="lg"
                  effect={avatarEffect}
                />
              </button>
            </div>
            <p
              className={cn(
                "truncate text-sm font-bold leading-tight",
                isLight ? "text-zinc-900" : "text-white"
              )}
            >
              {user.name}
            </p>
            <p
              className={cn(
                "truncate text-xs",
                isLight ? "text-zinc-500" : "text-white/45"
              )}
            >
              {user.email}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  isLight
                    ? "bg-zinc-200/80 text-zinc-600"
                    : "bg-white/10 text-white/55"
                )}
              >
                {ROLE_LABELS[user.role]}
              </span>
              {activeDept && (
                <span
                  className={cn(
                    "flex max-w-full items-center gap-1 truncate text-[10px]",
                    isLight ? "text-zinc-500" : "text-white/40"
                  )}
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: activeDept.accentColor }}
                  />
                  {activeDept.name}
                </span>
              )}
            </div>
          </div>

          <div
            className={cn(
              "mx-2 mb-2 space-y-0.5 rounded-lg p-1",
              isLight ? "bg-white/80" : "bg-black/20"
            )}
          >
            <Link
              href={profileHref}
              onClick={() => onOpenChange(false)}
              className={menuItemClass}
            >
              <Pencil className="h-4 w-4 shrink-0 opacity-70" />
              <span className="flex-1">
                {isAdmin ? "Configuración" : "Editar perfil"}
              </span>
            </Link>

            <button
              type="button"
              onClick={() => {
                setBannerOpen((o) => !o);
                setFramesOpen(false);
              }}
              aria-expanded={bannerOpen}
              className={menuItemClass}
            >
              <ImageIcon className="h-4 w-4 shrink-0 opacity-70" />
              <span className="flex-1 text-left">Cambiar fondo del perfil</span>
              <ChevronRight
                className={cn(
                  "h-4 w-4 shrink-0 opacity-50 transition-transform",
                  bannerOpen && "rotate-90"
                )}
              />
            </button>

            {bannerOpen && (
              <div
                className={cn(
                  "rounded-lg border p-2",
                  isLight ? "border-zinc-200/80 bg-zinc-50" : "border-white/8 bg-white/[0.03]"
                )}
              >
                <ProfileBannerFields
                  userId={user.id}
                  value={bannerDraft}
                  onChange={setBannerDraft}
                  isLight={isLight}
                  compact
                />
              </div>
            )}

            {user.image && (
              <button
                type="button"
                onClick={() => {
                  setPreviewOpen(true);
                  onOpenChange(false);
                }}
                className={menuItemClass}
              >
                <ImageIcon className="h-4 w-4 shrink-0 opacity-70" />
                <span className="flex-1">Ver foto de perfil</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setFramesOpen((o) => !o);
                setBannerOpen(false);
              }}
              aria-expanded={framesOpen}
              className={menuItemClass}
            >
              <Sparkles className="h-4 w-4 shrink-0 opacity-70" />
              <span className="flex-1 truncate">
                Marco: {avatarFrameLabel(avatarEffect)}
              </span>
              <ChevronRight
                className={cn(
                  "h-4 w-4 shrink-0 opacity-50 transition-transform",
                  framesOpen && "rotate-90"
                )}
              />
            </button>

            {framesOpen && (
              <div
                className={cn(
                  "rounded-lg border p-2",
                  isLight ? "border-zinc-200/80 bg-zinc-50" : "border-white/8 bg-white/[0.03]"
                )}
              >
                <AvatarFrameGrid
                  isLight={isLight}
                  value={avatarEffect}
                  onSelect={(effect) => {
                    onAvatarEffectChange(effect);
                    setFramesOpen(false);
                  }}
                />
              </div>
            )}

            <button
              type="button"
              disabled={signingOut}
              onClick={() => {
                onOpenChange(false);
                onSignOut();
              }}
              className={cn(
                menuItemClass,
                "text-red-400 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
              )}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span className="flex-1">Cerrar sesión</span>
            </button>
          </div>
        </div>
      )}

      <AvatarImagePreview
        open={previewOpen}
        name={user.name}
        imageUrl={user.image ?? null}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}
