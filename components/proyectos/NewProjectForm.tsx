"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { FolderKanban, Users, FolderTree } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { PRIORITY_LABELS } from "@/lib/utils";
import { useAccentForUi } from "@/lib/hooks/useAccentForUi";

const schema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres").max(200),
  description: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  endDate: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Colleague {
  id: string;
  name: string;
  image: string | null;
}

interface NewProjectFormProps {
  departmentId: string;
  departmentName: string;
  departmentAccent: string;
  currentUserId: string;
  colleagues: Colleague[];
  parentId?: string | null;
  parentName?: string;
}

export function NewProjectForm({
  departmentId,
  departmentName,
  departmentAccent,
  currentUserId,
  colleagues,
  parentId,
  parentName,
}: NewProjectFormProps) {
  const { accent } = useAccentForUi();
  const router = useRouter();
  const [extraMemberIds, setExtraMemberIds] = useState<Set<string>>(new Set());

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      priority: "MEDIUM",
      description: "",
      endDate: "",
    },
  });

  const others = colleagues.filter((c) => c.id !== currentUserId);

  function toggleMember(id: string) {
    setExtraMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onSubmit(data: FormData) {
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          description: data.description?.trim() || undefined,
          departmentId,
          priority: data.priority,
          endDate: data.endDate?.trim() || undefined,
          memberIds: [...extraMemberIds],
          parentId: parentId ?? undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg =
          typeof err?.error === "string"
            ? err.error
            : "No se pudo crear el proyecto";
        throw new Error(msg);
      }

      const project = await res.json();
      toast.success("Proyecto creado");
      router.push(`/proyectos/${project.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al crear el proyecto");
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-[#ffeb66]/10 border border-[#ffeb66]/15">
          {parentId ? <FolderTree className="w-6 h-6 text-[#ffeb66]" /> : <FolderKanban className="w-6 h-6 text-[#ffeb66]" />}
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">
            {parentId ? "Nuevo subproyecto" : "Nuevo proyecto"}
          </h1>
          {parentName && (
            <p className="text-xs text-[#ffeb66]/60 mt-0.5 flex items-center gap-1">
              <FolderTree className="w-3 h-3" />
              Dentro de: {parentName}
            </p>
          )}
          <p className="text-sm text-white/40 mt-1 flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: accent(departmentAccent) }}
            />
            Departamento: <span className="text-white/60">{departmentName}</span>
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Input
          label="Nombre del proyecto"
          placeholder="Ej. Renovación de red planta 2"
          error={errors.name?.message}
          {...register("name")}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-white/60 uppercase tracking-wide">
            Descripción
          </label>
          <textarea
            {...register("description")}
            rows={5}
            placeholder="Objetivos, alcance o contexto (opcional)..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#ffeb66]/50 focus:bg-white/7 focus:ring-1 focus:ring-[#ffeb66]/20 transition-all duration-200 resize-y min-h-[120px]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-white/60 uppercase tracking-wide">
              Prioridad
            </label>
            <select
              {...register("priority")}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ffeb66]/50"
            >
              {(Object.keys(PRIORITY_LABELS) as Array<keyof typeof PRIORITY_LABELS>).map(
                (k) => (
                  <option key={k} value={k}>
                    {PRIORITY_LABELS[k]}
                  </option>
                )
              )}
            </select>
          </div>

          <Input
            label="Fecha objetivo (opcional)"
            type="date"
            {...register("endDate")}
          />
        </div>

        {others.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-white/40" />
              <span className="text-sm font-medium text-white/70">
                Miembros del equipo
              </span>
            </div>
            <p className="text-xs text-white/35 mb-3">
              Tú serás el responsable. Añade compañeros del mismo departamento.
            </p>
            <div className="flex flex-wrap gap-2">
              {others.map((c) => {
                const on = extraMemberIds.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleMember(c.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border transition-all duration-200 ${
                      on
                        ? "border-[#ffeb66]/30 bg-[#ffeb66]/8 text-[#ffeb66]"
                        : "border-white/10 bg-white/4 text-white/50 hover:border-white/20 hover:text-white/70"
                    }`}
                  >
                    <Avatar name={c.name} image={c.image} size="xs" />
                    {c.name}
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push("/proyectos")}
          >
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            Crear proyecto
          </Button>
        </div>
      </form>
    </div>
  );
}
