/**
 * Tipos compartidos del módulo "Técnicos de Sala".
 *
 * - DTOs que viajan entre API y cliente (sin campos sensibles tipo
 *   `createdById` raw — devolvemos el `createdBy` poblado).
 * - Mapas de etiquetas para mostrar en la UI (categorías, estados…).
 *
 * Convención: los DTOs serializan `Date` como ISO string para que el JSON
 * sea estable y el cliente pueda hacer `new Date(...)` cuando lo necesite.
 */

import type {
  ItemCategory,
  ItemStatus,
  LoanStatus,
  IncidentSeverity,
  IncidentStatus,
} from "@/app/generated/prisma/enums";

// ── Etiquetas ──────────────────────────────────────────────────────────────

export const ITEM_CATEGORY_LABEL: Record<ItemCategory, string> = {
  PORTATIL:    "Portátil",
  PERIFERICO:  "Periférico",
  CABLE:       "Cable",
  DISCO:       "Disco",
  HERRAMIENTA: "Herramienta",
  RED:         "Red",
  SERVIDOR:    "Servidor",
  RACK:        "Rack",
  AUDIO_VIDEO: "Audio/Vídeo",
  IMPRESORA:   "Impresora",
  OTRO:        "Otro",
};

export const ITEM_STATUS_LABEL: Record<ItemStatus, string> = {
  AVAILABLE: "Disponible",
  LOANED:    "Prestado",
  IN_REPAIR: "En reparación",
  RETIRED:   "De baja",
  LOST:      "Perdido",
};

export const LOAN_STATUS_LABEL: Record<LoanStatus, string> = {
  ACTIVE:   "En préstamo",
  RETURNED: "Devuelto",
  OVERDUE:  "Retrasado",
  LOST:     "Perdido",
  DAMAGED:  "Dañado",
};

export const INCIDENT_SEVERITY_LABEL: Record<IncidentSeverity, string> = {
  LOW:      "Baja",
  MEDIUM:   "Media",
  HIGH:     "Alta",
  CRITICAL: "Crítica",
};

export const INCIDENT_STATUS_LABEL: Record<IncidentStatus, string> = {
  OPEN:        "Abierta",
  IN_PROGRESS: "En curso",
  RESOLVED:    "Resuelta",
  CLOSED:      "Cerrada",
  CANCELLED:   "Cancelada",
};

// ── Ordenamiento (para columnas de kanban / filtros por defecto) ────────────

export const INCIDENT_STATUS_ORDER: IncidentStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
  "CANCELLED",
];

export const INCIDENT_SEVERITY_ORDER: IncidentSeverity[] = [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
];

export const ITEM_CATEGORY_ORDER: ItemCategory[] = [
  "PORTATIL",
  "PERIFERICO",
  "CABLE",
  "DISCO",
  "HERRAMIENTA",
  "RED",
  "SERVIDOR",
  "RACK",
  "AUDIO_VIDEO",
  "IMPRESORA",
  "OTRO",
];

// ── DTOs ────────────────────────────────────────────────────────────────────

export interface UserMini {
  id: string;
  name: string;
  image: string | null;
}

export interface ItemDTO {
  id: string;
  name: string;
  code: string | null;
  category: ItemCategory;
  brand: string | null;
  model: string | null;
  serial: string | null;
  location: string | null;
  notes: string | null;
  status: ItemStatus;
  loanable: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: UserMini;
  /** Préstamo activo, si lo hay (snapshot ligero — pensado para listas). */
  activeLoan?: {
    id: string;
    borrowerLabel: string; // user.name o borrowerName
    lentAt: string;
    dueAt: string | null;
  } | null;
  /** Número de incidencias abiertas o en curso. */
  openIncidentsCount?: number;
}

export interface LoanDTO {
  id: string;
  item: {
    id: string;
    name: string;
    code: string | null;
    category: ItemCategory;
  };
  borrowerUser: UserMini | null;
  borrowerName: string | null;
  lender: UserMini;
  lentAt: string;
  dueAt: string | null;
  returnedAt: string | null;
  notes: string | null;
  returnNotes: string | null;
  status: LoanStatus;
  /**
   * `true` si está activo y dueAt < now(). Calculado en el servidor para
   * que el cliente no tenga que re-evaluar cada render.
   */
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentCommentDTO {
  id: string;
  body: string;
  author: UserMini;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface IncidentAttachmentDTO {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedBy: UserMini;
  createdAt: string;
}

export interface IncidentDTO {
  id: string;
  item: {
    id: string;
    name: string;
    code: string | null;
    category: ItemCategory;
  } | null;
  itemDescription: string | null;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  reportedBy: UserMini;
  assignedTo: UserMini | null;
  resolvedAt: string | null;
  closedAt: string | null;
  resolutionNotes: string | null;
  createdAt: string;
  updatedAt: string;
  commentsCount: number;
  attachmentsCount: number;
  /** Solo en detalle: comentarios + adjuntos completos. */
  comments?: IncidentCommentDTO[];
  attachments?: IncidentAttachmentDTO[];
}
