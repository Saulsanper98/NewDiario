"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <div className="glass rounded-2xl p-8 max-w-md w-full flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-400">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">
            Algo salió mal en esta pantalla
          </h2>
          <p className="text-sm text-white/45 mt-2">
            No se pudo cargar el contenido. Puedes reintentar o volver al
            inicio.
          </p>
          {error.digest && (
            <p className="text-[10px] text-white/25 font-mono mt-2" title="Referencia para soporte">
              Ref: {error.digest}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          <Button type="button" variant="primary" onClick={() => reset()}>
            Reintentar
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              window.location.href = "/dashboard";
            }}
          >
            Ir al dashboard
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              window.location.href = "/bitacora";
            }}
          >
            Ir a la bitácora
          </Button>
        </div>
        {error.digest && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-white/40"
            onClick={() => void navigator.clipboard.writeText(error.digest ?? "")}
          >
            Copiar referencia
          </Button>
        )}
      </div>
    </div>
  );
}
