"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Keyboard, X } from "lucide-react";

export function KeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isEditing = tag === "input" || tag === "textarea" || tag === "select" ||
        (e.target as HTMLElement)?.isContentEditable;

      if (isEditing) return;

      switch (e.key) {
        case "n":
        case "N":
          if (pathname.startsWith("/bitacora")) {
            e.preventDefault();
            router.push("/bitacora/nueva");
          } else if (pathname.startsWith("/proyectos")) {
            e.preventDefault();
            router.push("/proyectos/nuevo");
          }
          break;
        case "/":
          e.preventDefault();
          /* Trigger CommandPalette — focus the search input if mounted */
          document.getElementById("cmd-palette-trigger")?.click();
          break;
        case "?":
          e.preventDefault();
          setHelpOpen((v) => !v);
          break;
        case "Escape":
          setHelpOpen(false);
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, pathname]);

  if (!helpOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Atajos de teclado"
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onClick={() => setHelpOpen(false)}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative glass-4 rounded-2xl p-6 w-full max-w-sm mx-4 border border-white/15"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Keyboard className="w-4 h-4 text-[#ffeb66]" /> Atajos de teclado
        </h2>
        <div className="space-y-2">
          {[
            { key: "N", desc: "Nueva entrada / Nuevo proyecto (en sección activa)" },
            { key: "/", desc: "Abrir búsqueda global" },
            { key: "?", desc: "Mostrar / ocultar esta ayuda" },
            { key: "Esc", desc: "Cerrar paneles / ayuda" },
          ].map(({ key, desc }) => (
            <div key={key} className="flex items-center gap-3">
              <kbd className="px-2 py-0.5 rounded-md bg-white/8 border border-white/12 text-xs font-mono text-white/70 shrink-0 min-w-[2rem] text-center">
                {key}
              </kbd>
              <span className="text-xs text-white/50">{desc}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => setHelpOpen(false)}
          className="absolute top-3 right-3 p-1 rounded-md text-white/30 hover:text-white/70 transition-colors"
          aria-label="Cerrar ayuda"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
