/**
 * Fuente única de verdad para la ayuda de atajos (y documentación humana).
 * La lógica de ejecución sigue en `KeyboardShortcuts.tsx`.
 */

export type HelpShortcutRow = { key: string; desc: string };

export type HelpShortcutSection = { title: string; rows: HelpShortcutRow[] };

export function getHelpShortcutSections(pathname: string): HelpShortcutSection[] {
  const general: HelpShortcutSection = {
    title: "Generales",
    rows: [
      { key: "N", desc: "Nueva entrada / Nuevo proyecto (según la sección en la que estés)" },
      { key: "/", desc: "Abrir búsqueda global (campo junto a notificaciones)" },
      { key: "Ctrl o ⌘ + K", desc: "Abrir o cerrar la paleta de comandos" },
      { key: "?", desc: "Mostrar u ocultar esta ayuda" },
      { key: "Esc", desc: "Cerrar paneles, modales o esta ayuda" },
    ],
  };

  const sections: HelpShortcutSection[] = [general];

  if (pathname.startsWith("/bitacora/dia")) {
    sections.push({
      title: "Vista bitácora por día",
      rows: [
        { key: "← →", desc: "Día anterior o siguiente (cuando el foco no está en un campo de texto)" },
      ],
    });
  }

  return sections;
}

/** @deprecated Usar `getHelpShortcutSections`; se mantiene por compatibilidad. */
export function getHelpShortcutRows(pathname: string): HelpShortcutRow[] {
  return getHelpShortcutSections(pathname).flatMap((s) => s.rows);
}
