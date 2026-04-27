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
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#ffeb66] text-[#0a0f1e] text-sm font-semibold hover:bg-[#ffe033] transition-all duration-200"
        >
          Ir al Dashboard
        </Link>
      </div>
    </div>
  );
}
