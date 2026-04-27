"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { X, AlertTriangle } from "lucide-react";
import { RichEditor } from "./RichEditor";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { getCurrentShift, SHIFT_LABELS, TYPE_LABELS } from "@/lib/utils";

const schema = z.object({
  title: z.string().min(3, "Mínimo 3 caracteres"),
  shift: z.enum(["MORNING", "AFTERNOON", "NIGHT"]),
  type: z.enum([
    "INCIDENCIA",
    "INFORMATIVO",
    "URGENTE",
    "MANTENIMIENTO",
    "SIN_NOVEDADES",
  ]),
  requiresFollowup: z.boolean(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
});

type FormData = z.infer<typeof schema>;

export type EditingLogEntry = {
  id: string;
  title: string;
  content: string;
  type: FormData["type"];
  shift: FormData["shift"];
  status: FormData["status"];
  requiresFollowup: boolean;
  departmentId: string;
  tags: { name: string }[];
  shares: { departmentId: string; permission: "READ" | "READ_COMMENT" }[];
};

interface NewLogEntryFormProps {
  departmentId: string;
  allDepartments: { id: string; name: string; accentColor: string }[];
  /** Si está definido, el formulario guarda con PATCH (editar entrada existente). */
  editingEntry?: EditingLogEntry;
}

export function NewLogEntryForm({
  departmentId,
  allDepartments,
  editingEntry,
}: NewLogEntryFormProps) {
  const router = useRouter();
  const [content, setContent] = useState(editingEntry?.content ?? "");
  const [tags, setTags] = useState<string[]>(
    editingEntry?.tags.map((t) => t.name) ?? []
  );
  const [tagInput, setTagInput] = useState("");
  const [sharedWith, setSharedWith] = useState<
    { departmentId: string; permission: "READ" | "READ_COMMENT" }[]
  >(editingEntry?.shares ?? []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: editingEntry
      ? {
          title: editingEntry.title,
          shift: editingEntry.shift,
          type: editingEntry.type,
          requiresFollowup: editingEntry.requiresFollowup,
          status: editingEntry.status,
        }
      : {
          shift: getCurrentShift(),
          type: "INFORMATIVO",
          requiresFollowup: false,
          status: "PUBLISHED",
        },
  });

  const deptForEntry = editingEntry?.departmentId ?? departmentId;

  function addTag(e: React.KeyboardEvent) {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim().toLowerCase();
      if (!tags.includes(tag)) setTags([...tags, tag]);
      setTagInput("");
    }
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  function toggleShare(deptId: string) {
    const exists = sharedWith.find((s) => s.departmentId === deptId);
    if (exists) {
      setSharedWith(sharedWith.filter((s) => s.departmentId !== deptId));
    } else {
      setSharedWith([
        ...sharedWith,
        { departmentId: deptId, permission: "READ_COMMENT" },
      ]);
    }
  }

  async function onSubmit(data: FormData) {
    if (!content || content === "<p></p>") {
      toast.error("El contenido no puede estar vacío");
      return;
    }

    try {
      if (editingEntry) {
        const res = await fetch(`/api/log-entries/${editingEntry.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...data,
            content,
            tags,
            shares: sharedWith,
          }),
        });
        if (!res.ok) throw new Error();
        toast.success("Entrada actualizada");
        router.push(`/bitacora/${editingEntry.id}`);
        return;
      }

      const res = await fetch("/api/log-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          content,
          tags,
          departmentId: deptForEntry,
          shares: sharedWith,
        }),
      });

      if (!res.ok) throw new Error();
      const entry = await res.json();
      toast.success("Entrada publicada");
      router.push(`/bitacora/${entry.id}`);
    } catch {
      toast.error("Error al guardar la entrada");
    }
  }

  const otherDepts = allDepartments.filter((d) => d.id !== deptForEntry);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <h1 className="text-xl font-semibold text-white">
        {editingEntry ? "Editar entrada" : "Nueva entrada de bitácora"}
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Title */}
        <Input
          label="Título"
          placeholder="Resumen breve de la entrada..."
          error={errors.title?.message}
          {...register("title")}
        />

        {/* Type & Shift */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-white/60 uppercase tracking-wide">
              Tipo
            </label>
            <select
              {...register("type")}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ffeb66]/50"
            >
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-white/60 uppercase tracking-wide">
              Turno
            </label>
            <select
              {...register("shift")}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ffeb66]/50"
            >
              {Object.entries(SHIFT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-white/60 uppercase tracking-wide">
            Contenido
          </label>
          <RichEditor
            key={editingEntry?.id ?? "new"}
            content={content}
            onChange={setContent}
            placeholder="Describe la incidencia, novedad o información relevante..."
          />
        </div>

        {/* Tags */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-white/60 uppercase tracking-wide">
            Etiquetas
          </label>
          <div className="flex flex-wrap gap-1.5 p-2 bg-white/3 border border-white/10 rounded-lg min-h-9">
            {tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 text-xs px-2 py-0.5 bg-white/8 text-white/60 rounded-md border border-white/10"
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="text-white/30 hover:text-white/60"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={addTag}
              placeholder={tags.length === 0 ? "Añadir etiqueta (Enter)..." : ""}
              className="bg-transparent text-sm text-white/70 placeholder:text-white/25 focus:outline-none min-w-24 flex-1"
            />
          </div>
        </div>

        {/* Requires followup */}
        <Card className="p-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              {...register("requiresFollowup")}
              className="w-4 h-4 accent-[#ffeb66]"
            />
            <div>
              <p className="text-sm font-medium text-white flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
                Requiere seguimiento
              </p>
              <p className="text-xs text-white/40 mt-0.5">
                Esta entrada quedará marcada para atención posterior
              </p>
            </div>
          </label>
        </Card>

        {/* Share with departments */}
        {otherDepts.length > 0 && (
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-white/60 uppercase tracking-wide">
              Compartir con departamento(s)
            </label>
            <div className="flex flex-wrap gap-2">
              {otherDepts.map((dept) => {
                const shared = sharedWith.find(
                  (s) => s.departmentId === dept.id
                );
                return (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => toggleShare(dept.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all duration-200 border ${
                      shared
                        ? "border-[#ffeb66]/30 bg-[#ffeb66]/8 text-[#ffeb66]"
                        : "border-white/10 bg-white/4 text-white/50 hover:border-white/20 hover:text-white/70"
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: dept.accentColor }}
                    />
                    {dept.name}
                    {shared && (
                      <span className="text-[10px] text-[#ffeb66]/60">
                        (Lectura + Comentarios)
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleSubmit((data) => onSubmit({ ...data, status: "DRAFT" }))()}
            disabled={isSubmitting}
          >
            Guardar borrador
          </Button>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting}>
              {editingEntry ? "Guardar cambios" : "Publicar entrada"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
