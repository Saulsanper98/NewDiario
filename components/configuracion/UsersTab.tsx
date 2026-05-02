"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, UserPlus, Shield, CheckCircle, XCircle } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ROLE_LABELS } from "@/lib/utils";
import toast from "react-hot-toast";
import type { SessionUser } from "@/lib/auth/types";
import type { Role } from "@/app/generated/prisma/enums";
import type { ConfigPageDepartment, ConfigPageUser } from "@/lib/types/config";
import { useAccentForUi } from "@/lib/hooks/useAccentForUi";

interface UsersTabProps {
  users: ConfigPageUser[];
  departments: ConfigPageDepartment[];
  currentUser: SessionUser;
  isSuperAdmin: boolean;
}

export function UsersTab({
  users,
  departments,
  currentUser,
  isSuperAdmin,
}: UsersTabProps) {
  const { accent, withAlpha } = useAccentForUi();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [role, setRole] = useState<Role>("OPERATOR");
  const [checkedDeptIds, setCheckedDeptIds] = useState<Set<string>>(new Set());
  const [defaultDeptId, setDefaultDeptId] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<Role>("OPERATOR");
  const [editPassword, setEditPassword] = useState("");
  const [editSaving, setEditSaving] = useState(false);

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

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  function openEdit(user: (typeof users)[number]) {
    setEditId(user.id);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role as Role);
    setEditPassword("");
    setEditOpen(true);
  }

  async function handleEditUser(e: React.FormEvent) {
    e.preventDefault();
    if (editRole === "SUPERADMIN" && !isSuperAdmin) {
      toast.error("No puedes asignar rol SuperAdmin");
      return;
    }
    setEditSaving(true);
    try {
      const body: Record<string, string> = {
        name: editName.trim(),
        email: editEmail.trim(),
        role: editRole,
      };
      if (editPassword.trim()) body.password = editPassword;
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
    if (role === "SUPERADMIN" && !isSuperAdmin) {
      toast.error("No puedes asignar rol SuperAdmin");
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

  const roleOptions: Role[] = isSuperAdmin
    ? ["OPERATOR", "ADMIN", "SUPERADMIN"]
    : ["OPERATOR", "ADMIN"];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar usuarios..."
            className="w-full bg-white/5 border border-white/8 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#ffeb66]/40"
          />
        </div>
        <Button variant="primary" size="md" type="button" onClick={openModal}>
          <UserPlus className="w-3.5 h-3.5" />
          Nuevo usuario
        </Button>
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title="Nuevo usuario"
        description="El usuario podrá iniciar sesión con el email y la contraseña indicados."
        size="md"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <Input
            label="Nombre completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="off"
          />
          <Input
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <Input
            label="Confirmar contraseña"
            type="password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-white/60 uppercase tracking-wide">
              Rol global
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ffeb66]/50"
            >
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-white/35">
              El mismo rol se aplicará en cada departamento seleccionado.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/3 p-3 space-y-2">
            <p className="text-xs font-medium text-white/60 uppercase tracking-wide">
              Departamentos
            </p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {assignableDepartments.map((d) => {
                const checked = checkedDeptIds.has(d.id);
                return (
                  <label
                    key={d.id}
                    className="flex items-center gap-2.5 cursor-pointer text-sm text-white/70 hover:text-white/90"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDept(d.id)}
                      className="rounded border-white/20 bg-white/5 accent-[#ffeb66]"
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
            <p className="text-[11px] text-white/35">
              Marca el círculo del departamento que quieras como predeterminado al iniciar sesión.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={closeModal}>
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
            label="Nombre completo"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
            autoComplete="name"
          />
          <Input
            label="Email"
            type="email"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
            required
            autoComplete="off"
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-white/60 uppercase tracking-wide">
              Rol global
            </label>
            <select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value as Role)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ffeb66]/50"
            >
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Nueva contraseña (opcional)"
            type="password"
            value={editPassword}
            onChange={(e) => setEditPassword(e.target.value)}
            minLength={8}
            autoComplete="new-password"
            placeholder="Dejar vacío para no cambiar"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={editSaving}>
              Guardar
            </Button>
          </div>
        </form>
      </Modal>

      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/8">
              <th className="text-left px-4 py-3 text-xs font-medium text-white/40">
                Usuario
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-white/40">
                Departamento(s)
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-white/40">
                Rol
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-white/40">
                Estado
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr
                key={user.id}
                className="border-b border-white/4 hover:bg-white/2 transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={user.name} image={user.image} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-white">
                        {user.name}
                      </p>
                      <p className="text-xs text-white/40">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
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
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {user.role === "SUPERADMIN" && (
                      <Shield className="w-3 h-3 text-[#ffeb66]" />
                    )}
                    <span className="text-xs text-white/60">
                      {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={user.isActive ? "success" : "error"}
                    size="sm"
                  >
                    {user.isActive ? (
                      <CheckCircle className="w-3 h-3" />
                    ) : (
                      <XCircle className="w-3 h-3" />
                    )}
                    {user.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {user.id !== currentUser.id && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => openEdit(user)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        type="button"
                        onClick={() => toggleActive(user.id, user.isActive)}
                      >
                        {user.isActive ? "Desactivar" : "Activar"}
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-8 text-center text-sm text-white/30">
            No se encontraron usuarios
          </div>
        )}
      </div>
    </div>
  );
}
