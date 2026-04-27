"use client";

import { useRef } from "react";
import {
  BookOpen,
  Zap,
  AlertTriangle,
  Printer,
  Sun,
  Sunset,
  Moon,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  TYPE_LABELS,
  SHIFT_LABELS,
  getTypeColor,
  formatDate,
  truncate,
  PRIORITY_LABELS,
  getPriorityColor,
} from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import type {
  TraspasoRecentLog,
  TraspasoShiftCountRow,
  TraspasoShiftTask,
  TraspasoUnresolvedLog,
} from "@/lib/types/traspaso";

interface TraspasoViewProps {
  recentLogs: TraspasoRecentLog[];
  shiftTasks: TraspasoShiftTask[];
  unresolvedIncidents: TraspasoUnresolvedLog[];
  shiftCounts: TraspasoShiftCountRow[];
}

const SHIFT_ICONS: Record<string, React.ElementType> = {
  MORNING: Sun,
  AFTERNOON: Sunset,
  NIGHT: Moon,
};

export function TraspasoView({
  recentLogs,
  shiftTasks,
  unresolvedIncidents,
  shiftCounts,
}: TraspasoViewProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const now = new Date();

  function handlePrint() {
    try {
      window.print();
    } catch {
      // print dialog not available in this context
    }
  }

  const shiftCountMap: Record<string, number> = {};
  shiftCounts.forEach((s) => {
    shiftCountMap[s.shift] = s._count.id;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Traspaso de Turno</h1>
          <p className="text-sm text-white/40 mt-0.5">
            {format(now, "EEEE d 'de' MMMM, yyyy — HH:mm", { locale: es })}
          </p>
        </div>
        <Button variant="secondary" onClick={handlePrint}>
          <Printer className="w-3.5 h-3.5" />
          Imprimir / PDF
        </Button>
      </div>

      <div ref={printRef} className="space-y-5">
        {/* Shift counters */}
        <div className="grid grid-cols-3 gap-3">
          {(["MORNING", "AFTERNOON", "NIGHT"] as const).map((shift) => {
            const Icon = SHIFT_ICONS[shift];
            const count = shiftCountMap[shift] ?? 0;
            const shiftColor = shift === "MORNING" ? "text-amber-300" : shift === "AFTERNOON" ? "text-orange-300" : "text-indigo-300";
            const shiftBg = shift === "MORNING" ? "bg-amber-400/8 border-amber-400/15" : shift === "AFTERNOON" ? "bg-orange-400/8 border-orange-400/15" : "bg-indigo-400/8 border-indigo-400/15";
            return (
              <Card key={shift} className={`text-center py-5 ${shiftBg}`}>
                <Icon className={`w-6 h-6 mx-auto mb-2 ${shiftColor}`} />
                <p className={`text-2xl font-bold ${shiftColor}`}>{count}</p>
                <p className="text-xs text-white/40 mt-1">
                  Entradas {SHIFT_LABELS[shift].toLowerCase()}
                </p>
              </Card>
            );
          })}
        </div>

        {/* Recent logs 24h */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#ffeb66]" />
              Entradas últimas 24h
              <Badge variant="default" size="sm">
                {recentLogs.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          {recentLogs.length === 0 ? (
            <p className="text-sm text-white/30 py-3 text-center">
              Sin entradas en las últimas 24 horas
            </p>
          ) : (
            <div className="space-y-2">
              {recentLogs.map((log) => (
                <Link key={log.id} href={`/bitacora/${log.id}`}>
                  <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/4 transition-all duration-200">
                    <Avatar
                      name={log.author.name}
                      image={log.author.image}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-sm font-medium text-white">
                          {truncate(log.title, 55)}
                        </span>
                        <Badge className={getTypeColor(log.type)} size="sm">
                          {TYPE_LABELS[log.type as keyof typeof TYPE_LABELS]}
                        </Badge>
                        {log.requiresFollowup && !log.followupDone && (
                          <Badge variant="warning" size="sm">
                            Seguimiento
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white/35">
                        <span>{log.author.name}</span>
                        <span>·</span>
                        <span>
                          {SHIFT_LABELS[log.shift as keyof typeof SHIFT_LABELS]}
                        </span>
                        <span>·</span>
                        <span>{formatDate(log.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Shift tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#ffeb66]" />
              Tareas de turno activas
              <Badge variant="warning" size="sm">
                {shiftTasks.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          {shiftTasks.length === 0 ? (
            <p className="text-sm text-white/30 py-3 text-center">
              Sin tareas de turno activas
            </p>
          ) : (
            <div className="space-y-2">
              {shiftTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-white/2"
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      task.priority === "HIGH"
                        ? "bg-red-400"
                        : task.priority === "MEDIUM"
                        ? "bg-yellow-400"
                        : "bg-green-400"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {task.title}
                    </p>
                    <p className="text-xs text-white/35">
                      {task.project.name} · {task.column.name}
                    </p>
                  </div>
                  <Badge className={getPriorityColor(task.priority)} size="sm">
                    {PRIORITY_LABELS[task.priority as keyof typeof PRIORITY_LABELS]}
                  </Badge>
                  {task.assignee && (
                    <Avatar
                      name={task.assignee.name}
                      image={task.assignee.image}
                      size="xs"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Unresolved incidents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              Incidencias sin resolver (48h)
              <Badge variant="error" size="sm">
                {unresolvedIncidents.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          {unresolvedIncidents.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-sm text-green-400/70">Sin incidencias pendientes</p>
            </div>
          ) : (
            <div className="space-y-2">
              {unresolvedIncidents.map((log) => (
                <Link key={log.id} href={`/bitacora/${log.id}`}>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-red-400/5 border border-red-400/15 hover:bg-red-400/8 transition-all duration-200">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {log.title}
                      </p>
                      <p className="text-xs text-white/40">
                        {log.author.name} · {formatDate(log.createdAt)}
                      </p>
                    </div>
                    <Badge variant="error" size="sm">Pendiente</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
