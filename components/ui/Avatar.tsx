import { cn, getInitials } from "@/lib/utils";

interface AvatarProps {
  name: string;
  image?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  presence?: "online" | "away" | "offline";
}

const sizes = {
  xs: "w-6 h-6 text-xs",
  sm: "w-8 h-8 text-xs",
  md: "w-9 h-9 text-sm",
  lg: "w-11 h-11 text-base",
};

const presenceDotSize: Record<string, string> = {
  xs: "w-1.5 h-1.5 border",
  sm: "w-2 h-2 border",
  md: "w-2.5 h-2.5 border-[1.5px]",
  lg: "w-3 h-3 border-2",
};

const presenceColor: Record<string, string> = {
  online: "bg-green-400",
  away: "bg-amber-400",
  offline: "bg-white/25",
};

export function Avatar({ name, image, size = "md", className, presence }: AvatarProps) {
  const initials = getInitials(name);
  const hash = name
    .split("")
    .reduce((acc, c) => (acc + c.charCodeAt(0)) % 360, 0);
  const hue = Math.abs((hash * 47) % 360);

  const presenceDot = presence ? (
    <span
      aria-label={presence === "online" ? "En línea" : presence === "away" ? "Ausente" : "Desconectado"}
      className={cn(
        "absolute bottom-0 right-0 rounded-full border-[#0a0f1e]",
        presenceDotSize[size],
        presenceColor[presence]
      )}
    />
  ) : null;

  if (image) {
    return (
      <span className="relative inline-flex shrink-0">
        {/* URLs de avatar (OAuth / externos): evitamos el optimizador de Next para no configurar remotePatterns por dominio. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- avatares dinámicos; ver nota anterior */}
        <img
          src={image}
          alt={name}
          onError={(e) => { e.currentTarget.style.display = "none"; }}
          className={cn(
            "rounded-full object-cover border border-white/10 shrink-0",
            sizes[size],
            className
          )}
        />
        {presenceDot}
      </span>
    );
  }

  return (
    <span className="relative inline-flex shrink-0">
      <span
        role="img"
        aria-label={name}
        className={cn(
          "rounded-full flex items-center justify-center font-semibold shrink-0 border border-white/10",
          sizes[size],
          className
        )}
        style={{
          background: `hsl(${hue}, 60%, 30%)`,
          color: `hsl(${hue}, 80%, 80%)`,
        }}
        title={name}
      >
        <span aria-hidden="true">{initials}</span>
      </span>
      {presenceDot}
    </span>
  );
}
