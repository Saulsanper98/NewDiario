"use client";


import { isLightTheme } from "@/lib/theme";
import { Modal } from "@/components/ui/Modal";
import { useTheme } from "@/components/layout/ThemeProvider";
import { cn } from "@/lib/utils";

interface AvatarImagePreviewProps {
  open: boolean;
  name: string;
  imageUrl: string | null;
  onClose: () => void;
}

/** Vista ampliada de la foto de perfil (avatar). */
export function AvatarImagePreview({
  open,
  name,
  imageUrl,
  onClose,
}: AvatarImagePreviewProps) {
  const { theme } = useTheme();
  const L = isLightTheme(theme);

  return (
    <Modal
      open={open && !!imageUrl}
      onClose={onClose}
      title={name}
      description="Foto de perfil"
      size="md"
    >
      {imageUrl && (
        <div className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={`Foto de ${name}`}
            className={cn(
              "max-h-[min(70vh,520px)] w-full rounded-xl object-contain",
              L ? "bg-zinc-100 ring-1 ring-zinc-200/90" : "bg-black/30 ring-1 ring-white/10"
            )}
          />
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "text-xs font-medium underline-offset-2 hover:underline",
              L ? "text-zinc-600 hover:text-zinc-900" : "text-white/45 hover:text-white/75"
            )}
          >
            Abrir imagen en tamaño completo
          </a>
        </div>
      )}
    </Modal>
  );
}
