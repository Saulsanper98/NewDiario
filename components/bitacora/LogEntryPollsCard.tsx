"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  BarChart3,
  Plus,
  Users,
  UserRound,
  Lock,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth/types";
import type { LogEntryDetailPage } from "@/lib/types/log-entry-detail";
import { Avatar } from "@/components/ui/Avatar";
import { useTheme } from "@/components/layout/ThemeProvider";
import { LogEntryPollResponseScope } from "@/app/generated/prisma/enums";

type PollRow = NonNullable<LogEntryDetailPage["polls"]>[number];

export type LogDeptMember = { id: string; name: string; image: string | null };

function userMayVote(
  user: SessionUser,
  entryDeptId: string,
  poll: Pick<PollRow, "responseScope" | "closedAt" | "invitees">
): boolean {
  if (poll.closedAt) return false;
  if (user.role === "SUPERADMIN") return true;
  if (poll.responseScope === LogEntryPollResponseScope.DEPARTMENT_ALL) {
    return user.departments.some((d) => d.id === entryDeptId);
  }
  return poll.invitees.some((i) => i.userId === user.id);
}

function uniqueVotersForOption(poll: PollRow, optionId: string): number {
  const ids = new Set<string>();
  for (const r of poll.responses) {
    if (r.optionId === optionId) ids.add(r.userId);
  }
  return ids.size;
}

function totalUniqueVoters(poll: PollRow): number {
  return new Set(poll.responses.map((r) => r.userId)).size;
}

