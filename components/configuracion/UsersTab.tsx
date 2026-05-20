"use client";

import { useState, useMemo, useCallback, Fragment } from "react";
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
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { FocusPicker } from "@/components/profile/FocusPicker";
import { UserProfilePopover } from "@/components/user/UserProfilePopover";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
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
  IMAGE_UPLOAD_HINT,
  validateProfileImageFile,
} from "@/lib/upload-file";
import { isPlatformOwnerEmail } from "@/lib/platform-owner";

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

  const colCount = readOnly ? 4 : 5;

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

  const filtered = useMemo(
    () =>
      users.filter(
        (u) =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase())
      ),
    [users, search]
  );

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
        const msg =
          typeof data?.error === "string"
            ? data.error
            : "No se pudo actualizar el usuario";
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

  function renderUserTableRow(user: ConfigPageUser, rowKey: string) {
    const bannerUrl = user.profileBanner?.trim();
    const bannerFocusX = user.bannerFocusX ?? 50;
    const bannerFocusY = user.bannerFocusY ?? 50;
    const rowStyle: React.CSSProperties | undefined = bannerUrl
      ? {
          backgroundImage: `linear-gradient(90deg, rgba(10,15,30,0.92) 0%, rgba(10,15,30,0.5) 35%, rgba(10,15,30,0.4) 65%, rgba(10,15,30,0.92) 100%), url(${bannerUrl})`,
          backgroundRepeat: "no-repeat, no-repeat",
          backgroundSize: "cover, cover",
          backgroundPosition: `center, ${bannerFocusX}% ${bannerFocusY}%`,
          // Mejor renderizado del navegador al escalar fotos/gifs.
          imageRendering: "auto",
        }
      : undefined;
    return (
      <tr
        key={rowKey}
        className={cn(
          "user-row border-b border-white/6 transition-colors hover:brightness-110",
          bannerUrl ? "h-16" : ""
        )}
        style={rowStyle}
      >
        <td className="user-row-banner-cell relative px-4 py-3 align-middle">
          <div className="relative z-[1] flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => openAvatarPreview(user)}
              disabled={!user.image}
              title={user.image ? "Ver foto" : undefined}
              className={cn(
                "shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffeb66]/50",
                user.image && "cursor-zoom-in"
              )}
            >
              <Avatar
                name={user.name}
                image={user.image}
                focusX={user.imageFocusX}
                focusY={user.imageFocusY}
                size="sm"
              />
            </button>
            <div>
              <UserProfilePopover
                userId={user.id}
                name={user.name}
                email={user.email}
                image={user.image}
                profileBanner={user.profileBanner}
                nameClassName="text-sm font-medium text-white"
              />
              <p className="text-xs text-white/40">{user.email}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-2.5 align-middle">
          <div className="flex flex-wrap gap-1 items-center">
            {user.departments.slice(0, 2).map((ud) => (
              <span
                key={ud.id}
                className="text-xs px-1.5 py-0.5 rounded border"
                style={{
                  borderColor: withAlpha(ud.department.accentColor, "30"),
                  color: accent(ud.department.accentColor),
                  backgroundColor: withAlpha(ud.department.accentColor, "10"),
                }}
              >
                {ud.department.name}
              </span>
            ))}
            {user.departments.length > 2 && (
              <span className="text-xs text-white/30">
                +{user.departments.length - 2}
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-2.5 align-middle">
          <div className="flex items-center gap-1.5">
            {isPlatformOwnerEmail(user.email) ? (
              <Shield className="w-3 h-3 text-[#ffeb66]" aria-label="Propietario de la plataforma" />
            ) : user.role === "SUPERADMIN" ? (
              <Shield className="w-3 h-3 text-violet-400" />
            ) : null}
            <span className="text-xs text-white/60">
              {isPlatformOwnerEmail(user.email)
                ? "Propietario"
                : ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}
            </span>
          </div>
        </td>
        <td className="px-4 py-2.5 align-middle">
          <Badge variant={user.isActive ? "success" : "error"} size="sm">
            {user.isActive ? (
              <CheckCircle className="w-3 h-3" />
            ) : (
              <XCircle className="w-3 h-3" />
            )}
            {user.isActive ? "Activo" : "Inactivo"}
          </Badge>
        </td>
        {!readOnly && (
          <td className="px-4 py-2.5 align-middle">
            {canEditUserRow(user) ? (
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="ghost" size="sm" type="button" onClick={() => openEdit(user)}>
                Editar
              </Button>
              {user.id !== currentUser.id && (
                <Button
                  variant="danger"
                  size="sm"
                  type="button"
                  onClick={() => toggleActive(user.id, user.isActive)}
                >
                  {user.isActive ? "Desactivar" : "Activar"}
                </Button>
              )}
              {isPlatformOwner &&
                user.id !== currentUser.id &&
                user.role === "SUPERADMIN" &&
                !isPlatformOwnerEmail(user.email) &&
                user.canManageSuperAdmins && (
                  <span
                    className="inline-flex items-center gap-1 rounded-md border border-[#ffeb66]/30 bg-[#ffeb66]/[0.08] px-1.5 py-0.5 text-[10px] font-medium text-[#ffeb66]"
                    title="Este SuperAdmin tiene permiso para asignar o quitar SuperAdmin a otros"
                  >
                    <Shield className="w-3 h-3" />
                    Gestiona SA
                  </span>
                )}
              {isPlatformOwner && user.id !== currentUser.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setDeleteTarget(user);
                    setDeleteConfirmName("");
                  }}
                  title="Eliminar usuario"
                  className="text-red-400/60 hover:text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
            ) : (
              <span className="text-xs text-white/25" title="Cuenta del propietario">
                —
              </span>
            )}
          </td>
        )}
      </tr>
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
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar usuarios..."
            className="config-users-search w-full bg-white/5 border border-white/8 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#ffeb66]/40"
          />
        </div>
        {!readOnly && (
          <>
            <Button variant="secondary" size="md" type="button" onClick={exportCSV} title="Exportar CSV">
              <Download className="w-3.5 h-3.5" />
            </Button>
            <Button variant="primary" size="md" type="button" onClick={openModal}>
              <UserPlus className="w-3.5 h-3.5" />
              Nuevo usuario
            </Button>
          </>
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
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className={cn(
                "h-9 rounded-lg px-3 text-sm focus:outline-none",
                L
                  ? "border border-zinc-200 bg-white text-zinc-900 focus:border-amber-400/80 focus:ring-1 focus:ring-amber-400/30"
                  : "bg-white/5 border border-white/10 text-white focus:border-[#ffeb66]/50 focus:bg-white/7"
              )}
            >
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
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
            <select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value as Role)}
              className={cn(
                "h-9 rounded-lg px-3 text-sm focus:outline-none",
                L
                  ? "border border-zinc-200 bg-white text-zinc-900 focus:border-amber-400/80 focus:ring-1 focus:ring-amber-400/30"
                  : "bg-white/5 border border-white/10 text-white focus:border-[#ffeb66]/50 focus:bg-white/7"
              )}
            >
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
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

      <div className="config-users-table-shell glass rounded-xl overflow-hidden flex flex-col max-h-[min(70vh,560px)]">
        {filtered.length === 0 ? (
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
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full">
            <thead className="config-table-thead sticky top-0 z-10 bg-[#0a0f1e]/95 backdrop-blur-sm shadow-[0_1px_0_rgba(255,255,255,0.06)]">
              <tr className="border-b border-white/8">
                <th
                  scope="col"
                  className="text-left px-4 py-2.5 align-middle text-xs font-medium text-white/40 leading-tight"
                >
                  Usuario
                </th>
                <th
                  scope="col"
                  className="text-left px-4 py-2.5 align-middle text-xs font-medium text-white/40 leading-tight"
                >
                  Departamento(s)
                </th>
                <th
                  scope="col"
                  className="text-left px-4 py-2.5 align-middle text-xs font-medium text-white/40 leading-tight"
                >
                  Rol
                </th>
                <th
                  scope="col"
                  className="text-left px-4 py-2.5 align-middle text-xs font-medium text-white/40 leading-tight"
                >
                  Estado
                </th>
                {!readOnly && (
                  <th scope="col" className="px-4 py-2.5 align-middle" aria-label="Acciones" />
                )}
              </tr>
            </thead>
            <tbody>
              {groupedBodyEmpty ? (
                filtered.map((user) => renderUserTableRow(user, user.id))
              ) : (
                <>
                  {usersByDepartmentSections.map(({ department, users: list }) => (
                    <Fragment key={department.id}>
                      <tr className="border-b border-white/8 bg-white/[0.045]">
                        <td colSpan={colCount} className="px-4 py-2 align-middle">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: accent(department.accentColor) }}
                            />
                            <span className="text-xs font-semibold text-white/85 tracking-wide">
                              {department.name}
                            </span>
                            <span className="text-[10px] text-white/35 font-medium tabular-nums">
                              {list.length} {list.length === 1 ? "usuario" : "usuarios"}
                            </span>
                            <span className="text-[10px] text-white/25">
                              ·{" "}
                              {department._count.members === 1
                                ? "1 miembro activo"
                                : `${department._count.members} miembros activos`}{" "}
                              en el departamento
                            </span>
                          </div>
                        </td>
                      </tr>
                      {list.map((user) =>
                        renderUserTableRow(user, `${department.id}:${user.id}`)
                      )}
                    </Fragment>
                  ))}
                  {usersWithoutDepartment.length > 0 && (
                    <Fragment key="__sin-depto">
                      <tr className="border-b border-white/8 bg-amber-500/[0.07]">
                        <td colSpan={colCount} className="px-4 py-2 align-middle">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-amber-200/90 tracking-wide">
                              Sin departamento asignado
                            </span>
                            <span className="text-[10px] text-white/35 font-medium tabular-nums">
                              {usersWithoutDepartment.length}{" "}
                              {usersWithoutDepartment.length === 1 ? "usuario" : "usuarios"}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {usersWithoutDepartment.map((user) =>
                        renderUserTableRow(user, `__sin-depto:${user.id}`)
                      )}
                    </Fragment>
                  )}
                </>
              )}
            </tbody>
          </table>
          </div>
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
