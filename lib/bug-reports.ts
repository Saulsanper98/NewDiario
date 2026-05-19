import type { SessionUser } from "@/lib/auth/types";
import type { BugReportPriority, BugReportStatus } from "@/app/generated/prisma/enums";

/** Email del único usuario que gestiona reportes (panel /bugs). */
export const BUG_REPORTS_ADMIN_EMAIL =
  (process.env.BUG_REPORTS_ADMIN_EMAIL ?? "saul@movilidadgc.org").toLowerCase().trim();

export function isBugReportsAdmin(user: SessionUser): boolean {
  return user.email.toLowerCase().trim() === BUG_REPORTS_ADMIN_EMAIL;
}

export const BUG_REPORT_STATUS_LABELS: Record<BugReportStatus, string> = {
  OPEN: "Abierto",
  IN_PROGRESS: "En curso",
  RESOLVED: "Resuelto",
  WONT_FIX: "No procede",
};

export const BUG_REPORT_PRIORITY_LABELS: Record<BugReportPriority, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
};