/** Una fila por persona que votó esta opción (voto múltiple puede tener varias filas mismo user — se deduplica). */
function uniqueVotersForOptionDetail(
  poll: PollRow,
  optionId: string
): { id: string; name: string; image: string | null }[] {
  const map = new Map<string, { id: string; name: string; image: string | null }>();
  for (const r of poll.responses) {
    if (r.optionId !== optionId) continue;
    if (!map.has(r.userId)) {
      map.set(r.userId, {
        id: r.user.id,
        name: r.user.name,
        image: r.user.image ?? null,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export function LogEntryPollsCard({
  entryId,
  entryTitle,
  entryDepartmentId,
  polls,
  currentUser,
  departmentMembers,
  canEditEntry,
}: {
  entryId: string;
  entryTitle: string;
  entryDepartmentId: string;
  polls: PollRow[];
  currentUser: SessionUser;
  departmentMembers: LogDeptMember[];
  canEditEntry: boolean;
}) {
  const router = useRouter();
  const { theme } = useTheme();
  const L = theme === "light";
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [votingPollId, setVotingPollId] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  /** pollId → opciones elegidas (solo encuestas allowMultiple) */
  const [multiDraft, setMultiDraft] = useState<Record<string, Set<string>>>({});

  useEffect(() => {
    const next: Record<string, Set<string>> = {};
    for (const p of polls) {
      if (!p.allowMultiple) continue;
      next[p.id] = new Set(
        p.responses.filter((r) => r.userId === currentUser.id).map((r) => r.optionId)
      );
    }
    setMultiDraft(next);
  }, [polls, currentUser.id]);

  const [question, setQuestion] = useState("");
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [scope, setScope] = useState<LogEntryPollResponseScope>(
    LogEntryPollResponseScope.DEPARTMENT_ALL
  );
  const [optionDrafts, setOptionDrafts] = useState(["", ""]);
  const [selectedInvitees, setSelectedInvitees] = useState<Set<string>>(new Set());

  function resetModal() {
    setQuestion("");
    setAllowMultiple(false);
    setScope(LogEntryPollResponseScope.DEPARTMENT_ALL);
    setOptionDrafts(["", ""]);
    setSelectedInvitees(new Set());
  }

  async function createPoll(e: React.FormEvent) {
    e.preventDefault();
    const labels = optionDrafts.map((s) => s.trim()).filter(Boolean);
    if (labels.length < 2) {
      toast.error("Añade al menos dos opciones con texto");
      return;
    }
    if (scope === LogEntryPollResponseScope.SELECTED_USERS && selectedInvitees.size === 0) {
      toast.error("Selecciona al menos un compañero");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/log-entries/${entryId}/polls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          allowMultiple,
          responseScope: scope,
          optionLabels: labels,
          inviteeUserIds:
            scope === LogEntryPollResponseScope.SELECTED_USERS
              ? [...selectedInvitees]
              : undefined,
        }),
      });
      const err = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof err?.error === "string" ? err.error : "No se pudo crear la encuesta");
        return;
      }
      toast.success("Encuesta creada");
      setModalOpen(false);
      resetModal();
      router.refresh();
    } catch {
      toast.error("Error al crear la encuesta");
    } finally {
      setSaving(false);
    }
  }

  async function vote(poll: PollRow, optionIds: string[]) {
    if (!userMayVote(currentUser, entryDepartmentId, poll)) return;
    setVotingPollId(poll.id);
    try {
      const res = await fetch(`/api/log-entries/${entryId}/polls/${poll.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionIds }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(typeof err?.error === "string" ? err.error : "No se pudo registrar el voto");
        return;
      }
      toast.success(poll.allowMultiple ? "Voto actualizado" : "Voto registrado");
      router.refresh();
    } catch {
      toast.error("Error al votar");
    } finally {
      setVotingPollId(null);
    }
  }

  async function closePoll(pollId: string) {
    setClosingId(pollId);
    try {
      const res = await fetch(`/api/log-entries/${entryId}/polls/${pollId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closed: true }),
      });
      if (!res.ok) {
        toast.error("No se pudo cerrar la encuesta");
        return;
      }
      toast.success("Encuesta cerrada");
      router.refresh();
    } catch {
      toast.error("Error al cerrar");
    } finally {
      setClosingId(null);
    }
  }

  const sortedMembers = useMemo(
    () => [...departmentMembers].sort((a, b) => a.name.localeCompare(b.name, "es")),
    [departmentMembers]
  );

  return (
    <div
      className={cn(
        "mt-7 pt-6 border-t print:hidden min-w-0 max-w-full",
        L ? "border-zinc-200/90" : "border-white/[0.08]"
      )}
    >
      {/* Mobile: header en columna (titulo y descripcion arriba, boton
          a ancho completo abajo). Antes en `flex-wrap items-center`
          el `<Button>` "Nueva encuesta" se truncaba a "+ Nu..."
          porque competia por el ancho con el bloque del titulo. */}
      <div className="flex flex-col items-stretch gap-3 mb-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
              L
                ? "border-amber-300/60 bg-amber-50"
                : "border-[#ffeb66]/25 bg-[#ffeb66]/[0.08]"
            )}
          >
            <BarChart3
              className={cn("h-4 w-4", L ? "text-amber-700" : "text-[#ffeb66]/90")}
              aria-hidden
            />
          </span>
          <div className="min-w-0">
            <h3
              className={cn(
                "text-sm font-semibold tracking-tight",
                L ? "text-zinc-900" : "text-white/90"
              )}
            >
              Encuestas{polls.length > 0 ? ` · ${polls.length}` : ""}
            </h3>
            <p className={cn("text-[11px]", L ? "text-zinc-500" : "text-white/35")}>
              Opiniones y votos en esta nota
            </p>
          </div>
        </div>
        {canEditEntry && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            /* Mobile: boton a ancho completo (`w-full`) para que
                "Nueva encuesta" no se trunque y sea un tap-target
                comodo. En sm+ recupera su ancho intrinseco. */
            className={cn(
              "w-full justify-center sm:w-auto",
              L &&
                "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 hover:border-zinc-300 shadow-sm"
            )}
            onClick={() => {
              resetModal();
              setModalOpen(true);
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Nueva encuesta
          </Button>
        )}
      </div>

      {polls.length === 0 ? (
        <p
          className={cn(
            "text-xs leading-relaxed max-w-md",
            L ? "text-zinc-500" : "text-white/35"
          )}
        >
          Añade una encuesta para recoger opiniones. Puedes abrirla a todo el departamento o solo a
          compañeros concretos (reciben aviso).
        </p>
      ) : (
        <div className="space-y-6">
          {polls.map((poll) => {
            const voters = totalUniqueVoters(poll);
            const mayVote = userMayVote(currentUser, entryDepartmentId, poll);
            const busy = votingPollId === poll.id;
            const userVotedOptionIds = new Set(
              poll.responses.filter((r) => r.userId === currentUser.id).map((r) => r.optionId)
            );
            const createdLabel = format(new Date(poll.createdAt), "d MMM yyyy · HH:mm", {
              locale: es,
            });
            return (
              <article
                key={poll.id}
                id={`poll-${poll.id}`}
                className={cn(
                  "scroll-mt-24 overflow-hidden rounded-2xl border shadow-lg transition-shadow",
                  poll.closedAt
                    ? L
                      ? "border-zinc-200/80 bg-zinc-50/70 opacity-[0.97] shadow-sm shadow-zinc-900/5"
                      : "border-white/[0.07] bg-white/[0.02] opacity-[0.92] shadow-black/10"
                    : L
                      ? "border-zinc-200/90 bg-white shadow-md shadow-zinc-900/[0.06] ring-1 ring-zinc-900/[0.04]"
                      : "border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] shadow-black/25 ring-1 ring-inset ring-white/[0.04]"
                )}
              >
                <div
                  className={cn(
                    "border-b px-4 py-3 sm:px-5 sm:py-3.5",
                    L ? "border-zinc-100 bg-zinc-50/90" : "border-white/[0.06] bg-black/15"
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <p
                        className={cn(
                          "text-[15px] font-semibold leading-snug sm:text-base",
                          L ? "text-zinc-900" : "text-white"
                        )}
                      >
                        {poll.question}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {poll.responseScope === LogEntryPollResponseScope.DEPARTMENT_ALL ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                              L
                                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                                : "border-emerald-400/25 bg-emerald-500/10 text-emerald-200/95"
                            )}
                          >
                            <Users
                              className={cn(
                                "h-3.5 w-3.5 shrink-0",
                                L ? "text-emerald-700" : "opacity-90"
                              )}
                            />
                            Todo el departamento
                          </span>
                        ) : (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                              L
                                ? "border-sky-200 bg-sky-50 text-sky-900"
                                : "border-sky-400/25 bg-sky-500/10 text-sky-200/95"
                            )}
                          >
                            <UserRound
                              className={cn(
                                "h-3.5 w-3.5 shrink-0",
                                L ? "text-sky-700" : "opacity-90"
                              )}
                            />
                            Invitados · {poll.invitees.length}
                          </span>
                        )}
                        {poll.allowMultiple && (
                          <span
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-[11px]",
                              L
                                ? "border-zinc-200 bg-zinc-100 text-zinc-600"
                                : "border-white/10 bg-white/[0.06] text-white/55"
                            )}
                          >
                            Voto múltiple
                          </span>
                        )}
                        {poll.closedAt && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                              L
                                ? "border-amber-200 bg-amber-50 text-amber-950"
                                : "border-amber-400/25 bg-amber-500/12 text-amber-200/95"
                            )}
                          >
                            <Lock className={cn("h-3 w-3", L && "text-amber-800")} />
                            Cerrada
                          </span>
                        )}
                      </div>
                      {poll.responseScope === LogEntryPollResponseScope.SELECTED_USERS &&
                        poll.invitees.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {poll.invitees.map((inv) => (
                              <span
                                key={inv.userId}
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5",
                                  L
                                    ? "border-zinc-200 bg-white shadow-sm"
                                    : "border-white/10 bg-white/[0.05]"
                                )}
                                title={inv.user.name}
                              >
                                <Avatar name={inv.user.name} image={inv.user.image} size="xs" />
                                <span
                                  className={cn(
                                    "max-w-[8rem] truncate text-[11px]",
                                    L ? "text-zinc-600" : "text-white/65"
                                  )}
                                >
                                  {inv.user.name}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      <div
                        className={cn(
                          "flex flex-wrap items-center gap-2 pt-1 text-[11px]",
                          L ? "text-zinc-500" : "text-white/40"
                        )}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Avatar
                            name={poll.createdBy.name}
                            image={poll.createdBy.image}
                            size="xs"
                          />
                          <span className={L ? "text-zinc-700" : "text-white/50"}>
                            {poll.createdBy.name}
                          </span>
                          <span className={L ? "text-zinc-300" : "text-white/30"}>·</span>
                            <time dateTime={new Date(poll.createdAt).toISOString()}>
                              {createdLabel}
                            </time>
                        </span>
                        {voters > 0 && (
                          <>
                            <span className={L ? "text-zinc-300" : "text-white/25"}>·</span>
                            <span
                              className={cn(
                                "tabular-nums",
                                L ? "text-zinc-600" : "text-white/45"
                              )}
                            >
                              {voters} {voters === 1 ? "participante" : "participantes"}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {canEditEntry && !poll.closedAt && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        loading={closingId === poll.id}
                        onClick={() => void closePoll(poll.id)}
                        title="Cerrar encuesta"
                        aria-label="Cerrar encuesta"
                        className={cn(
                          "h-9 w-9 shrink-0 p-0",
                          L
                            ? "border border-zinc-200 text-zinc-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-900"
                            : "border border-white/12 text-white/65 hover:border-amber-400/40 hover:text-amber-200/95 hover:bg-amber-500/10"
                        )}
                      >
                        {closingId !== poll.id && (
                          <Lock className="h-4 w-4 shrink-0" aria-hidden />
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-3 p-4 sm:p-5">
                  {poll.options.map((opt) => {
                    const n = uniqueVotersForOption(poll, opt.id);
                    const votersList = uniqueVotersForOptionDetail(poll, opt.id);
                    const pct = voters === 0 ? 0 : Math.round((n / voters) * 100);
                    const checked =
                      poll.allowMultiple &&
                      (multiDraft[poll.id]?.has(opt.id) ?? false);
                    const isMyVote = userVotedOptionIds.has(opt.id);
                    return (
                      <div
                        key={opt.id}
                        className={cn(
                          "rounded-xl border p-3.5 sm:p-4 transition-colors",
                          isMyVote && !poll.closedAt
                            ? L
                              ? "border-emerald-300/90 bg-emerald-50/80 ring-1 ring-inset ring-emerald-200/50"
                              : "border-emerald-400/25 bg-emerald-500/[0.06] ring-1 ring-inset ring-emerald-400/10"
                            : L
                              ? "border-zinc-200/90 bg-zinc-50/40 hover:border-zinc-300"
                              : "border-white/[0.08] bg-black/20 hover:border-white/12"
                        )}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between sm:gap-4">
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex items-start gap-2.5">
                              {poll.allowMultiple && mayVote && !poll.closedAt && (
                                <input
                                  type="checkbox"
                                  className={cn(
                                    "mt-0.5 rounded shrink-0 accent-[#ffeb66]",
                                    L ? "border-zinc-300" : "border-white/30"
                                  )}
                                  checked={checked}
                                  onChange={() => {
                                    setMultiDraft((prev) => {
                                      const cur = new Set(prev[poll.id] ?? []);
                                      if (cur.has(opt.id)) cur.delete(opt.id);
                                      else cur.add(opt.id);
                                      return { ...prev, [poll.id]: cur };
                                    });
                                  }}
                                  aria-label={`Seleccionar ${opt.label}`}
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={cn(
                                      "text-sm font-medium",
                                      L ? "text-zinc-900" : "text-white/90"
                                    )}
                                  >
                                    {opt.label}
                                  </span>
                                  {isMyVote && (
                                    <span
                                      className={cn(
                                        "inline-flex items-center gap-0.5 rounded-md border px-2 py-0.5 text-[10px] font-medium",
                                        L
                                          ? "border-emerald-300 bg-emerald-100 text-emerald-900"
                                          : "border-emerald-400/35 bg-emerald-500/15 text-emerald-200/95"
                                      )}
                                    >
                                      <Check className="h-3 w-3 shrink-0" />
                                      Tu voto
                                    </span>
                                  )}
                                </div>
                                <div
                                  className={cn(
                                    "mt-3 h-2.5 overflow-hidden rounded-full ring-1 ring-inset",
                                    L
                                      ? "bg-zinc-200/80 ring-zinc-200/50"
                                      : "bg-white/[0.07] ring-white/[0.04]"
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "h-full rounded-full bg-gradient-to-r from-emerald-400/75 via-[#ffeb66]/70 to-sky-400/65 transition-[width] duration-500 ease-out",
                                      n > 0 && pct < 8 && "min-w-[8px]"
                                    )}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                {votersList.length > 0 && (
                                  <div className="mt-2.5">
                                    <p
                                      className={cn(
                                        "mb-1.5 text-[10px] font-medium uppercase tracking-wide",
                                        L ? "text-zinc-500" : "text-white/40"
                                      )}
                                    >
                                      Han votado esta opción ({votersList.length})
                                    </p>
                                    <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto overscroll-contain pr-0.5">
                                      {votersList.map((u) => (
                                        <span
                                          key={u.id}
                                          className={cn(
                                            "inline-flex max-w-full items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 shadow-sm",
                                            L
                                              ? "border-zinc-200 bg-white"
                                              : "border-white/12 bg-white/[0.06]"
                                          )}
                                          title={u.name}
                                        >
                                          <Avatar name={u.name} image={u.image} size="xs" />
                                          <span
                                            className={cn(
                                              "truncate text-[11px] font-medium",
                                              L ? "text-zinc-700" : "text-white/70"
                                            )}
                                          >
                                            {u.name}
                                          </span>
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div
                            className={cn(
                              "flex shrink-0 flex-row items-center justify-between gap-3 pt-2.5 sm:flex-col sm:items-end sm:justify-between sm:border-t-0 sm:pl-4 sm:pt-0",
                              L
                                ? "border-t border-zinc-100 sm:border-l sm:border-zinc-100"
                                : "border-t border-white/[0.06] sm:border-l sm:border-white/[0.06]"
                            )}
                          >
                            <span
                              className={cn(
                                "tabular-nums text-[11px] font-medium sm:text-right",
                                L ? "text-zinc-600" : "text-white/45"
                              )}
                            >
                              {n} {n === 1 ? "voto" : "votos"}
                              {voters > 0 ? (
                                <span className={L ? "text-zinc-400" : "text-white/30"}>
                                  {" "}
                                  · {pct}%
                                </span>
                              ) : null}
                            </span>
                            {mayVote && !poll.closedAt && !poll.allowMultiple && (
                              <>
                                {isMyVote ? (
                                  <span
                                    className={cn(
                                      "inline-flex min-w-[5.5rem] items-center justify-center rounded-lg border px-3 py-1.5 text-center text-[11px] font-medium",
                                      L
                                        ? "border-zinc-200 bg-zinc-100 text-zinc-600"
                                        : "border-white/12 bg-white/[0.04] text-white/45"
                                    )}
                                  >
                                    Tu elección
                                  </span>
                                ) : (
                                  <Button
                                    type="button"
                                    variant="primary"
                                    size="sm"
                                    className="min-w-[5.5rem] shadow-md shadow-[#ffeb66]/10"
                                    disabled={busy}
                                    loading={busy}
                                    onClick={() => void vote(poll, [opt.id])}
                                  >
                                    Votar
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {mayVote && !poll.closedAt && poll.allowMultiple && (
                  <div
                    className={cn(
                      "flex flex-col gap-2 border-t px-4 py-3.5 sm:flex-row sm:items-center sm:px-5",
                      L ? "border-zinc-100 bg-zinc-50/60" : "border-white/[0.06] bg-black/10"
                    )}
                  >
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={busy}
                      loading={busy}
                      onClick={() => {
                        const ids = [...(multiDraft[poll.id] ?? new Set())];
                        if (ids.length === 0) {
                          toast.error("Marca al menos una opción");
                          return;
                        }
                        void vote(poll, ids);
                      }}
                    >
                      Guardar mi selección
                    </Button>
                    <p className={cn("text-[11px]", L ? "text-zinc-500" : "text-white/35")}>
                      Marca las opciones y guarda; sustituye tu voto anterior.
                    </p>
                  </div>
                )}

                {poll.closedAt && voters === 0 && (
                  <p
                    className={cn(
                      "border-t px-4 py-3 text-center text-xs sm:px-5",
                      L
                        ? "border-zinc-100 bg-zinc-50/50 text-zinc-500"
                        : "border-white/[0.06] bg-black/10 text-white/35"
                    )}
                  >
                    Sin votos en esta encuesta.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetModal();
        }}
        title="Nueva encuesta"
        description={`Se adjuntará a «${entryTitle.slice(0, 60)}${entryTitle.length > 60 ? "…" : ""}».`}
        size="md"
      >
        <form onSubmit={createPoll} className="space-y-4">
          <Input
            light={L}
            label="Pregunta"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            required
            maxLength={500}
            placeholder="Ej. ¿Confirmamos el cambio de ventana de mantenimiento?"
          />

          <div className="space-y-2.5">
            <p
              className={cn(
                "text-xs font-medium uppercase tracking-wide",
                L ? "text-zinc-500" : "text-white/50"
              )}
            >
              ¿Quién debe poder responder?
            </p>
            <label
              className={cn(
                "flex items-start gap-2 cursor-pointer text-sm",
                L ? "text-zinc-600" : "text-white/70"
              )}
            >
              <input
                type="radio"
                name="poll-scope"
                className="mt-1 accent-[#ffeb66]"
                checked={scope === LogEntryPollResponseScope.DEPARTMENT_ALL}
                onChange={() => setScope(LogEntryPollResponseScope.DEPARTMENT_ALL)}
              />
              <span>
                <strong className={L ? "text-zinc-900" : "text-white/85"}>
                  Todo el departamento
                </strong>{" "}
                de la nota (cualquier miembro activo con acceso a la bitácora).
              </span>
            </label>
            <label
              className={cn(
                "flex items-start gap-2 cursor-pointer text-sm",
                L ? "text-zinc-600" : "text-white/70"
              )}
            >
              <input
                type="radio"
                name="poll-scope"
                className="mt-1 accent-[#ffeb66]"
                checked={scope === LogEntryPollResponseScope.SELECTED_USERS}
                onChange={() => setScope(LogEntryPollResponseScope.SELECTED_USERS)}
              />
              <span>
                <strong className={L ? "text-zinc-900" : "text-white/85"}>
                  Solo compañeros elegidos
                </strong>{" "}
                (reciben aviso en notificaciones).
              </span>
            </label>
          </div>

          {scope === LogEntryPollResponseScope.SELECTED_USERS && (
            <div
              className={cn(
                "rounded-xl border p-3 max-h-48 overflow-y-auto space-y-1.5",
                L ? "border-zinc-200 bg-zinc-50/80" : "border-white/10 bg-white/[0.03]"
              )}
            >
              <p
                className={cn("text-[10px] mb-1", L ? "text-zinc-400" : "text-white/35")}
              >
                Miembros del departamento
              </p>
              {sortedMembers.map((m) => {
                const checked = selectedInvitees.has(m.id);
                return (
                  <label
                    key={m.id}
                    className={cn(
                      "flex items-center gap-2 cursor-pointer text-xs",
                      L
                        ? "text-zinc-600 hover:text-zinc-900"
                        : "text-white/70 hover:text-white/90"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setSelectedInvitees((prev) => {
                          const next = new Set(prev);
                          if (next.has(m.id)) next.delete(m.id);
                          else next.add(m.id);
                          return next;
                        });
                      }}
                      className={cn(
                        "rounded accent-[#ffeb66]",
                        L ? "border-zinc-300" : "border-white/20"
                      )}
                    />
                    <Avatar name={m.name} image={m.image} size="xs" />
                    <span className="truncate">{m.name}</span>
                  </label>
                );
              })}
            </div>
          )}

          <label
            className={cn(
              "flex items-center gap-2 text-xs cursor-pointer",
              L ? "text-zinc-600" : "text-white/60"
            )}
          >
            <input
              type="checkbox"
              checked={allowMultiple}
              onChange={(e) => setAllowMultiple(e.target.checked)}
              className={cn(
                "rounded accent-[#ffeb66]",
                L ? "border-zinc-300" : "border-white/20"
              )}
            />
            Permitir elegir varias opciones a la vez
          </label>

          <div className="space-y-2">
            <p
              className={cn(
                "text-xs font-medium uppercase tracking-wide",
                L ? "text-zinc-500" : "text-white/50"
              )}
            >
              Opciones
            </p>
            {optionDrafts.map((val, i) => (
              <Input
                key={i}
                light={L}
                value={val}
                onChange={(e) => {
                  const next = [...optionDrafts];
                  next[i] = e.target.value;
                  setOptionDrafts(next);
                }}
                placeholder={`Opción ${i + 1}`}
                maxLength={280}
              />
            ))}
            {optionDrafts.length < 10 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  L && "text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
                )}
                onClick={() => setOptionDrafts([...optionDrafts, ""])}
              >
                + Añadir opción
              </Button>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              className={cn(
                L &&
                  "border-zinc-200 bg-zinc-100 text-zinc-800 hover:bg-zinc-200 hover:border-zinc-300"
              )}
              onClick={() => {
                setModalOpen(false);
                resetModal();
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              Crear encuesta
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
