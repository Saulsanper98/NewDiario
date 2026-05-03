"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GitBranch, Plus, Trash2, ChevronRight, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";
import type { SessionUser } from "@/lib/auth/types";
import { isAdminOrAbove, isAdminOfDepartment } from "@/lib/auth/permissions";

/** Acepta el id crudo o una URL/pega con `/bitacora/<id>`. */
function extractLogEntryIdFromInput(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const fromUrl = t.match(/\/bitacora\/([^/?#]+)/i);
  if (fromUrl?.[1]) return fromUrl[1].trim();
  return t;
}

type OutLink = {
  id: string;
  linkType: string;
  createdAt: Date | string;
  createdById: string;
  toLog: { id: string; title: string };
};
type InLink = {
  id: string;
  linkType: string;
  createdAt: Date | string;
  createdById: string;
  fromLog: { id: string; title: string; departmentId: string };
};

interface LogEntryLinksCardProps {
  entryId: string;
  /** Departamento de esta entrada (fromLog en enlaces salientes). */
  entryDepartmentId: string;
  currentUser: SessionUser;
  /** Quien ve la bitácora puede proponer enlaces; la API valida acceso al destino. */
  canAddLink: boolean;
  initialOutgoing: OutLink[];
  initialIncoming: InLink[];
}

export function LogEntryLinksCard({
  entryId,
  entryDepartmentId,
  currentUser,
  canAddLink,
  initialOutgoing,
  initialIncoming,
}: LogEntryLinksCardProps) {
  const router = useRouter();
  const [outgoing, setOutgoing] = useState(initialOutgoing);
  const [incoming, setIncoming] = useState(initialIncoming);
  const [toId, setToId] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const hasAny = outgoing.length > 0 || incoming.length > 0;

  async function addLink() {
    const tid = extractLogEntryIdFromInput(toId);
    if (!tid) {
      toast.error("Indica el id o la URL de la entrada destino");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(`/api/log-entries/${entryId}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toLogId: tid }),
      });
      const data = (await res.json()) as { link?: OutLink; error?: unknown };
      if (!res.ok) {
        const msg =
          typeof data.error === "object" &&
          data.error &&
          "formErrors" in (data.error as object)
            ? "Datos no válidos"
            : res.status === 409
              ? "Ese enlace ya existe"
              : "No se pudo crear el enlace";
        toast.error(msg);
        return;
      }
      if (data.link) {
        setOutgoing((o) => [data.link!, ...o]);
        setToId("");
        toast.success("Enlace añadido");
        router.refresh();
      }
    } catch {
      toast.error("Error de red");
    } finally {
      setAdding(false);
    }
  }

  /** La ruta DELETE exige que [id] sea el fromLogId del enlace. */
  async function removeLink(
    linkId: string,
    direction: "out" | "in",
    fromLogIdForApi: string
  ) {
    setRemovingId(linkId);
    try {
      const res = await fetch(
        `/api/log-entries/${fromLogIdForApi}/links/${linkId}`,
        {
          method: "DELETE",
        }
      );
      if (!res.ok) throw new Error();
      if (direction === "out") {
        setOutgoing((o) => o.filter((x) => x.id !== linkId));
      } else {
        setIncoming((o) => o.filter((x) => x.id !== linkId));
      }
      toast.success("Enlace eliminado");
      router.refresh();
    } catch {
      toast.error("No se pudo eliminar");
    } finally {
      setRemovingId(null);
    }
  }

  function canRemoveOut(link: OutLink) {
    return (
      link.createdById === currentUser.id ||
      isAdminOrAbove(currentUser) ||
      isAdminOfDepartment(currentUser, entryDepartmentId)
    );
  }
  function canRemoveIn(link: InLink) {
    return (
      link.createdById === currentUser.id ||
      isAdminOrAbove(currentUser) ||
      isAdminOfDepartment(currentUser, link.fromLog.departmentId)
    );
  }

  if (!hasAny && !canAddLink) return null;

  return (
    <Card className="p-5 sm:p-6 print:hidden">
      <div className="flex items-center gap-2 mb-4">
        <GitBranch className="w-4 h-4 text-[#ffeb66]/80" />
        <span className="text-sm font-medium text-white/70">
          Causa → efecto (enlaces entre entradas)
        </span>
      </div>

      {canAddLink && (
        <div className="flex flex-col gap-2 mb-5">
          <p className="text-[11px] text-white/40 leading-relaxed">
            El destino es <strong className="text-white/55">otra entrada de la bitácora</strong>.
            Usa el identificador que va en la barra de direcciones:{" "}
            <code className="rounded bg-white/10 px-1 py-0.5 text-[10px] text-[#ffeb66]/90">
              …/bitacora/<span className="text-white/70">aquí-el-id</span>
            </code>
            — también puedes pegar la URL completa.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={toId}
            onChange={(e) => setToId(e.target.value)}
            placeholder="Id o URL de la entrada destino"
            className="flex-1 min-w-0 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#ffeb66]/35 focus:outline-none focus:ring-1 focus:ring-[#ffeb66]/20"
            aria-label="Id o URL de la entrada destino"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0"
            loading={adding}
            onClick={() => void addLink()}
          >
            <Plus className="w-3.5 h-3.5" />
            Añadir enlace
          </Button>
          </div>
        </div>
      )}

      {outgoing.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] font-medium text-white/40 uppercase tracking-wide mb-2">
            Esta entrada conduce a
          </p>
          <ul className="space-y-2">
            {outgoing.map((l) => (
              <li
                key={l.id}
                className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] pl-3 pr-1 py-2"
              >
                <Link
                  href={`/bitacora/${l.toLog.id}`}
                  className="flex-1 min-w-0 flex items-center gap-2 text-sm text-white/70 hover:text-[#ffeb66] transition-colors"
                >
                  <span className="truncate">{l.toLog.title}</span>
                  <ChevronRight className="w-3.5 h-3.5 shrink-0 text-white/25" />
                </Link>
                {canRemoveOut(l) && (
                  <button
                    type="button"
                    onClick={() => void removeLink(l.id, "out", entryId)}
                    disabled={removingId === l.id}
                    className="p-2 rounded-md text-white/30 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-40"
                    aria-label="Eliminar enlace"
                  >
                    {removingId === l.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {incoming.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-white/40 uppercase tracking-wide mb-2">
            Entradas que enlazan aquí
          </p>
          <ul className="space-y-2">
            {incoming.map((l) => (
              <li
                key={l.id}
                className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] pl-3 pr-1 py-2"
              >
                <Link
                  href={`/bitacora/${l.fromLog.id}`}
                  className="flex-1 min-w-0 flex items-center gap-2 text-sm text-white/70 hover:text-[#ffeb66] transition-colors"
                >
                  <span className="truncate">{l.fromLog.title}</span>
                  <ChevronRight className="w-3.5 h-3.5 shrink-0 text-white/25" />
                </Link>
                {canRemoveIn(l) && (
                  <button
                    type="button"
                    onClick={() =>
                      void removeLink(l.id, "in", l.fromLog.id)
                    }
                    disabled={removingId === l.id}
                    className="p-2 rounded-md text-white/30 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-40"
                    aria-label="Eliminar enlace"
                  >
                    {removingId === l.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!hasAny && canAddLink && (
        <p className="text-xs text-white/35">
          Marca que <strong className="text-white/55">esta entrada</strong> conduce a otra (orden
          causal). El enlace se guarda como «esta → destino».
        </p>
      )}
    </Card>
  );
}
