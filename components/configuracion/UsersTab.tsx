"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Search,
  UserPlus,
  Shield,
  CheckCircle,
  XCircle,
  Download,
  UserRoundSearch,
  Trash2,
  Upload,
  Crosshair,
  LayoutGrid,
  Rows3,
  Pencil,
  Power,
  ImageOff,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { FocusPicker } from "@/components/profile/FocusPicker";
import { UserProfilePopover } from "@/components/user/UserProfilePopover";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Listbox } from "@/components/ui/Listbox";
import { ROLE_LABELS, cn } from "@/lib/utils";
import toast from "react-hot-toast";
import type { SessionUser } from "@/lib/auth/types";
import type { Role } from "@/app/generated/prisma/enums";
import type { ConfigPageDepartment, ConfigPageUser } from "@/lib/types/config";
import { useAccentForUi } from "@/lib/hooks/useAccentForUi";
import { useTheme } from "@/components/layout/ThemeProvider";
import { EmptyState } from "@/components/ui/EmptyState";
import { AvatarImagePreview } from "@/components/ui/AvatarImagePreview";
import {
  IMAGE_UPLOAD_ACCEPT,
  validateProfileImageFile,
} from "@/lib/upload-file";
import { isPlatformOwnerEmail } from "@/lib/platform-owner";
import { USER_ROW_BANNER_HD } from "@/lib/feature-flags";

/**
 * Extrae un mensaje legible del campo `error` que devuelven los endpoints.
 * Acepta:
 *   - string: se devuelve tal cual (ruta feliz, p.ej. validatePasswordPolicy).
 *   - objeto flatten de Zod: `{ fieldErrors: { campo: ["msg"] }, formErrors }`.
 *     Devolvemos el primer mensaje útil (formErrors[0], si no, el primero de
 *     fieldErrors[*][0]).
 *   - cualquier otra cosa: devolvemos `fallback`.
 *
 * Sin este helper, cuando Zod rechazaba un campo el cliente caía al fallback
 * genérico "No se pudo actualizar el usuario" y el usuario no sabía por qué.
 */
function extractErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim().length > 0) return error;
  if (error && typeof error === "object") {
    const e = error as {
      formErrors?: string[];
      fieldErrors?: Record<string, string[]>;
    };
    const firstForm = e.formErrors?.[0];
    if (typeof firstForm === "string" && firstForm.trim().length > 0) {
      return firstForm;
    }
    if (e.fieldErrors) {
      for (const msgs of Object.values(e.fieldErrors)) {
        const first = msgs?.[0];
        if (typeof first === "string" && first.trim().length > 0) {
          return first;
        }
      }
    }
  }
  return fallback;
}

interface UsersTabProps {
  users: ConfigPageUser[];
  departments: ConfigPageDepartment[];
  currentUser: SessionUser;
  isSuperAdmin: boolean;
  isPlatformOwner: boolean;
  /** Operadores: listado del equipo sin edición. */
  readOnly?: boolean;
}

