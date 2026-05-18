"use client";

import { useEffect, useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

function isChunkLoadFailure(error: Error & { digest?: string }): boolean {
  const name = error.name ?? "";
  const msg = error.message ?? "";
  return (
    name === "ChunkLoadError" ||
    msg.includes("ChunkLoadError") ||
    msg.includes("Failed to load chunk") ||
    msg.includes("Loading chunk") ||
    msg.includes("_next/static/chunks")
  );
}

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunkFailed = useMemo(() => isChunkLoadFailure(error), [error]);

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
            {chunkFailed
              ? "No se pudieron cargar los archivos de la página"
              : "Algo salió mal en esta pantalla"}
          </h2>
          <p className="text-sm text-white/45 mt-2">
            {chunkFailed ? (
              <>
                Suele pasar después de reiniciar el servidor de desarrollo, de
                un despliegue parcial (HTML y archivos JS desincronizados) o por
                caché antigua del navegador. Pulsa primero «Recarga completa» antes
                que reintentar solo esta vista.
              </>
            ) : (
              <>
                No se pudo cargar el contenido. Si ocurre en el servidor, revisa el log de errores
                de Node (p. ej. <span className="font-mono text-white/50">CCOps.err.log</span>): lo
                habitual es un fallo de <strong className="text-white/65">base de datos</strong>{" "}
                o tablas sin esquema Prisma. Tras corregir{" "}
                <span className="font-mono text-white/50">DATABASE_URL</span>, ejecuta{" "}
                <span className="font-mono text-white/50">npm run setup</span> en el servidor y
                reinicia el servicio.
              </>
            )}
          </p>
          {error.digest && (
            <p className="text-[10px] text-white/25 font-mono mt-2" title="Referencia para soporte">
              Ref: {error.digest}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          {chunkFailed && (
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                window.location.reload();
              }}
            >
              Recarga completa
            </Button>
          )}
          <Button type="button" variant={chunkFailed ? "secondary" : "primary"} onClick={() => reset()}>
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
