import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  if (isToday(d)) return `Hoy, ${format(d, "HH:mm")}`;
  if (isYesterday(d)) return `Ayer, ${format(d, "HH:mm")}`;
  return format(d, "d MMM yyyy, HH:mm", { locale: es });
}

export function formatRelative(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es });
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Normaliza para comparar búsquedas sin depender de mayúsculas ni acentos. */
export function foldAccentInsensitive(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function getCurrentShift(): "MORNING" | "AFTERNOON" | "NIGHT" {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) return "MORNING";
  if (hour >= 14 && hour < 22) return "AFTERNOON";
  return "NIGHT";
}

export const SHIFT_LABELS = {
  MORNING: "Mañana",
  AFTERNOON: "Tarde",
  NIGHT: "Noche",
} as const;

export const TYPE_LABELS = {
  INCIDENCIA: "Incidencia",
  INFORMATIVO: "Informativo",
  URGENTE: "Urgente",
  MANTENIMIENTO: "Mantenimiento",
  SIN_NOVEDADES: "Sin novedades",
} as const;

export const PRIORITY_LABELS = {
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja",
} as const;

export const STATUS_LABELS = {
  ACTIVE: "Activo",
  PAUSED: "Pausado",
  COMPLETED: "Completado",
  ARCHIVED: "Archivado",
} as const;

export const ROLE_LABELS = {
  SUPERADMIN: "Super Admin",
  ADMIN: "Admin",
  OPERATOR: "Operador",
} as const;

export function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    INCIDENCIA: "text-orange-400 bg-orange-400/10 border-orange-400/20",
    INFORMATIVO: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    URGENTE: "text-red-400 bg-red-400/10 border-red-400/20",
    MANTENIMIENTO: "text-purple-400 bg-purple-400/10 border-purple-400/20",
    SIN_NOVEDADES: "text-green-400 bg-green-400/10 border-green-400/20",
  };
  return colors[type] || "text-gray-400 bg-gray-400/10 border-gray-400/20";
}

export function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    HIGH: "text-red-400 bg-red-400/10 border-red-400/20",
    MEDIUM: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
    LOW: "text-green-400 bg-green-400/10 border-green-400/20",
  };
  return colors[priority] || "text-gray-400 bg-gray-400/10 border-gray-400/20";
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    ACTIVE: "text-green-400 bg-green-400/10 border-green-400/20",
    PAUSED: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
    COMPLETED: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    ARCHIVED: "text-gray-400 bg-gray-400/10 border-gray-400/20",
  };
  return colors[status] || "text-gray-400 bg-gray-400/10 border-gray-400/20";
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export function getCompletedColumnCount(
  columns: { name: string; order: number; tasks: { id: string }[] }[]
): number {
  const byName = columns.find(
    (c) =>
      c.name.toLowerCase() === "completado" ||
      c.name.toLowerCase() === "done"
  );
  if (byName) return byName.tasks.length;
  const sorted = [...columns].sort((a, b) => b.order - a.order);
  return sorted[0]?.tasks.length ?? 0;
}