export function UsersTab({
  users,
  departments,
  currentUser,
  isSuperAdmin,
  isPlatformOwner,
  readOnly = false,
}: UsersTabProps) {
  const { accent, withAlpha } = useAccentForUi();
  const { theme } = useTheme();
  const L = theme === "light";
  const router = useRouter();
  const { update } = useSession();
  const [search, setSearch] = useState("");
  /** Vista de la lista: "list" (fila ancha con banner completo) o
   * "gallery" (cards verticales tipo trading-card / tarjeta de presentación). */
  const [view, setView] = useState<"list" | "gallery">("list");
  /** Filtro rápido por rol. */
  const [roleFilter, setRoleFilter] = useState<"ALL" | Role>("ALL");
  /** Filtro rápido por estado (Activo/Inactivo). */
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">(
    "ALL"
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [image, setImage] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [role, setRole] = useState<Role>("OPERATOR");
  const [checkedDeptIds, setCheckedDeptIds] = useState<Set<string>>(new Set());
  const [defaultDeptId, setDefaultDeptId] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editImage, setEditImage] = useState("");
  const [editImageFocusX, setEditImageFocusX] = useState<number | null>(null);
  const [editImageFocusY, setEditImageFocusY] = useState<number | null>(null);
  const [editFocusOpen, setEditFocusOpen] = useState(false);
  const [editRole, setEditRole] = useState<Role>("OPERATOR");
  const [editPassword, setEditPassword] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [uploadingEditAvatar, setUploadingEditAvatar] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ConfigPageUser | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<{
    name: string;
    image: string;
  } | null>(null);

  async function uploadAvatar(file: File, target: "create" | "edit") {
    const validationError = validateProfileImageFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (target === "create") setUploadingAvatar(true);
    else setUploadingEditAvatar(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "No se pudo subir el avatar");
      }
      if (target === "create") setImage(data.url);
      else {
        setEditImage(data.url);
        setEditImageFocusX(null);
        setEditImageFocusY(null);
        setEditFocusOpen(true);
      }
      toast.success("Avatar subido");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir avatar");
    } finally {
      if (target === "create") setUploadingAvatar(false);
      else setUploadingEditAvatar(false);
    }
  }

  const assignableDepartments = useMemo(() => {
    if (isSuperAdmin) return departments;
    return departments.filter((d) =>
      currentUser.departments.some(
        (ud) =>
          ud.id === d.id && (ud.role === "ADMIN" || ud.role === "SUPERADMIN")
      )
    );
  }, [departments, currentUser.departments, isSuperAdmin]);

  const resetForm = useCallback(() => {
    setName("");
    setEmail("");
    setImage("");
    setPassword("");
    setPassword2("");
    setRole("OPERATOR");
    setCheckedDeptIds(new Set());
    setDefaultDeptId(null);
  }, []);

  const openModal = useCallback(() => {
    if (assignableDepartments.length === 0) {
      toast.error("No tienes departamentos donde puedas dar de alta usuarios");
      return;
    }
    setName("");
    setEmail("");
    setImage("");
    setPassword("");
    setPassword2("");
    setRole("OPERATOR");
    const first = assignableDepartments[0].id;
    setCheckedDeptIds(new Set([first]));
    setDefaultDeptId(first);
    setModalOpen(true);
  }, [assignableDepartments]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    resetForm();
  }, [resetForm]);

  function toggleDept(id: string) {
    setCheckedDeptIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (defaultDeptId === id) {
          const first = [...next][0] ?? null;
          setDefaultDeptId(first);
        }
      } else {
        next.add(id);
        if (next.size === 1) setDefaultDeptId(id);
      }
      return next;
    });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (q) {
        if (
          !u.name.toLowerCase().includes(q) &&
          !u.email.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (statusFilter === "ACTIVE" && !u.isActive) return false;
      if (statusFilter === "INACTIVE" && u.isActive) return false;
      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  /* Conteo por rol y por estado para mostrar dentro de cada chip de filtro
   * (sin tener en cuenta el filtro de búsqueda para que los números no bailen). */
  const roleCounts = useMemo(() => {
    const counts = {
      ALL: users.length,
      OPERATOR: 0,
      ADMIN: 0,
      SUPERADMIN: 0,
    } as Record<"ALL" | Role, number>;
    for (const u of users) {
      const r = u.role as Role;
      if (r in counts) counts[r] += 1;
    }
    return counts;
  }, [users]);
  const statusCounts = useMemo(() => {
    let active = 0;
    let inactive = 0;
    for (const u of users) {
      if (u.isActive) active += 1;
      else inactive += 1;
    }
    return { ALL: users.length, ACTIVE: active, INACTIVE: inactive };
  }, [users]);

  /* ¿Hay algún filtro aplicado más allá de la búsqueda? */
  const hasExtraFilters = roleFilter !== "ALL" || statusFilter !== "ALL";

  const { usersByDepartmentSections, usersWithoutDepartment } = useMemo(() => {
    const nameSort = (a: ConfigPageUser, b: ConfigPageUser) =>
      a.name.localeCompare(b.name, "es", { sensitivity: "base" });

    const sections = departments
      .map((dept) => ({
        department: dept,
        users: filtered
          .filter((u) => u.departments.some((ud) => ud.department.id === dept.id))
          .slice()
          .sort(nameSort),
      }))
      .filter((s) => s.users.length > 0);

    const withoutDept = filtered
      .filter((u) => u.departments.length === 0)
      .slice()
      .sort(nameSort);

    return {
      usersByDepartmentSections: sections,
      usersWithoutDepartment: withoutDept,
    };
  }, [filtered, departments]);

  const groupedBodyEmpty =
    filtered.length > 0 &&
    usersByDepartmentSections.length === 0 &&
    usersWithoutDepartment.length === 0;

  const [editTarget, setEditTarget] = useState<ConfigPageUser | null>(null);
  const [editCanManageSA, setEditCanManageSA] = useState(false);

  function openEdit(user: (typeof users)[number]) {
    setEditId(user.id);
    setEditTarget(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditImage(user.image ?? "");
    setEditImageFocusX(user.imageFocusX ?? null);
    setEditImageFocusY(user.imageFocusY ?? null);
    setEditRole(user.role as Role);
    setEditPassword("");
    setEditCanManageSA(user.canManageSuperAdmins ?? false);
    setEditOpen(true);
  }

  async function persistEditFocus(x: number, y: number) {
    if (!editId) return;
    const res = await fetch(`/api/users/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageFocusX: x, imageFocusY: y }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        typeof data?.error === "string" ? data.error : "No se pudo guardar el enfoque";
      throw new Error(msg);
    }
    setEditImageFocusX(x);
    setEditImageFocusY(y);
    if (editId === currentUser.id) {
      await update({ imageFocusX: x, imageFocusY: y });
    }
    toast.success("Enfoque del avatar guardado");
    router.refresh();
  }

  async function handleEditUser(e: React.FormEvent) {
    e.preventDefault();
    if (editRole === "SUPERADMIN" && !canAssignSuperAdmin) {
      toast.error(
        "No tienes permiso para asignar el rol SuperAdmin. Pídelo al propietario."
      );
      return;
    }
    setEditSaving(true);
    try {
      const body: Record<string, string | boolean> = {
        name: editName.trim(),
        email: editEmail.trim(),
        role: editRole,
        image: editImage.trim(),
      };
      if (editPassword.trim()) body.password = editPassword;
      const canShowToggle =
        isPlatformOwner &&
        editTarget != null &&
        editRole === "SUPERADMIN" &&
        !isPlatformOwnerEmail(editTarget.email);
      if (
        canShowToggle &&
        editCanManageSA !== (editTarget?.canManageSuperAdmins ?? false)
      ) {
        body.canManageSuperAdmins = editCanManageSA;
      }
      const res = await fetch(`/api/users/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // El servidor puede devolver `error` como string (mensajes claros de
        // validatePasswordPolicy, permisos, etc.) o como objeto flattened de
        // Zod (`{ fieldErrors: { campo: ["msg"] }, formErrors: [] }`). Si es
        // un objeto, intentamos sacar el primer mensaje útil para no caer al
        // toast genérico.
        const msg = extractErrorMessage(
          data?.error,
          "No se pudo actualizar el usuario"
        );
        throw new Error(msg);
      }
      toast.success("Usuario actualizado");
      setEditOpen(false);
      if (editId === currentUser.id) {
        const normalizedName = editName.trim();
        const normalizedEmail = editEmail.trim();
        const normalizedImage = editImage.trim();
        await update({
          name: normalizedName,
          email: normalizedEmail,
          image: normalizedImage !== "" ? normalizedImage : null,
        });
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setEditSaving(false);
    }
  }

  async function toggleActive(userId: string, isActive: boolean) {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) throw new Error();
      toast.success(isActive ? "Usuario desactivado" : "Usuario activado");
      router.refresh();
    } catch {
      toast.error("Error al actualizar usuario");
    }
  }

  async function handleDeleteUser() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(typeof d?.error === "string" ? d.error : "Error al eliminar");
      }
      toast.success(`Usuario "${deleteTarget.name}" eliminado`);
      setDeleteTarget(null);
      setDeleteConfirmName("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar usuario");
    } finally {
      setDeleting(false);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (password !== password2) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    if (checkedDeptIds.size === 0) {
      toast.error("Selecciona al menos un departamento");
      return;
    }
    if (!defaultDeptId || !checkedDeptIds.has(defaultDeptId)) {
      toast.error("Elige un departamento por defecto entre los seleccionados");
      return;
    }
    if (role === "SUPERADMIN" && !canAssignSuperAdmin) {
      toast.error(
        "No tienes permiso para asignar el rol SuperAdmin. Pídelo al propietario."
      );
      return;
    }

    const departmentsPayload = [...checkedDeptIds].map((departmentId) => ({
      departmentId,
      role,
      isDefault: departmentId === defaultDeptId,
    }));

    setSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          image: image.trim() || undefined,
          password,
          departments: departmentsPayload,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data?.error === "string"
            ? data.error
            : "No se pudo crear el usuario";
        throw new Error(msg);
      }
      toast.success("Usuario creado");
      closeModal();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear usuario");
    } finally {
      setSubmitting(false);
    }
  }

  const canAssignSuperAdmin =
    isPlatformOwner ||
    (isSuperAdmin && currentUser.canManageSuperAdmins === true);

  const roleOptions: Role[] = canAssignSuperAdmin
    ? ["OPERATOR", "ADMIN", "SUPERADMIN"]
    : ["OPERATOR", "ADMIN"];

  function canEditUserRow(user: ConfigPageUser): boolean {
    if (readOnly) return false;
    if (isPlatformOwnerEmail(user.email) && !isPlatformOwner) return false;
    return true;
  }

  function exportCSV() {
    const rows = [
      ["Nombre", "Email", "Rol", "Departamentos"],
      ...filtered.map((u) => [
        u.name,
        u.email,
        u.role,
        u.departments.map((d) => d.department.name).join("; "),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `usuarios_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openAvatarPreview(user: ConfigPageUser) {
    if (!user.image) return;
    setAvatarPreview({ name: user.name, image: user.image });
  }

  /**
   * Renderiza una tarjeta de usuario. Dos variantes:
   *
   *  - "list": tarjeta horizontal con el banner del usuario como fondo a
   *    tamaño completo. Es la vista "clásica" que tanto ha gustado, pero
   *    con más altura, menos overlay y avatar grande para que el banner
   *    sea protagonista.
   *  - "gallery": tarjeta vertical tipo "trading card" / tarjeta de
   *    presentación. Banner cover arriba, avatar superpuesto, datos abajo.
   */
  function renderUserCard(
    user: ConfigPageUser,
    cardKey: string,
    variant: "list" | "gallery",
    /** Índice de aparición dentro de su grupo, para escalonar la animación. */
    indexInGroup: number = 0
  ) {
    /* Delay escalonado para la animación de entrada (máx 12 cards). */
    const enterDelay = `${Math.min(indexInGroup, 12) * 30}ms`;
    const bannerUrl = user.profileBanner?.trim();
    const bannerFocusX = user.bannerFocusX ?? 50;
    const bannerFocusY = user.bannerFocusY ?? 50;

    /* Color de "fallback" cuando el usuario no tiene banner: usamos el color
     * del primer departamento para que la tarjeta nunca se vea vacía y se
     * mantenga la riqueza visual de la lista. */
    const fallbackAccent = user.departments[0]?.department.accentColor ?? "#7c3aed";

    const isOwner = isPlatformOwnerEmail(user.email);
    const isSA = user.role === "SUPERADMIN";
    const isMe = user.id === currentUser.id;

    const editable = canEditUserRow(user);
    const canDelete =
      isPlatformOwner && user.id !== currentUser.id && editable;
    const canToggle = user.id !== currentUser.id && editable;

    /* Estilo de la capa de banner: imagen + degradado adecuado al variant. */
    const bannerStyle: React.CSSProperties = bannerUrl
      ? {
          backgroundImage:
            variant === "list"
              ? // Lista: degradado horizontal MUCHO más sutil que antes. Solo
                // oscurece los bordes para que se lea el texto, deja respirar
                // el banner en el centro.
                `linear-gradient(90deg, rgba(10,15,30,0.78) 0%, rgba(10,15,30,0.25) 28%, rgba(10,15,30,0.18) 62%, rgba(10,15,30,0.82) 100%), url(${bannerUrl})`
              : // Galería: degradado vertical para que el banner se vea limpio
                // arriba y se difumine hacia el panel inferior con la info.
                `linear-gradient(180deg, rgba(10,15,30,0.05) 0%, rgba(10,15,30,0.05) 55%, rgba(10,15,30,0.55) 100%), url(${bannerUrl})`,
          backgroundRepeat: "no-repeat, no-repeat",
          backgroundSize: "cover, cover",
          backgroundPosition: `center, ${bannerFocusX}% ${bannerFocusY}%`,
          imageRendering: USER_ROW_BANNER_HD
            ? "-webkit-optimize-contrast"
            : "auto",
        }
      : {
          /* Fallback: degradado con el color del departamento. */
          backgroundImage:
            variant === "list"
              ? `linear-gradient(90deg, ${withAlpha(fallbackAccent, "55")} 0%, ${withAlpha(fallbackAccent, "20")} 50%, ${withAlpha(fallbackAccent, "55")} 100%)`
              : `linear-gradient(180deg, ${withAlpha(fallbackAccent, "40")} 0%, ${withAlpha(fallbackAccent, "15")} 65%, rgba(10,15,30,0.5) 100%)`,
        };

    /* Pills de departamento, reutilizadas en ambas variantes. */
    const deptPills = (
      <div className="flex flex-wrap items-center gap-1">
        {user.departments.slice(0, variant === "list" ? 3 : 2).map((ud) => (
          <span
            key={ud.id}
            className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold backdrop-blur-sm"
            style={{
              borderColor: withAlpha(ud.department.accentColor, "40"),
              color: "#ffffff",
              backgroundColor: withAlpha(ud.department.accentColor, "22"),
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: ud.department.accentColor }}
            />
            {ud.department.name}
          </span>
        ))}
        {user.departments.length > (variant === "list" ? 3 : 2) && (
          <span className="rounded-md bg-black/30 px-1.5 py-0.5 text-[10.5px] font-semibold text-white/80 backdrop-blur-sm">
            +{user.departments.length - (variant === "list" ? 3 : 2)}
          </span>
        )}
      </div>
    );

    /* Pill de rol (Propietario / SuperAdmin / Admin / Operador). */
    const rolePill = (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold backdrop-blur-sm",
          isOwner
            ? "bg-[#ffeb66]/30 text-[#fff8c2] ring-1 ring-[#ffeb66]/40"
            : isSA
              ? "bg-violet-500/30 text-violet-50 ring-1 ring-violet-400/40"
              : user.role === "ADMIN"
                ? "bg-sky-500/30 text-sky-50 ring-1 ring-sky-400/40"
                : "bg-white/15 text-white/85 ring-1 ring-white/20"
        )}
      >
        {(isOwner || isSA) && <Shield className="h-2.5 w-2.5" />}
        {isOwner
          ? "Propietario"
          : ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}
      </span>
    );

    /* Pill "Inactivo" (solo cuando lo está; si está activo no metemos ruido). */
    const inactivePill = !user.isActive && (
      <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/30 px-1.5 py-0.5 text-[10.5px] font-semibold text-rose-50 ring-1 ring-rose-400/40 backdrop-blur-sm">
        <XCircle className="h-2.5 w-2.5" />
        Inactivo
      </span>
    );

    /* Pill "Eres tú" — cuando el usuario que veo soy yo. La idea es ayudarme
     * a localizarme en la lista de un vistazo. */
    const mePillOnBanner = isMe && (
      <span className="inline-flex items-center gap-1 rounded-md bg-[#ffeb66]/35 px-1.5 py-0.5 text-[10.5px] font-bold text-[#fffbcc] ring-1 ring-[#ffeb66]/55 backdrop-blur-sm">
        Eres tú
      </span>
    );

    /* Indicador visual cuando el usuario aún no ha elegido banner. Se queda
     * en una esquina, pequeño, no estorba. */
    const noBannerHint = !bannerUrl && (
      <span
        className="inline-flex items-center gap-1 rounded-md bg-black/30 px-1.5 py-0.5 text-[10px] font-semibold text-white/70 backdrop-blur-sm"
        title="Este usuario aún no ha elegido un fondo de perfil"
      >
        <ImageOff className="h-2.5 w-2.5" />
        Sin fondo
      </span>
    );

    /* Tira de acciones (icon buttons) — aparece SIEMPRE para que el admin no
     * tenga que hacer hover ciego. Si no se puede editar, sale "—". */
    const actions = !readOnly && (
      <div className="flex items-center gap-1 shrink-0">
        {editable ? (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openEdit(user);
              }}
              title="Editar usuario"
              className="rounded-md bg-white/15 p-1.5 text-white/90 ring-1 ring-white/20 backdrop-blur-sm transition-colors hover:bg-white/25"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            {canToggle && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void toggleActive(user.id, user.isActive);
                }}
                title={user.isActive ? "Desactivar usuario" : "Activar usuario"}
                className={cn(
                  "rounded-md p-1.5 ring-1 backdrop-blur-sm transition-colors",
                  user.isActive
                    ? "bg-white/15 text-white/90 ring-white/20 hover:bg-rose-500/40 hover:text-rose-50 hover:ring-rose-300/60"
                    : "bg-emerald-500/30 text-emerald-50 ring-emerald-400/40 hover:bg-emerald-500/45"
                )}
              >
                <Power className="h-3.5 w-3.5" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(user);
                  setDeleteConfirmName("");
                }}
                title="Eliminar usuario"
                className="rounded-md bg-white/15 p-1.5 text-white/85 ring-1 ring-white/20 backdrop-blur-sm transition-colors hover:bg-rose-500/40 hover:text-rose-50 hover:ring-rose-300/60"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        ) : (
          <span
            className="rounded-md bg-black/30 px-2 py-1 text-[10px] font-semibold text-white/55 ring-1 ring-white/15 backdrop-blur-sm"
            title="Cuenta del propietario"
          >
            Bloqueado
          </span>
        )}
      </div>
    );

    if (variant === "list") {
      return (
        <div
          key={cardKey}
          className={cn(
            "user-card-list group relative overflow-hidden rounded-xl border transition-all duration-300 hover:-translate-y-0.5 animate-novedades-card-in",
            L
              ? "border-zinc-200/80 shadow-sm hover:shadow-md"
              : "border-white/10 hover:border-white/18",
            isMe &&
              (L
                ? "ring-2 ring-amber-300/70 border-amber-300/70"
                : "ring-2 ring-[#ffeb66]/40 border-[#ffeb66]/40")
          )}
          style={{ animationDelay: enterDelay }}
        >
          {/* Capa del banner aislada en su propio div absoluto para poder
           * hacer un zoom sutil al hover sin que se mueva el contenido. */}
          <div
            aria-hidden
            className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            style={bannerStyle}
          />

          {/* Capa interna con el contenido. Vive encima del banner. */}
          <div className="relative flex items-center gap-3.5 px-3.5 py-3 sm:gap-4 sm:px-5 sm:py-4">
            <button
              type="button"
              onClick={() => openAvatarPreview(user)}
              disabled={!user.image}
              title={user.image ? "Ver foto" : undefined}
              className={cn(
                /* Avatar limpio: sin `ring` ni `bg+padding` que dibujen un
                 * círculo detrás del avatar. Solo el avatar puro. */
                "shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffeb66]/60",
                user.image && "cursor-zoom-in"
              )}
            >
              <Avatar
                name={user.name}
                image={user.image}
                focusX={user.imageFocusX}
                focusY={user.imageFocusY}
                size="lg"
              />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <UserProfilePopover
                  userId={user.id}
                  name={user.name}
                  email={user.email}
                  image={user.image}
                  profileBanner={user.profileBanner}
                  nameClassName="text-[15px] font-bold leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
                />
                {mePillOnBanner}
                {rolePill}
                {inactivePill}
                {noBannerHint}
              </div>
              <p className="mt-0.5 truncate text-[12px] text-white/85 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                {user.email}
              </p>
              <div className="mt-1.5">{deptPills}</div>
            </div>

            {actions}
          </div>
        </div>
      );
    }

    /* variant === "gallery" */
    return (
      <div
        key={cardKey}
        className={cn(
          "user-card-gallery group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-1 animate-novedades-card-in",
          L
            ? "border-zinc-200/80 bg-white shadow-sm hover:shadow-xl"
            : "border-white/10 bg-white/[0.02] hover:border-white/18 hover:bg-white/[0.04]",
          /* Ring amarillo sutil cuando soy yo, para localizarme rápido */
          isMe &&
            (L
              ? "ring-2 ring-amber-300/70"
              : "ring-2 ring-[#ffeb66]/40")
        )}
        style={{ animationDelay: enterDelay }}
      >
        {/* Banner cover. Más alto que antes (h-32 → h-40) para que sea
         * realmente protagonista y los compañeros disfruten del fondo. */}
        <div className="relative h-40 w-full overflow-hidden">
          <div
            className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.05]"
            style={bannerStyle}
          />
          {/* Acciones flotando en esquina superior, encima del banner */}
          {actions && (
            <div className="absolute right-2 top-2 z-[2]">{actions}</div>
          )}
          {/* Pill "Eres tú" y/o "Sin fondo" en la esquina superior izquierda */}
          {(isMe || noBannerHint) && (
            <div className="absolute left-2 top-2 z-[2] flex items-center gap-1.5">
              {mePillOnBanner}
              {noBannerHint}
            </div>
          )}
        </div>

        {/* Cuerpo de la card. El padding superior es mayor para acomodar
         * el avatar XL (80 px) que sobresale del banner. */}
        <div className="relative px-4 pb-4 pt-14">
          {/* Avatar superpuesto: SIN wrapper de color, SIN ring, SIN padding.
           * Solo el avatar circular. Sin sombras, sin círculos por fuera. */}
          <button
            type="button"
            onClick={() => openAvatarPreview(user)}
            disabled={!user.image}
            title={user.image ? "Ver foto" : undefined}
            className={cn(
              "absolute -top-10 left-4 z-[3] rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffeb66]/60",
              user.image && "cursor-zoom-in"
            )}
          >
            <Avatar
              name={user.name}
              image={user.image}
              focusX={user.imageFocusX}
              focusY={user.imageFocusY}
              size="xl"
            />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <UserProfilePopover
                userId={user.id}
                name={user.name}
                email={user.email}
                image={user.image}
                profileBanner={user.profileBanner}
                nameClassName={cn(
                  "text-[14.5px] font-bold leading-tight",
                  L ? "text-zinc-900" : "text-white"
                )}
              />
              {isOwner && (
                <Shield
                  className="h-3.5 w-3.5 text-amber-500"
                  aria-label="Propietario"
                />
              )}
            </div>
            <p
              className={cn(
                "mt-0.5 truncate text-[11.5px]",
                L ? "text-zinc-500" : "text-white/45"
              )}
              title={user.email}
            >
              {user.email}
            </p>

            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              {/* Rol como mini-pill local del card (modo claro/oscuro). */}
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold ring-1",
                  isOwner
                    ? L
                      ? "bg-amber-50 text-amber-800 ring-amber-200"
                      : "bg-[#ffeb66]/15 text-[#ffeb66] ring-[#ffeb66]/30"
                    : isSA
                      ? L
                        ? "bg-violet-50 text-violet-700 ring-violet-200"
                        : "bg-violet-500/15 text-violet-200 ring-violet-400/30"
                      : user.role === "ADMIN"
                        ? L
                          ? "bg-sky-50 text-sky-700 ring-sky-200"
                          : "bg-sky-500/15 text-sky-200 ring-sky-400/30"
                        : L
                          ? "bg-zinc-100 text-zinc-700 ring-zinc-200"
                          : "bg-white/[0.06] text-white/65 ring-white/15"
                )}
              >
                {(isOwner || isSA) && <Shield className="h-2.5 w-2.5" />}
                {isOwner
                  ? "Propietario"
                  : ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}
              </span>
              {/* Estado */}
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold ring-1",
                  user.isActive
                    ? L
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      : "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30"
                    : L
                      ? "bg-rose-50 text-rose-700 ring-rose-200"
                      : "bg-rose-500/15 text-rose-200 ring-rose-400/30"
                )}
              >
                {user.isActive ? (
                  <CheckCircle className="h-2.5 w-2.5" />
                ) : (
                  <XCircle className="h-2.5 w-2.5" />
                )}
                {user.isActive ? "Activo" : "Inactivo"}
              </span>
            </div>

            {/* Departamentos en versión "claro" para que se lean bien en el
             * cuerpo del card. */}
            {user.departments.length > 0 && (
              <div
                className={cn(
                  "mt-2 pt-2 flex items-center gap-1 flex-wrap border-t",
                  L ? "border-zinc-100" : "border-white/6"
                )}
              >
                {user.departments.slice(0, 3).map((ud) => (
                  <span
                    key={ud.id}
                    className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold"
                    style={{
                      borderColor: withAlpha(ud.department.accentColor, "35"),
                      color: accent(ud.department.accentColor),
                      backgroundColor: withAlpha(
                        ud.department.accentColor,
                        L ? "12" : "15"
                      ),
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: ud.department.accentColor }}
                    />
                    {ud.department.name}
                  </span>
                ))}
                {user.departments.length > 3 && (
                  <span
                    className={cn(
                      "text-[10.5px] font-semibold",
                      L ? "text-zinc-400" : "text-white/40"
                    )}
                  >
                    +{user.departments.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="config-users-root space-y-4">
      {readOnly && (
        <p
          className={cn(
            "rounded-lg border px-3 py-2 text-xs",
            L
              ? "border-zinc-200 bg-zinc-50 text-zinc-600"
              : "border-white/10 bg-white/[0.03] text-white/50"
          )}
        >
          Directorio del equipo en solo lectura. Para cambiar tu perfil, usa la pestaña Mi cuenta.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search: en mobile el `min-w-[12rem]` impedia que la barra
           cupiese junto con el toggle de vista en 360px y forzaba un
           wrap horrible. Con `min-w-0` se adapta al ancho disponible. */}
        <div className="relative min-w-0 w-full sm:min-w-[12rem] sm:w-auto flex-1">
          <Search
            className={cn(
              "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2",
              L ? "text-zinc-400" : "text-white/30"
            )}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar usuarios..."
            className={cn(
              "config-users-search h-9 w-full rounded-lg border pl-9 pr-3 text-sm focus:outline-none",
              L
                ? "border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/25"
                : "border-white/10 bg-white/[0.04] text-white placeholder:text-white/30 focus:border-[#ffeb66]/40 focus:ring-2 focus:ring-[#ffeb66]/20"
            )}
          />
        </div>

        {/* Toggle de vista: Lista / Galería */}
        <div
          role="tablist"
          aria-label="Modo de vista"
          className={cn(
            "inline-flex shrink-0 items-center gap-0.5 rounded-lg border p-0.5",
            L
              ? "border-zinc-200 bg-white"
              : "border-white/10 bg-white/[0.04]"
          )}
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === "list"}
            onClick={() => setView("list")}
            title="Vista de lista (banner ancho de cada compañero)"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold transition-all",
              view === "list"
                ? L
                  ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                  : "bg-[#ffeb66]/15 text-[#ffeb66] ring-1 ring-[#ffeb66]/30"
                : L
                  ? "text-zinc-500 hover:text-zinc-800"
                  : "text-white/45 hover:text-white/75"
            )}
          >
            <Rows3 className="h-3.5 w-3.5" />
            Lista
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "gallery"}
            onClick={() => setView("gallery")}
            title="Vista de galería (tarjetas de presentación)"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold transition-all",
              view === "gallery"
                ? L
                  ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                  : "bg-[#ffeb66]/15 text-[#ffeb66] ring-1 ring-[#ffeb66]/30"
                : L
                  ? "text-zinc-500 hover:text-zinc-800"
                  : "text-white/45 hover:text-white/75"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Galería
          </button>
        </div>

        {!readOnly && (
          <>
            <Button
              variant="secondary"
              size="md"
              type="button"
              onClick={exportCSV}
              title="Exportar CSV"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button variant="primary" size="md" type="button" onClick={openModal}>
              <UserPlus className="h-3.5 w-3.5" />
              Nuevo usuario
            </Button>
          </>
        )}
      </div>

      {/* ── Filtros rápidos por rol y estado ───────────────────── */}
      <div className="flex flex-wrap items-center gap-3 -mt-1">
        <FilterChipGroup
          L={L}
          label="Rol"
          chips={[
            { value: "ALL", label: "Todos", count: roleCounts.ALL },
            {
              value: "OPERATOR",
              label: ROLE_LABELS.OPERATOR,
              count: roleCounts.OPERATOR,
            },
            {
              value: "ADMIN",
              label: ROLE_LABELS.ADMIN,
              count: roleCounts.ADMIN,
            },
            {
              value: "SUPERADMIN",
              label: ROLE_LABELS.SUPERADMIN,
              count: roleCounts.SUPERADMIN,
            },
          ]}
          value={roleFilter}
          onChange={(v) => setRoleFilter(v as "ALL" | Role)}
        />
        <FilterChipGroup
          L={L}
          label="Estado"
          chips={[
            { value: "ALL", label: "Todos", count: statusCounts.ALL },
            {
              value: "ACTIVE",
              label: "Activos",
              count: statusCounts.ACTIVE,
              tone: "emerald",
            },
            {
              value: "INACTIVE",
              label: "Inactivos",
              count: statusCounts.INACTIVE,
              tone: "rose",
            },
          ]}
          value={statusFilter}
          onChange={(v) =>
            setStatusFilter(v as "ALL" | "ACTIVE" | "INACTIVE")
          }
        />
        {hasExtraFilters && (
          <button
            type="button"
            onClick={() => {
              setRoleFilter("ALL");
              setStatusFilter("ALL");
            }}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors",
              L
                ? "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                : "text-white/45 hover:bg-white/8 hover:text-white/80"
            )}
            title="Quitar filtros"
          >
            <XCircle className="h-3 w-3" />
            Limpiar filtros
          </button>
        )}
      </div>

      {!readOnly && (
      <>
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title="Nuevo usuario"
        description="El usuario podrá iniciar sesión con el email y la contraseña indicados."
        size="md"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <Input
            light={L}
            label="Nombre completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
          <Input
            light={L}
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="off"
          />
          <Input
            light={L}
            label="URL de avatar (opcional)"
            type="text"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="https://... o /api/media/..."
            autoComplete="off"
          />
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg border px-2.5 py-2",
              L ? "border-zinc-200 bg-zinc-50/80" : "border-white/10 bg-white/3"
            )}
          >
            <Avatar name={name || "Nuevo usuario"} image={image.trim() || null} size="sm" />
            <span className={cn("text-xs", L ? "text-zinc-500" : "text-white/40")}>
              Vista previa del avatar
            </span>
            <label className="ml-auto">
              <input
                type="file"
                accept={IMAGE_UPLOAD_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadAvatar(f, "create");
                  e.currentTarget.value = "";
                }}
              />
              <span
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs",
                  L
                    ? "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                    : "border-white/20 bg-white/5 text-white/70 hover:bg-white/10",
                  uploadingAvatar && "pointer-events-none opacity-60"
                )}
              >
                <Upload className="h-3 w-3" />
                {uploadingAvatar ? "Subiendo..." : "Subir"}
              </span>
            </label>
          </div>
          <Input
            light={L}
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <Input
            light={L}
            label="Confirmar contraseña"
            type="password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />

          <div className="flex flex-col gap-1.5">
            <label
              className={cn(
                "text-xs font-medium uppercase tracking-wide",
                L ? "text-zinc-500" : "text-white/60"
              )}
            >
              Rol global
            </label>
            <Listbox
              value={role}
              onChange={(v) => setRole(v as Role)}
              options={roleOptions.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
              light={L}
              ariaLabel="Rol global"
            />
            <p className={cn("text-[11px]", L ? "text-zinc-500" : "text-white/35")}>
              El mismo rol se aplicará en cada departamento seleccionado.
            </p>
          </div>

          <div
            className={cn(
              "rounded-xl border p-3 space-y-2",
              L ? "border-zinc-200 bg-zinc-50/80" : "border-white/10 bg-white/3"
            )}
          >
            <p
              className={cn(
                "text-xs font-medium uppercase tracking-wide",
                L ? "text-zinc-500" : "text-white/60"
              )}
            >
              Departamentos
            </p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {assignableDepartments.map((d) => {
                const checked = checkedDeptIds.has(d.id);
                return (
                  <label
                    key={d.id}
                    className={cn(
                      "flex items-center gap-2.5 cursor-pointer text-sm",
                      L
                        ? "text-zinc-600 hover:text-zinc-900"
                        : "text-white/70 hover:text-white/90"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDept(d.id)}
                      className={cn(
                        "rounded accent-[#ffeb66]",
                        L ? "border-zinc-300 bg-white" : "border-white/20 bg-white/5"
                      )}
                    />
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: accent(d.accentColor) }}
                    />
                    <span className="flex-1">{d.name}</span>
                    {checked && (
                      <input
                        type="radio"
                        name="defaultDept"
                        checked={defaultDeptId === d.id}
                        onChange={() => setDefaultDeptId(d.id)}
                        className="accent-[#ffeb66]"
                        title="Por defecto"
                      />
                    )}
                  </label>
                );
              })}
            </div>
            <p className={cn("text-[11px]", L ? "text-zinc-500" : "text-white/35")}>
              Marca el círculo del departamento que quieras como predeterminado al iniciar sesión.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={closeModal}
              className={cn(
                L &&
                  "border-zinc-200 bg-zinc-100 text-zinc-800 hover:bg-zinc-200 hover:border-zinc-300"
              )}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Crear usuario
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Editar usuario"
        description="Los cambios de contraseña son opcionales. El rol aplica a nivel global."
        size="md"
      >
        <form onSubmit={handleEditUser} className="space-y-4">
          <Input
            light={L}
            label="Nombre completo"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
            autoComplete="name"
          />
          <Input
            light={L}
            label="Email"
            type="email"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
            required
            autoComplete="off"
          />
          <Input
            light={L}
            label="URL de avatar (opcional)"
            type="text"
            value={editImage}
            onChange={(e) => setEditImage(e.target.value)}
            placeholder="https://... o /api/media/..."
            autoComplete="off"
          />
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg border px-2.5 py-2",
              L ? "border-zinc-200 bg-zinc-50/80" : "border-white/10 bg-white/3"
            )}
          >
            <Avatar
              name={editName || "Usuario"}
              image={editImage.trim() || null}
              focusX={editImageFocusX}
              focusY={editImageFocusY}
              size="sm"
            />
            <span className={cn("text-xs", L ? "text-zinc-500" : "text-white/40")}>
              Vista previa del avatar
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              {editImage.trim() && (
                <button
                  type="button"
                  onClick={() => setEditFocusOpen(true)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs",
                    L
                      ? "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                      : "border-white/20 bg-white/5 text-white/70 hover:bg-white/10"
                  )}
                  title="Ajustar qué parte de la foto se ve"
                >
                  <Crosshair className="h-3 w-3" />
                  Enfoque
                </button>
              )}
              <label>
                <input
                  type="file"
                  accept={IMAGE_UPLOAD_ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadAvatar(f, "edit");
                    e.currentTarget.value = "";
                  }}
                />
                <span
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs",
                    L
                      ? "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                      : "border-white/20 bg-white/5 text-white/70 hover:bg-white/10",
                    uploadingEditAvatar && "pointer-events-none opacity-60"
                  )}
                >
                  <Upload className="h-3 w-3" />
                  {uploadingEditAvatar ? "Subiendo..." : "Subir"}
                </span>
              </label>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              className={cn(
                "text-xs font-medium uppercase tracking-wide",
                L ? "text-zinc-500" : "text-white/60"
              )}
            >
              Rol global
            </label>
            <Listbox
              value={editRole}
              onChange={(v) => setEditRole(v as Role)}
              options={roleOptions.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
              light={L}
              ariaLabel="Rol global"
            />
          </div>
          <Input
            light={L}
            label="Nueva contraseña (opcional)"
            type="password"
            value={editPassword}
            onChange={(e) => setEditPassword(e.target.value)}
            minLength={8}
            autoComplete="new-password"
            placeholder="Dejar vacío para no cambiar"
          />
          {isPlatformOwner &&
            editTarget &&
            editRole === "SUPERADMIN" &&
            !isPlatformOwnerEmail(editTarget.email) && (
              <label
                className={cn(
                  "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors",
                  L
                    ? "border-amber-300/40 bg-amber-50/60"
                    : "border-[#ffeb66]/25 bg-[#ffeb66]/[0.04] hover:bg-[#ffeb66]/[0.08]"
                )}
              >
                <input
                  type="checkbox"
                  checked={editCanManageSA}
                  onChange={(e) => setEditCanManageSA(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#ffeb66] shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      "flex items-center gap-1.5 text-xs font-semibold",
                      L ? "text-amber-700" : "text-[#ffeb66]"
                    )}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    Puede gestionar SuperAdmin
                  </div>
                  <p
                    className={cn(
                      "mt-0.5 text-[11px] leading-relaxed",
                      L ? "text-zinc-600" : "text-white/45"
                    )}
                  >
                    Si marcas esta opción, este SuperAdmin podrá asignar o
                    quitar el rol SuperAdmin a otros usuarios (excepto a tu
                    cuenta de propietario).
                  </p>
                </div>
              </label>
            )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditOpen(false)}
              className={cn(
                L &&
                  "border-zinc-200 bg-zinc-100 text-zinc-800 hover:bg-zinc-200 hover:border-zinc-300"
              )}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={editSaving}>
              Guardar
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => { setDeleteTarget(null); setDeleteConfirmName(""); }}
        title="Eliminar usuario"
        description={`Esta acción eliminará permanentemente la cuenta de ${deleteTarget?.name ?? "este usuario"}. Escribe el nombre exacto para confirmar.`}
        size="sm"
      >
        <div className="space-y-4">
          <div
            className={cn(
              "rounded-lg border p-3 text-sm",
              L
                ? "bg-red-50 border-red-200 text-red-800"
                : "bg-red-500/8 border border-red-500/20 text-red-400"
            )}
          >
            <strong>Advertencia:</strong> Esta operación no se puede deshacer. Se perderán todos los datos asociados a este usuario.
          </div>
          <Input
            light={L}
            label={`Escribe "${deleteTarget?.name}" para confirmar`}
            value={deleteConfirmName}
            onChange={(e) => setDeleteConfirmName(e.target.value)}
            placeholder={deleteTarget?.name ?? ""}
            autoComplete="off"
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setDeleteTarget(null); setDeleteConfirmName(""); }}
              className={cn(
                L &&
                  "border-zinc-200 bg-zinc-100 text-zinc-800 hover:bg-zinc-200 hover:border-zinc-300"
              )}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={deleting}
              disabled={deleteConfirmName !== deleteTarget?.name}
              onClick={handleDeleteUser}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Eliminar usuario
            </Button>
          </div>
        </div>
      </Modal>
      </>
      )}

      {/* ── Lista de usuarios como cards con el banner protagonista ── */}
      <div className="config-users-cards-shell space-y-4">
        {filtered.length === 0 ? (
          <div
            className={cn(
              "rounded-2xl border p-2",
              L
                ? "border-zinc-200 bg-white"
                : "border-white/8 bg-white/[0.02]"
            )}
          >
            <EmptyState
              compact
              icon={UserRoundSearch}
              title="No hay usuarios que mostrar"
              description={
                search
                  ? `Ningún nombre ni email coincide con «${search}».`
                  : "No hay usuarios que coincidan con los criterios actuales."
              }
              secondaryAction={
                search
                  ? { label: "Limpiar búsqueda", onClick: () => setSearch("") }
                  : undefined
              }
              embedded
            />
          </div>
        ) : (
          <>
            {groupedBodyEmpty ? (
              <UsersGroupRender
                view={view}
                cards={filtered.map((u, i) =>
                  renderUserCard(u, u.id, view, i)
                )}
              />
            ) : (
              <>
                {usersByDepartmentSections.map(
                  ({ department, users: list }) => (
                    <DepartmentSection
                      key={department.id}
                      L={L}
                      view={view}
                      accentColor={department.accentColor}
                      name={department.name}
                      count={list.length}
                      totalMembers={department._count.members}
                    >
                      <UsersGroupRender
                        view={view}
                        cards={list.map((u, i) =>
                          renderUserCard(
                            u,
                            `${department.id}:${u.id}`,
                            view,
                            i
                          )
                        )}
                      />
                    </DepartmentSection>
                  )
                )}
                {usersWithoutDepartment.length > 0 && (
                  <DepartmentSection
                    key="__sin-depto"
                    L={L}
                    view={view}
                    accentColor="#f59e0b"
                    name="Sin departamento asignado"
                    count={usersWithoutDepartment.length}
                    orphan
                  >
                    <UsersGroupRender
                      view={view}
                      cards={usersWithoutDepartment.map((u, i) =>
                        renderUserCard(u, `__sin-depto:${u.id}`, view, i)
                      )}
                    />
                  </DepartmentSection>
                )}
              </>
            )}
          </>
        )}
      </div>

      <AvatarImagePreview
        open={!!avatarPreview}
        name={avatarPreview?.name ?? ""}
        imageUrl={avatarPreview?.image ?? null}
        onClose={() => setAvatarPreview(null)}
      />

      {editImage.trim() && (
        <FocusPicker
          open={editFocusOpen}
          onClose={() => setEditFocusOpen(false)}
          imageUrl={editImage.trim()}
          variant="avatar"
          initialFocusX={editImageFocusX}
          initialFocusY={editImageFocusY}
          onSave={persistEditFocus}
        />
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 *  Sección por departamento: cabecera con color + contenedor de cards.
 *  Tiene dos variantes según la vista:
 *    - "list": banda completa con fondo del departamento (la actual).
 *    - "gallery": cabecera fina tipo "rótulo" con el nombre del depto
 *      flotando entre cards, para no competir visualmente con las
 *      tarjetas de presentación.
 * ────────────────────────────────────────────────────────────── */
function DepartmentSection({
  L,
  view,
  accentColor,
  name,
  count,
  totalMembers,
  orphan,
  children,
}: {
  L: boolean;
  view: "list" | "gallery";
  accentColor: string;
  name: string;
  count: number;
  totalMembers?: number;
  orphan?: boolean;
  children: React.ReactNode;
}) {
  if (view === "gallery") {
    /* Cabecera compacta: una "etiqueta" horizontal con divisor a los lados,
     * el chip del departamento centrado/izquierda, y el contador. */
    return (
      <section className="space-y-3">
        <header className="flex items-center gap-3">
          <span
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 shadow-sm backdrop-blur-sm"
            style={{
              backgroundColor: orphan
                ? L
                  ? "#fffbeb"
                  : "rgba(245, 158, 11, 0.10)"
                : L
                  ? `${accentColor}10`
                  : `${accentColor}18`,
              borderColor: `${accentColor}${L ? "40" : "35"}`,
            }}
          >
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: accentColor }}
            />
            <h3
              className={cn(
                "text-[12px] font-bold tracking-tight",
                L ? "text-zinc-900" : "text-white"
              )}
            >
              {name}
            </h3>
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                L
                  ? "bg-white/80 text-zinc-700 ring-1 ring-zinc-200"
                  : "bg-white/10 text-white/75 ring-1 ring-white/15"
              )}
            >
              {count}
            </span>
          </span>
          {/* Divisor decorativo con un degradado del color del depto */}
          <span
            aria-hidden
            className="h-px flex-1 rounded-full"
            style={{
              background: `linear-gradient(90deg, ${accentColor}${L ? "55" : "40"} 0%, transparent 100%)`,
            }}
          />
          {totalMembers !== undefined && totalMembers !== count && (
            <span
              className={cn(
                "shrink-0 text-[10.5px]",
                L ? "text-zinc-500" : "text-white/45"
              )}
            >
              {totalMembers}{" "}
              {totalMembers === 1
                ? "miembro activo"
                : "miembros activos"}{" "}
              en total
            </span>
          )}
        </header>
        {children}
      </section>
    );
  }

  /* "list": banda con el color del depto (la cabecera anterior). */
  return (
    <section className="space-y-2">
      <header
        className="relative overflow-hidden rounded-xl px-3.5 py-2.5 ring-1"
        style={{
          backgroundColor: orphan
            ? L
              ? "#fef3c7"
              : "rgba(245, 158, 11, 0.07)"
            : L
              ? `${accentColor}12`
              : `${accentColor}14`,
          borderColor: "transparent",
          boxShadow: `inset 0 0 0 1px ${accentColor}${L ? "33" : "30"}`,
        }}
      >
        <span
          aria-hidden
          className="absolute inset-y-1.5 left-0 w-1 rounded-r-full"
          style={{ backgroundColor: accentColor }}
        />
        <div className="ml-2 flex flex-wrap items-center gap-2">
          <h3
            className={cn(
              "text-[13px] font-bold tracking-tight",
              L ? "text-zinc-900" : "text-white"
            )}
          >
            {name}
          </h3>
          <span
            className={cn(
              "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
              L
                ? "bg-white/80 text-zinc-700 ring-1 ring-zinc-200"
                : "bg-white/10 text-white/75 ring-1 ring-white/15"
            )}
          >
            {count} {count === 1 ? "usuario" : "usuarios"}
          </span>
          {totalMembers !== undefined && totalMembers !== count && (
            <span
              className={cn(
                "text-[10.5px]",
                L ? "text-zinc-500" : "text-white/45"
              )}
            >
              · {totalMembers}{" "}
              {totalMembers === 1 ? "miembro activo" : "miembros activos"} en
              total
            </span>
          )}
        </div>
      </header>
      {children}
    </section>
  );
}

/**
 * Renderiza el grupo de cards en el layout adecuado a la vista activa.
 *  - "list" → columna vertical, cards full-width.
 *  - "gallery" → grid responsive de cards verticales tipo trading card.
 */
function UsersGroupRender({
  view,
  cards,
}: {
  view: "list" | "gallery";
  cards: React.ReactNode[];
}) {
  if (view === "list") {
    return <div className="space-y-2.5">{cards}</div>;
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 *  Grupo de chips para filtros rápidos (rol, estado…).
 *  Cada chip muestra label + número entre paréntesis.
 * ────────────────────────────────────────────────────────────── */
function FilterChipGroup({
  L,
  label,
  chips,
  value,
  onChange,
}: {
  L: boolean;
  label: string;
  chips: Array<{
    value: string;
    label: string;
    count: number;
    tone?: "emerald" | "rose";
  }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "text-[10px] font-bold uppercase tracking-[0.14em] mr-0.5",
          L ? "text-zinc-500" : "text-white/40"
        )}
      >
        {label}
      </span>
      <div
        role="tablist"
        aria-label={label}
        className={cn(
          "inline-flex items-center gap-0.5 rounded-lg border p-0.5",
          L
            ? "border-zinc-200 bg-white"
            : "border-white/10 bg-white/[0.04]"
        )}
      >
        {chips.map((chip) => {
          const isActive = chip.value === value;
          const toneActive =
            chip.tone === "emerald"
              ? L
                ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                : "bg-emerald-500/12 text-emerald-200 ring-emerald-400/30"
              : chip.tone === "rose"
                ? L
                  ? "bg-rose-50 text-rose-800 ring-rose-200"
                  : "bg-rose-500/12 text-rose-200 ring-rose-400/30"
                : L
                  ? "bg-amber-50 text-amber-800 ring-amber-200"
                  : "bg-[#ffeb66]/12 text-[#ffeb66] ring-[#ffeb66]/30";
          return (
            <button
              key={chip.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(chip.value)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] font-semibold transition-all",
                isActive
                  ? cn("ring-1 shadow-sm", toneActive)
                  : L
                    ? "text-zinc-600 hover:text-zinc-900"
                    : "text-white/55 hover:text-white/85"
              )}
            >
              {chip.label}
              <span
                className={cn(
                  "rounded-md px-1 py-px text-[10px] tabular-nums",
                  isActive
                    ? "bg-black/8 dark:bg-white/10"
                    : L
                      ? "bg-zinc-100 text-zinc-500"
                      : "bg-white/[0.06] text-white/45"
                )}
              >
                {chip.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
