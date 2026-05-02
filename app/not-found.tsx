import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <div className="glass rounded-2xl p-10 max-w-md w-full flex flex-col items-center gap-5">
        <Logo size="sm" showText />
        <div>
          <p className="text-6xl font-bold text-[#ffeb66] tabular-nums leading-none mb-3">404</p>
          <h1 className="text-xl font-semibold text-white">Página no encontrada</h1>
          <p className="text-sm text-white/40 mt-2 leading-relaxed">
            La página que buscas no existe o ha sido movida.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#ffeb66] text-[#0a0f1e] text-sm font-semibold hover:bg-[#ffe033] transition-all duration-200"
          >
            Ir al Dashboard
          </Link>
          <Link
            href="/bitacora"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-white/15 text-white/85 text-sm font-medium hover:bg-white/6 transition-all duration-200"
          >
            Ir a la bitácora
          </Link>
          <Link
            href="/proyectos"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-white/15 text-white/85 text-sm font-medium hover:bg-white/6 transition-all duration-200"
          >
            Proyectos
          </Link>
        </div>
        <p className="text-xs text-white/30 max-w-sm leading-relaxed">
          También puedes abrir la búsqueda global con{" "}
          <kbd className="px-1 py-0.5 rounded bg-white/8 border border-white/10 font-mono text-[10px]">Ctrl</kbd>
          {" + "}
          <kbd className="px-1 py-0.5 rounded bg-white/8 border border-white/10 font-mono text-[10px]">K</kbd>
          {" "}desde el área privada.
        </p>
      </div>
    </div>
  );
}
