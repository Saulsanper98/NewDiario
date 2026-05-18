"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

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
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-[#060b18] text-white">
      <div className="glass rounded-2xl p-8 max-w-lg w-full flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-400">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Error al cargar la aplicación</h1>
          <p className="text-sm text-white/50 mt-2 leading-relaxed">
            En producción el navegador no muestra el detalle del fallo. Revisa el log del proceso
            Node (por ejemplo <span className="font-mono text-white/60">C:\nssm\logs\CCOps.err.log</span>{" "}
            si usas el servicio CCOps): suele ser <strong className="text-white/70">PostgreSQL</strong>{" "}
            (conexión, <span className="font-mono">DATABASE_URL</span>) o el{" "}
            <strong className="text-white/70">esquema sin aplicar</strong> en esa base (en el
            servidor, desde la carpeta del proyecto: <span className="font-mono text-white/60">npm run setup</span> o{" "}
            <span className="font-mono text-white/60">npx prisma db push</span>).
          </p>
          {error.digest && (
            <p className="text-[10px] text-white/30 font-mono mt-3" title="Referencia para soporte">
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
              window.location.href = "/login";
            }}
          >
            Volver al login
          </Button>
        </div>
      </div>
    </div>
  );
}
