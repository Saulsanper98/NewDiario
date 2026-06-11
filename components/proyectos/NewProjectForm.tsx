"use client";


import { isLightTheme } from "@/lib/theme";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { FolderKanban, Users, FolderTree, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Listbox } from "@/components/ui/Listbox";
import { PRIORITY_LABELS } from "@/lib/utils";
import { useAccentForUi } from "@/lib/hooks/useAccentForUi";
import { useTheme } from "@/components/layout/ThemeProvider";
import { cn } from "@/lib/utils";

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
  const { theme } = useTheme();
  const L = isLightTheme(theme);
  const { accent } = useAccentForUi();
  const router = useRouter();
  const [extraMemberIds, setExtraMemberIds] = useState<Set<string>>(new Set());

  const {
    register,
    handleSubmit,
    control,
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
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      {/* Back link */}
      <button
        type="button"
        onClick={() => router.push(parentId ? `/proyectos/${parentId}` : "/proyectos")}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs transition-colors",
          L ? "text-zinc-600 hover:text-zinc-900" : "text-white/40 hover:text-white/80"
        )}
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        {parentId ? "Volver al proyecto padre" : "Volver a proyectos"}
      </button>

      {/* Hero */}
      <section
        className={cn(
          "relative overflow-hidden rounded-2xl border px-5 py-5 sm:px-7 sm:py-6",
          L
            ? "border-black/[0.08] bg-gradient-to-br from-white/85 via-white/70 to-amber-50/55 shadow-[var(--lt-shadow-glass)]"
            : "border-white/10 bg-gradient-to-br from-white/[0.045] via-white/[0.025] to-[#ffeb66]/[0.06] shadow-[0_8px_36px_-12px_rgba(0,0,0,0.55)]"
        )}
      >
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-16 -right-24 h-56 w-56 rounded-full blur-3xl",
            L ? "bg-[#ffeb66]/35" : "bg-[#ffeb66]/12"
          )}
        />
        <div className="relative flex flex-wrap items-start gap-4">
          <div className="shrink-0">
            <div className={cn(
              "flex items-center justify-center w-12 h-12 rounded-2xl",
              L
                ? "bg-amber-100 text-amber-700 border border-amber-200"
                : "bg-[#ffeb66]/15 text-[#ffeb66] border border-[#ffeb66]/25"
            )}>
              {parentId ? <FolderTree className="w-6 h-6" /> : <FolderKanban className="w-6 h-6" />}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "mb-1 text-[10.5px] font-semibold uppercase tracking-[0.18em]",
                L ? "text-zinc-500" : "text-white/40"
              )}
            >
              {parentId ? "Subproyecto · Nuevo" : "Proyecto · Nuevo"}
            </p>
            <h1
              className={cn(
                "text-xl sm:text-2xl font-semibold leading-tight tracking-tight",
                L ? "text-zinc-900" : "text-white"
              )}
            >
              {parentId ? "Crea un subproyecto" : "Crea un nuevo proyecto"}
            </h1>
            {parentName && (
              <p className={cn(
                "mt-1.5 text-xs flex items-center gap-1.5",
                L ? "text-amber-800" : "text-[#ffeb66]/80"
              )}>
                <FolderTree className="w-3.5 h-3.5" />
                Dentro de: <span className="font-semibold">{parentName}</span>
              </p>
            )}
            <p
              className={cn(
                "mt-1.5 text-xs sm:text-sm flex items-center gap-2",
                L ? "text-zinc-600" : "text-white/55"
              )}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: accent(departmentAccent) }}
              />
              Departamento:
              <span className={cn(
                "font-semibold",
                L ? "text-zinc-900" : "text-white/80"
              )}>{departmentName}</span>
            </p>
          </div>
        </div>
      </section>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className={cn(
          "rounded-2xl border p-5 sm:p-6 space-y-5",
          L
            ? "border-zinc-200 bg-white shadow-sm"
            : "border-white/10 bg-white/[0.025]"
        )}
      >
        <Input
          label="Nombre del proyecto"
          placeholder="Ej. Renovación de red planta 2"
          error={errors.name?.message}
          {...register("name")}
        />

        <div className="flex flex-col gap-1.5">
          <label className={cn(
            "text-xs font-medium uppercase tracking-wide",
            L ? "text-zinc-700" : "text-white/60"
          )}>
            Descripción
          </label>
          <textarea
            {...register("description")}
            rows={5}
            placeholder="Objetivos, alcance o contexto (opcional)..."
            className={cn(
              "w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 transition-all duration-200 resize-y min-h-[120px]",
              L
                ? "bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-amber-400 focus:bg-white focus:ring-amber-300"
                : "bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:border-[#ffeb66]/50 focus:bg-white/7 focus:ring-[#ffeb66]/20"
            )}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className={cn(
              "text-xs font-medium uppercase tracking-wide",
              L ? "text-zinc-700" : "text-white/60"
            )}>
              Prioridad
            </label>
            <Controller
              control={control}
              name="priority"
              render={({ field }) => (
                <Listbox
                  value={field.value as string}
                  onChange={(v) =>
                    field.onChange(v as "HIGH" | "MEDIUM" | "LOW")
                  }
                  options={(
                    Object.keys(PRIORITY_LABELS) as Array<keyof typeof PRIORITY_LABELS>
                  ).map((k) => ({ value: k, label: PRIORITY_LABELS[k] }))}
                  ariaLabel="Prioridad"
                  light={L}
                />
              )}
            />
          </div>

          <Input
            label="Fecha objetivo (opcional)"
            type="date"
            {...register("endDate")}
          />
        </div>

        {others.length > 0 && (
          <Card className="p-4" light={L}>
            <div className="flex items-center gap-2 mb-3">
              <Users className={cn(
                "w-4 h-4",
                L ? "text-zinc-600" : "text-white/40"
              )} />
              <span className={cn(
                "text-sm font-medium",
                L ? "text-zinc-900" : "text-white/70"
              )}>
                Miembros del equipo
              </span>
              {extraMemberIds.size > 0 && (
                <span className={cn(
                  "ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium tabular-nums",
                  L ? "bg-amber-100 text-amber-800" : "bg-[#ffeb66]/15 text-[#ffeb66]"
                )}>
                  {extraMemberIds.size} seleccionado{extraMemberIds.size !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <p className={cn(
              "text-xs mb-3",
              L ? "text-zinc-600" : "text-white/35"
            )}>
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
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border transition-all duration-200",
                      on
                        ? L
                          ? "border-amber-300 bg-amber-50 text-amber-800"
                          : "border-[#ffeb66]/30 bg-[#ffeb66]/8 text-[#ffeb66]"
                        : L
                          ? "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                          : "border-white/10 bg-white/4 text-white/50 hover:border-white/20 hover:text-white/70"
                    )}
                  >
                    <Avatar name={c.name} image={c.image} size="xs" />
                    {c.name}
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        <div className={cn(
          "flex items-center justify-end gap-3 pt-3 border-t",
          L ? "border-zinc-100" : "border-white/8"
        )}>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push(parentId ? `/proyectos/${parentId}` : "/proyectos")}
          >
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            {parentId ? "Crear subproyecto" : "Crear proyecto"}
          </Button>
        </div>
      </form>
    </div>
  );
}
