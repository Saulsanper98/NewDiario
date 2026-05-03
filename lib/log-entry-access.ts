import type { SessionUser } from "@/lib/auth/types";

export type LogEntryAccessShape = {
  departmentId: string;
  shares: { departmentId: string }[];
};

/** Misma regla que en rutas API de bitácora: dept propio o compartido. */
export function canAccessLogEntry(
  user: SessionUser,
  entry: LogEntryAccessShape
): boolean {
  return (
    user.role === "SUPERADMIN" ||
    user.departments.some((d) => d.id === entry.departmentId) ||
    entry.shares.some((s) => user.departments.some((d) => d.id === s.departmentId))
  );
}
