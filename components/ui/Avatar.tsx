import { cn, getInitials } from "@/lib/utils";

interface AvatarProps {
  name: string;
  image?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  xs: "w-6 h-6 text-xs",
  sm: "w-8 h-8 text-xs",
  md: "w-9 h-9 text-sm",
  lg: "w-11 h-11 text-base",
};

export function Avatar({ name, image, size = "md", className }: AvatarProps) {
  const initials = getInitials(name);
  const hash = name
    .split("")
    .reduce((acc, c) => (acc + c.charCodeAt(0)) % 360, 0);
  const hue = Math.abs((hash * 47) % 360);

  if (image) {
    return (
      // URLs de avatar (OAuth / externos): evitamos el optimizador de Next para no configurar remotePatterns por dominio.
      // eslint-disable-next-line @next/next/no-img-element -- avatares dinámicos; ver nota anterior
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
    );
  }

  return (
    <div
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
      {initials}
    </div>
  );
}
