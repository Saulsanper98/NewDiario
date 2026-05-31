"use client";

import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorShell } from "@/components/ui/ErrorShell";
import { useTheme } from "@/components/layout/ThemeProvider";
import { cn } from "@/lib/utils";

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
  const { theme } = useTheme();
  const L = theme === "light";

  useEffect(() => {
    console.error("[dashboard]", error);
  }, [error]);

  return (
    <ErrorShell
      fill="block"
      title={
        chunkFailed
          ? "No se pudieron cargar los archivos de la página"
          : "Algo salió mal en esta pantalla"
      }
      digest={error.digest}
      description={
        chunkFailed ? (
          <>
            Suele pasar después de reiniciar el servidor de desarrollo, de un
            despliegue parcial (HTML y archivos JS desincronizados) o por caché
            antigua del navegador. Pulsa primero «Recarga completa» antes que
            reintentar solo esta vista.
          </>
        ) : (
          <>
            No se pudo cargar el contenido. Si ocurre en el servidor, revisa el
            log de errores de Node (p. ej.{" "}
            <span className="font-mono">CCOps.err.log</span>): lo habitual es un
            fallo de <strong>base de datos</strong> o tablas sin esquema
            Prisma. Tras corregir{" "}
            <span className="font-mono">DATABASE_URL</span>, ejecuta{" "}
            <span className="font-mono">npm run setup</span> en el servidor y
            reinicia el servicio.
          </>
        )
      }
      actions={
        <>
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
          <Button
            type="button"
            variant={chunkFailed ? "secondary" : "primary"}
            onClick={() => reset()}
          >
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
        </>
      }
      footer={
        error.digest ? (
          <div className="flex justify-center mt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "text-xs",
                L ? "text-zinc-500" : "text-white/40",
              )}
              onClick={() =>
                void navigator.clipboard.writeText(error.digest ?? "")
              }
            >
              Copiar referencia
            </Button>
          </div>
        ) : undefined
      }
    />
  );
}
