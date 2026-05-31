"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorShell } from "@/components/ui/ErrorShell";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app]", error);
  }, [error]);

  return (
    <ErrorShell
      title="Error al cargar la aplicación"
      digest={error.digest}
      description={
        <>
          En producción el navegador no muestra el detalle del fallo. Revisa el
          log del proceso Node (por ejemplo{" "}
          <span className="font-mono">C:\nssm\logs\CCOps.err.log</span> si usas
          el servicio CCOps): suele ser <strong>PostgreSQL</strong> (conexión,{" "}
          <span className="font-mono">DATABASE_URL</span>) o el{" "}
          <strong>esquema sin aplicar</strong> en esa base (en el servidor,
          desde la carpeta del proyecto:{" "}
          <span className="font-mono">npm run setup</span> o{" "}
          <span className="font-mono">npx prisma db push</span>).
        </>
      }
      actions={
        <>
          <Button type="button" variant="primary" onClick={() => reset()}>
            Reintentar
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              window.location.href = "/login";
            }}
          >
            Volver al login
          </Button>
        </>
      }
    />
  );
}
