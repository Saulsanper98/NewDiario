"use client";

import { useMemo } from "react";
import { BarChart3, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import { LogEntryPollResponseScope } from "@/app/generated/prisma/enums";
import type { ThemeMode } from "@/lib/theme";
import type { PollCreateBody } from "@/lib/log-entry-poll-create";

export type DeptMemberOption = { id: string; name: string; image: string | null };

export type LocalPollDraft = {
  id: string;
  question: string;
  allowMultiple: boolean;
  scope: LogEntryPollResponseScope;
  optionDrafts: string[];
  selectedInvitees: Set<string>;
};

function newDraftId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `poll-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function emptyPollDraft(): LocalPollDraft {
  return {
    id: newDraftId(),
    question: "",
    allowMultiple: false,
    scope: LogEntryPollResponseScope.DEPARTMENT_ALL,
    optionDrafts: ["", ""],
    selectedInvitees: new Set(),
  };
}

export function serializePollDrafts(drafts: LocalPollDraft[]): PollCreateBody[] {
  const out: PollCreateBody[] = [];
  for (const d of drafts) {
    const labels = d.optionDrafts.map((s) => s.trim()).filter(Boolean);
    if (d.question.trim().length < 3 || labels.length < 2) continue;
    if (
      d.scope === LogEntryPollResponseScope.SELECTED_USERS &&
      d.selectedInvitees.size === 0
    ) {
      continue;
    }
    out.push({
      question: d.question.trim(),
      allowMultiple: d.allowMultiple,
      responseScope: d.scope,
      optionLabels: labels,
      inviteeUserIds:
        d.scope === LogEntryPollResponseScope.SELECTED_USERS
          ? [...d.selectedInvitees]
          : undefined,
    });
  }
  return out;
}

function formLabelClass(t: ThemeMode): string {
  return t === "light"
    ? "text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.14em]"
    : "text-xs font-medium text-white/60 uppercase tracking-wide";
}

interface NewLogEntryPollsSectionProps {
  theme: ThemeMode;
  departmentMembers: DeptMemberOption[];
  drafts: LocalPollDraft[];
  onChange: (next: LocalPollDraft[]) => void;
}

export function NewLogEntryPollsSection({
  theme,
  departmentMembers,
  drafts,
  onChange,
}: NewLogEntryPollsSectionProps) {
  const sortedMembers = useMemo(
    () => [...departmentMembers].sort((a, b) => a.name.localeCompare(b.name, "es")),
    [departmentMembers]
  );

  function updateDraft(id: string, patch: Partial<Omit<LocalPollDraft, "id">>) {
    onChange(drafts.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  function removeDraft(id: string) {
    onChange(drafts.filter((d) => d.id !== id));
  }

  return (
    <div
      className={cn(
        "rounded-2xl border p-5 sm:p-6 shadow-sm",
        theme === "light"
          ? "border-white/50 bg-white/42 backdrop-blur-xl shadow-[0_4px_28px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.8)]"
          : "border-white/[0.09] bg-gradient-to-b from-white/[0.055] to-white/[0.02] shadow-black/20 ring-1 ring-inset ring-white/[0.04]"
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-start justify-between gap-4 border-b pb-4",
          theme === "light" ? "border-zinc-200/70" : "border-white/[0.06]"
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-sm",
              theme === "light"
                ? "border-[#c4ae16]/35 bg-amber-50/90 shadow-amber-900/5"
                : "border-[#ffeb66]/28 bg-[#ffeb66]/[0.09] shadow-[#ffeb66]/5"
            )}
          >
            <BarChart3
              className={cn(
                "h-[18px] w-[18px]",
                theme === "light" ? "text-amber-800/90" : "text-[#ffeb66]"
              )}
              aria-hidden
            />
          </span>
          <div className="min-w-0 space-y-1">
            <h3
              className={cn(
                "text-[15px] font-semibold tracking-tight",
                theme === "light" ? "text-zinc-900" : "text-white"
              )}
            >
              Encuestas{" "}
              <span
                className={cn(
                  "font-normal",
                  theme === "light" ? "text-zinc-400" : "text-white/40"
                )}
              >
                (opcional)
              </span>
            </h3>
            <p
              className={cn(
                "max-w-xl text-[13px] leading-relaxed",
                theme === "light" ? "text-zinc-500" : "text-white/42"
              )}
            >
              Publica encuestas con o sin texto en el cuerpo. Si el título va vacío o muy corto,
              usaremos la pregunta de la primera encuesta como título.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "shrink-0 border-dashed",
            theme === "light"
              ? "border-zinc-300/90 text-zinc-700 hover:bg-zinc-100/80"
              : "border-[#ffeb66]/35 text-[#ffeb66]/95 hover:bg-[#ffeb66]/10"
          )}
          onClick={() => onChange([...drafts, emptyPollDraft()])}
        >
          <Plus className="h-3.5 w-3.5" />
          Añadir encuesta
        </Button>
      </div>

      <div className={cn("mt-4", drafts.length > 0 && "mt-5")}>
        {drafts.length === 0 ? (
          <div
            className={cn(
              "rounded-xl border border-dashed px-4 py-8 text-center",
              theme === "light"
                ? "border-zinc-200/90 bg-zinc-50/50"
                : "border-white/[0.1] bg-black/15"
            )}
          >
            <BarChart3
              className={cn(
                "mx-auto mb-2 h-8 w-8 opacity-25",
                theme === "light" ? "text-zinc-400" : "text-white"
              )}
              aria-hidden
            />
            <p className={cn("text-sm", theme === "light" ? "text-zinc-500" : "text-white/38")}>
              Aún no hay encuestas en esta entrada.
            </p>
            <p className={cn("mt-1 text-xs", theme === "light" ? "text-zinc-400" : "text-white/28")}>
              Usa el botón de arriba para añadir la primera.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {drafts.map((d, index) => (
              <div
                key={d.id}
                className={cn(
                  "overflow-hidden rounded-2xl border shadow-md",
                  theme === "light"
                    ? "border-zinc-200/90 bg-white/70 shadow-zinc-900/[0.04]"
                    : "border-white/[0.09] bg-black/25 shadow-black/30 ring-1 ring-inset ring-white/[0.03]"
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-between gap-2 border-b px-4 py-3 sm:px-5",
                    theme === "light" ? "border-zinc-200/70 bg-zinc-50/60" : "border-white/[0.06] bg-white/[0.03]"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "flex h-7 min-w-[1.75rem] items-center justify-center rounded-lg text-xs font-semibold tabular-nums",
                        theme === "light"
                          ? "bg-amber-100/90 text-amber-950 ring-1 ring-amber-200/80"
                          : "bg-[#ffeb66]/15 text-[#ffeb66] ring-1 ring-[#ffeb66]/25"
                      )}
                    >
                      {index + 1}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-medium uppercase tracking-wide",
                        theme === "light" ? "text-zinc-500" : "text-white/45"
                      )}
                    >
                      Borrador de encuesta
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDraft(d.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
                      theme === "light"
                        ? "text-zinc-500 hover:bg-red-50 hover:text-red-600"
                        : "text-white/40 hover:bg-red-500/10 hover:text-red-300"
                    )}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Quitar
                  </button>
                </div>

                <div className="space-y-5 p-4 sm:p-5">
                  <Input
                    label="Pregunta"
                    value={d.question}
                    onChange={(e) => updateDraft(d.id, { question: e.target.value })}
                    maxLength={500}
                    placeholder="Ej. ¿Confirmamos el cambio de ventana de mantenimiento?"
                  />

                  <div
                    className={cn(
                      "rounded-xl border p-4",
                      theme === "light"
                        ? "border-zinc-200/70 bg-zinc-50/40"
                        : "border-white/[0.07] bg-white/[0.02]"
                    )}
                  >
                    <p className={cn("mb-3", formLabelClass(theme))}>¿Quién puede responder?</p>
                    <div className="space-y-2">
                      <label
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                          theme === "light"
                            ? d.scope === LogEntryPollResponseScope.DEPARTMENT_ALL
                              ? "border-amber-300/70 bg-amber-50/50"
                              : "border-transparent hover:border-zinc-200/80 hover:bg-white/60"
                            : d.scope === LogEntryPollResponseScope.DEPARTMENT_ALL
                              ? "border-[#ffeb66]/35 bg-[#ffeb66]/[0.07]"
                              : "border-transparent hover:border-white/10 hover:bg-white/[0.03]"
                        )}
                      >
                        <input
                          type="radio"
                          name={`poll-scope-${d.id}`}
                          className="mt-0.5 accent-[#ffeb66]"
                          checked={d.scope === LogEntryPollResponseScope.DEPARTMENT_ALL}
                          onChange={() =>
                            updateDraft(d.id, { scope: LogEntryPollResponseScope.DEPARTMENT_ALL })
                          }
                        />
                        <span className={cn("text-sm", theme === "light" ? "text-zinc-700" : "text-white/75")}>
                          <strong className={theme === "light" ? "text-zinc-900" : "text-white"}>
                            Todo el departamento
                          </strong>
                          <span className={theme === "light" ? "text-zinc-500" : "text-white/45"}>
                            {" "}
                            — miembros activos con acceso a la bitácora.
                          </span>
                        </span>
                      </label>
                      <label
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                          theme === "light"
                            ? d.scope === LogEntryPollResponseScope.SELECTED_USERS
                              ? "border-amber-300/70 bg-amber-50/50"
                              : "border-transparent hover:border-zinc-200/80 hover:bg-white/60"
                            : d.scope === LogEntryPollResponseScope.SELECTED_USERS
                              ? "border-[#ffeb66]/35 bg-[#ffeb66]/[0.07]"
                              : "border-transparent hover:border-white/10 hover:bg-white/[0.03]"
                        )}
                      >
                        <input
                          type="radio"
                          name={`poll-scope-${d.id}`}
                          className="mt-0.5 accent-[#ffeb66]"
                          checked={d.scope === LogEntryPollResponseScope.SELECTED_USERS}
                          onChange={() =>
                            updateDraft(d.id, { scope: LogEntryPollResponseScope.SELECTED_USERS })
                          }
                        />
                        <span className={cn("text-sm", theme === "light" ? "text-zinc-700" : "text-white/75")}>
                          <strong className={theme === "light" ? "text-zinc-900" : "text-white"}>
                            Solo compañeros elegidos
                          </strong>
                          <span className={theme === "light" ? "text-zinc-500" : "text-white/45"}>
                            {" "}
                            — reciben notificación.
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>

                  {d.scope === LogEntryPollResponseScope.SELECTED_USERS && (
                    <div
                      className={cn(
                        "max-h-48 space-y-1 overflow-y-auto rounded-xl border p-3 sm:grid sm:max-h-none sm:grid-cols-2 sm:gap-1.5 sm:space-y-0",
                        theme === "light"
                          ? "border-zinc-200/80 bg-white/60"
                          : "border-white/[0.08] bg-black/20"
                      )}
                    >
                      <p
                        className={cn(
                          "mb-1 text-[10px] font-medium uppercase tracking-wide sm:col-span-2",
                          theme === "light" ? "text-zinc-400" : "text-white/38"
                        )}
                      >
                        Miembros del departamento
                      </p>
                      {sortedMembers.length === 0 ? (
                        <p className="text-xs text-white/40 sm:col-span-2">No hay miembros listados.</p>
                      ) : (
                        sortedMembers.map((m) => {
                          const checked = d.selectedInvitees.has(m.id);
                          return (
                            <label
                              key={m.id}
                              className={cn(
                                "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors",
                                theme === "light"
                                  ? checked
                                    ? "bg-amber-50/90 ring-1 ring-amber-200/80"
                                    : "hover:bg-zinc-100/80"
                                  : checked
                                    ? "bg-white/[0.06] ring-1 ring-[#ffeb66]/20"
                                    : "hover:bg-white/[0.04]"
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                className="rounded border-white/25 accent-[#ffeb66]"
                                onChange={() => {
                                  const next = new Set(d.selectedInvitees);
                                  if (next.has(m.id)) next.delete(m.id);
                                  else next.add(m.id);
                                  updateDraft(d.id, { selectedInvitees: next });
                                }}
                              />
                              <Avatar name={m.name} image={m.image} size="xs" />
                              <span className="truncate">{m.name}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  )}

                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                      theme === "light"
                        ? "border-zinc-200/60 bg-zinc-50/30 hover:border-zinc-300/80"
                        : "border-white/[0.07] bg-white/[0.02] hover:border-white/12"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={d.allowMultiple}
                      className="rounded border-white/25 accent-[#ffeb66]"
                      onChange={(e) => updateDraft(d.id, { allowMultiple: e.target.checked })}
                    />
                    <span className={theme === "light" ? "text-zinc-700" : "text-white/70"}>
                      Permitir <strong className={theme === "light" ? "text-zinc-900" : "text-white"}>varias</strong>{" "}
                      opciones a la vez
                    </span>
                  </label>

                  <div
                    className={cn(
                      "rounded-xl border p-4",
                      theme === "light"
                        ? "border-zinc-200/70 bg-zinc-50/30"
                        : "border-white/[0.07] bg-white/[0.02]"
                    )}
                  >
                    <p className={cn("mb-3", formLabelClass(theme))}>Opciones de respuesta</p>
                    <div className="space-y-2.5">
                      {d.optionDrafts.map((val, i) => (
                        <Input
                          key={i}
                          value={val}
                          onChange={(e) => {
                            const next = [...d.optionDrafts];
                            next[i] = e.target.value;
                            updateDraft(d.id, { optionDrafts: next });
                          }}
                          placeholder={`Opción ${i + 1}`}
                          maxLength={280}
                        />
                      ))}
                    </div>
                    {d.optionDrafts.length < 10 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "mt-2 -ml-1 text-xs",
                          theme === "light" ? "text-zinc-600" : "text-white/45"
                        )}
                        onClick={() =>
                          updateDraft(d.id, { optionDrafts: [...d.optionDrafts, ""] })
                        }
                      >
                        + Añadir opción
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
