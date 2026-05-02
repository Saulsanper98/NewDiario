import { cn } from "@/lib/utils";
import type { ThemeMode } from "@/lib/theme";

const readingBase =
  "prose prose-read-width mx-auto w-full text-sm leading-relaxed print:break-inside-avoid [&_p]:my-4 [&_li:not([data-type=taskItem])]:my-1.5 [&_ul]:my-4 [&_ol]:my-4 [&_blockquote]:my-5 [&_hr]:my-8 [&_h2]:mt-10 [&_h2]:mb-3 [&_h3]:mt-8 [&_h3]:mb-2.5 [&_h4]:mt-6 [&_h4]:mb-2 [&_ul[data-type=taskList]]:my-4 [&_a]:underline [&_a]:underline-offset-2";

/** Cuerpo HTML de una entrada de bitácora (lectura). */
export function bitacoraReadingProseClass(theme: ThemeMode) {
  return cn(
    readingBase,
    theme === "light"
      ? "prose-zinc max-w-none text-zinc-800 [&_a]:decoration-zinc-300 hover:[&_a]:decoration-blue-600 hover:[&_a]:text-blue-800"
      : "prose-invert max-w-none text-white/75 [&_a]:decoration-white/25 hover:[&_a]:decoration-[#ffeb66]/60"
  );
}

/** Previsualización HTML en formulario nueva/editar entrada. */
export function bitacoraPreviewProseClass(theme: ThemeMode) {
  return cn(
    "prose max-w-none text-sm leading-relaxed",
    theme === "light" ? "prose-zinc text-zinc-800" : "prose-invert text-white/75"
  );
}

/** Área editable TipTap (`RichEditor`). */
export function richEditorBodyProseClass(theme: ThemeMode) {
  return cn(
    "prose max-w-none text-sm focus:outline-none min-h-[200px] p-4",
    theme === "light" ? "prose-zinc text-zinc-800" : "prose-invert text-white/80"
  );
}
