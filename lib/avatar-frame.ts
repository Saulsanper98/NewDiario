export const AVATAR_FRAME_STORAGE_KEY = "cc-ops-avatar-effect";

export type AvatarFrameEffect =
  | "none"
  | "slate"
  | "gold"
  | "emerald"
  | "ruby"
  | "ocean"
  | "violet"
  | "prism"
  | "orbit"
  | "pulse"
  | "double"
  | "sunset"
  | "mint"
  | "chrome"
  | "rose"
  | "copper"
  | "fire"
  | "aurora"
  | "shimmer"
  | "cyber";

/** Anillo animado detrás de la foto (solo gira el borde, no el avatar). */
export const AVATAR_FRAME_RING_LAYERS: Partial<
  Record<AvatarFrameEffect, string>
> = {
  prism: "avatar-frame-prism-ring",
  fire: "avatar-frame-fire-ring",
  aurora: "avatar-frame-aurora-ring",
};

/** Destello encima del anillo (órbita, brillo). */
export const AVATAR_FRAME_OVERLAY_LAYERS: Partial<
  Record<AvatarFrameEffect, string>
> = {
  orbit: "avatar-frame-orbit-layer",
  shimmer: "avatar-frame-shimmer-layer",
};

export const AVATAR_FRAME_EFFECTS: {
  value: AvatarFrameEffect;
  label: string;
}[] = [
  { value: "none", label: "Sin marco" },
  { value: "slate", label: "Plata" },
  { value: "gold", label: "Oro" },
  { value: "emerald", label: "Esmeralda" },
  { value: "ruby", label: "Rubí" },
  { value: "ocean", label: "Océano" },
  { value: "violet", label: "Violeta" },
  { value: "prism", label: "Prisma" },
  { value: "orbit", label: "Órbita" },
  { value: "pulse", label: "Pulso" },
  { value: "double", label: "Doble" },
  { value: "sunset", label: "Atardecer" },
  { value: "mint", label: "Menta" },
  { value: "chrome", label: "Cromo" },
  { value: "rose", label: "Rosa" },
  { value: "copper", label: "Cobre" },
  { value: "fire", label: "Fuego" },
  { value: "aurora", label: "Aurora" },
  { value: "shimmer", label: "Brillo" },
  { value: "cyber", label: "Ciber" },
];

const VALID = new Set(AVATAR_FRAME_EFFECTS.map((e) => e.value));

/** Migra valores antiguos del localStorage. */
const LEGACY_MAP: Record<string, AvatarFrameEffect> = {
  thin: "slate",
  spark: "orbit",
  neon: "pulse",
};

export function parseAvatarFrameEffect(raw: string | null): AvatarFrameEffect {
  if (!raw) return "gold";
  if (LEGACY_MAP[raw]) return LEGACY_MAP[raw];
  if (VALID.has(raw as AvatarFrameEffect)) return raw as AvatarFrameEffect;
  return "gold";
}

export function avatarFrameLabel(effect: AvatarFrameEffect): string {
  return AVATAR_FRAME_EFFECTS.find((e) => e.value === effect)?.label ?? "Sin marco";
}

/** Clase CSS del marco; una sola fuente para Avatar y miniaturas. */
export function avatarFrameClass(effect: AvatarFrameEffect): string | null {
  if (effect === "none") return null;
  return `avatar-frame-${effect}`;
}

/** Marcos que usan anillo con gradiente (wrapper + padding). */
export const AVATAR_FRAME_GRADIENT_RING = new Set<AvatarFrameEffect>([
  "ocean",
  "prism",
  "sunset",
  "chrome",
  "fire",
  "aurora",
]);

export type AvatarFrameSize = "xs" | "sm" | "md" | "lg" | "xl";

const FRAME_PAD: Record<AvatarFrameSize, string> = {
  xs: "p-[1.5px]",
  sm: "p-[2px]",
  md: "p-[2px]",
  lg: "p-[2.5px]",
  xl: "p-[3px]",
};

const FRAME_PAD_GRADIENT: Record<AvatarFrameSize, string> = {
  xs: "p-[2px]",
  sm: "p-[2.5px]",
  md: "p-[2.5px]",
  lg: "p-[3px]",
  xl: "p-[3.5px]",
};

export function avatarFramePadding(
  effect: AvatarFrameEffect,
  size: AvatarFrameSize
): string | null {
  if (effect === "none") return null;
  return AVATAR_FRAME_GRADIENT_RING.has(effect)
    ? FRAME_PAD_GRADIENT[size]
    : FRAME_PAD[size];
}
