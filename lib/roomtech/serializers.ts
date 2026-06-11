/**
 * Serializadores Prisma → DTO para el módulo Técnicos de Sala.
 *
 * Centralizamos aquí la traducción entre los modelos crudos que devuelve
 * Prisma (con `Date` reales y FKs) y los DTOs que viajan al cliente
 * (con fechas ISO + relaciones aplanadas). Cualquier endpoint del módulo
 * debe pasar por estos serializadores: así garantizamos que la forma de
 * los datos sea consistente en toda la app.
 */

import type {
  Item,
  Loan,
  EquipmentIncident,
  EquipmentIncidentComment,
  EquipmentIncidentAttachment,
  User,
} from "@/app/generated/prisma/client";
import type {
  ItemDTO,
  LoanDTO,
  IncidentDTO,
  IncidentCommentDTO,
  IncidentAttachmentDTO,
  UserMini,
} from "@/lib/types/roomtech";

type UserPick = Pick<User, "id" | "name" | "image">;

function toUserMini(u: UserPick | null | undefined): UserMini | null {
  if (!u) return null;
  return { id: u.id, name: u.name, image: u.image ?? null };
}

function toUserMiniRequired(u: UserPick): UserMini {
  return { id: u.id, name: u.name, image: u.image ?? null };
}

// ── Item ────────────────────────────────────────────────────────────────────

interface ItemWithRelations extends Item {
  createdBy: UserPick;
  loans?: (Pick<Loan, "id" | "lentAt" | "dueAt" | "borrowerName" | "status"> & {
    borrowerUser: UserPick | null;
  })[];
  _count?: { incidents?: number };
}

export function serializeItem(item: ItemWithRelations): ItemDTO {
  const activeLoan = item.loans?.find((l) => l.status === "ACTIVE") ?? null;
  return {
    id: item.id,
    name: item.name,
    code: item.code,
    category: item.category,
    brand: item.brand,
    model: item.model,
    serial: item.serial,
    location: item.location,
    notes: item.notes,
    status: item.status,
    loanable: item.loanable,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    createdBy: toUserMiniRequired(item.createdBy),
    activeLoan: activeLoan
      ? {
          id: activeLoan.id,
          borrowerLabel:
            activeLoan.borrowerUser?.name ??
            activeLoan.borrowerName ??
            "Desconocido",
          lentAt: activeLoan.lentAt.toISOString(),
          dueAt: activeLoan.dueAt ? activeLoan.dueAt.toISOString() : null,
        }
      : null,
    openIncidentsCount: item._count?.incidents ?? 0,
  };
}

// ── Loan ────────────────────────────────────────────────────────────────────

interface LoanWithRelations extends Loan {
  item: Pick<Item, "id" | "name" | "code" | "category">;
  borrowerUser: UserPick | null;
  lender: UserPick;
}

export function serializeLoan(loan: LoanWithRelations): LoanDTO {
  const isOverdue =
    loan.status === "ACTIVE" &&
    loan.dueAt !== null &&
    loan.dueAt.getTime() < Date.now();
  return {
    id: loan.id,
    item: {
      id: loan.item.id,
      name: loan.item.name,
      code: loan.item.code,
      category: loan.item.category,
    },
    borrowerUser: toUserMini(loan.borrowerUser),
    borrowerName: loan.borrowerName,
    lender: toUserMiniRequired(loan.lender),
    lentAt: loan.lentAt.toISOString(),
    dueAt: loan.dueAt ? loan.dueAt.toISOString() : null,
    returnedAt: loan.returnedAt ? loan.returnedAt.toISOString() : null,
    notes: loan.notes,
    returnNotes: loan.returnNotes,
    status: loan.status,
    isOverdue,
    createdAt: loan.createdAt.toISOString(),
    updatedAt: loan.updatedAt.toISOString(),
  };
}

// ── Incidencias ─────────────────────────────────────────────────────────────

interface IncidentCommentWithAuthor extends EquipmentIncidentComment {
  author: UserPick;
}

export function serializeIncidentComment(
  c: IncidentCommentWithAuthor
): IncidentCommentDTO {
  return {
    id: c.id,
    body: c.deletedAt ? "" : c.body,
    author: toUserMiniRequired(c.author),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    deletedAt: c.deletedAt ? c.deletedAt.toISOString() : null,
  };
}

interface IncidentAttachmentWithUploader extends EquipmentIncidentAttachment {
  uploadedBy: UserPick;
}

export function serializeIncidentAttachment(
  a: IncidentAttachmentWithUploader
): IncidentAttachmentDTO {
  return {
    id: a.id,
    filename: a.filename,
    url: a.url,
    mimeType: a.mimeType,
    size: a.size,
    uploadedBy: toUserMiniRequired(a.uploadedBy),
    createdAt: a.createdAt.toISOString(),
  };
}

interface IncidentWithRelations extends EquipmentIncident {
  item: Pick<Item, "id" | "name" | "code" | "category"> | null;
  reportedBy: UserPick;
  assignedTo: UserPick | null;
  comments?: IncidentCommentWithAuthor[];
  attachments?: IncidentAttachmentWithUploader[];
  _count?: { comments?: number; attachments?: number };
}

export function serializeIncident(i: IncidentWithRelations): IncidentDTO {
  return {
    id: i.id,
    item: i.item
      ? {
          id: i.item.id,
          name: i.item.name,
          code: i.item.code,
          category: i.item.category,
        }
      : null,
    itemDescription: i.itemDescription,
    title: i.title,
    description: i.description,
    severity: i.severity,
    status: i.status,
    reportedBy: toUserMiniRequired(i.reportedBy),
    assignedTo: toUserMini(i.assignedTo),
    resolvedAt: i.resolvedAt ? i.resolvedAt.toISOString() : null,
    closedAt: i.closedAt ? i.closedAt.toISOString() : null,
    resolutionNotes: i.resolutionNotes,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
    commentsCount:
      i._count?.comments ??
      (i.comments?.filter((c) => !c.deletedAt).length ?? 0),
    attachmentsCount: i._count?.attachments ?? i.attachments?.length ?? 0,
    comments: i.comments?.map(serializeIncidentComment),
    attachments: i.attachments?.map(serializeIncidentAttachment),
  };
}
