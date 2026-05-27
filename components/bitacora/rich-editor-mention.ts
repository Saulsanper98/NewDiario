import { Mention } from "@tiptap/extension-mention";
import type { Editor } from "@tiptap/core";
import type { SuggestionProps } from "@tiptap/suggestion";
import { exitSuggestion } from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import {
  BITACORA_DEPT_ALL_MENTION_ID,
  matchesDeptAllMentionQuery,
} from "@/lib/bitacora-mentions";

export type MentionListItem = {
  id: string;
  label: string;
  email?: string;
  kind?: "user" | "dept-all";
};

/** Misma clave que en `Mention.configure` para poder cerrar el menú con `exitSuggestion`. */
export const richEditorMentionPluginKey = new PluginKey("ccOpsRichMentionAt");

async function fetchMentionItems(
  query: string,
  departmentIds?: string[]
): Promise<MentionListItem[]> {
  const trimmed = query.trim();
  if (trimmed.length < 1) return [];
  const params = new URLSearchParams({ q: trimmed, namesOnly: "1" });
  const cleanIds = (departmentIds ?? [])
    .map((s) => (s ?? "").trim())
    .filter(Boolean);
  if (cleanIds.length === 1) {
    params.set("departmentId", cleanIds[0]);
  } else if (cleanIds.length > 1) {
    params.set("departmentIds", cleanIds.join(","));
  }
  const res = await fetch(`/api/users/mentions?${params.toString()}`, {
    credentials: "same-origin",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { users?: { id: string; name: string; email: string }[] };
  return (data.users ?? []).map((u) => ({
    id: u.id,
    label: u.name,
    email: u.email,
    kind: "user",
  }));
}

async function fetchMentionItemsWithDeptOption(
  query: string,
  departmentIdForAll: string,
  extraDepartmentIds: string[]
): Promise<MentionListItem[]> {
  const trimmed = query.trim();
  if (trimmed.length < 1) return [];
  const owner = departmentIdForAll.trim();
  // Conjunto único de deptos donde buscamos usuarios (owner + compartidos)
  const all = Array.from(
    new Set(
      [owner, ...extraDepartmentIds.map((s) => (s ?? "").trim())].filter(Boolean)
    )
  );
  const users = await fetchMentionItems(trimmed, all.length > 0 ? all : undefined);
  // `@all` sólo aplica al departamento dueño de la nota.
  if (!owner || !matchesDeptAllMentionQuery(trimmed)) return users;
  const deptRow: MentionListItem = {
    id: BITACORA_DEPT_ALL_MENTION_ID,
    label: "all",
    kind: "dept-all",
  };
  return [deptRow, ...users];
}

function isLightTheme(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "light";
}

function shellClass(): string {
  return [
    "rich-editor-mention-menu",
    isLightTheme() ? "rich-editor-mention-menu--light" : "rich-editor-mention-menu--dark",
  ].join(" ");
}

function rowClass(active: boolean): string {
  if (isLightTheme()) {
    return active
      ? "rich-editor-mention-row rich-editor-mention-row--active-light"
      : "rich-editor-mention-row rich-editor-mention-row--light";
  }
  return active
    ? "rich-editor-mention-row rich-editor-mention-row--active-dark"
    : "rich-editor-mention-row rich-editor-mention-row--dark";
}

function metaClass(): string {
  return isLightTheme() ? "rich-editor-mention-meta-light" : "rich-editor-mention-meta-dark";
}

function positionEl(el: HTMLElement, props: SuggestionProps<MentionListItem>) {
  const rect = props.clientRect?.();
  if (!rect) {
    el.style.display = "none";
    return;
  }
  el.style.display = "block";
  el.style.position = "fixed";
  el.style.zIndex = "200";
  const pad = 6;
  let top = rect.bottom + pad;
  let left = rect.left;
  const w = el.offsetWidth || 280;
  const h = el.offsetHeight || 200;
  if (left + w > window.innerWidth - 8) left = Math.max(8, window.innerWidth - w - 8);
  if (top + h > window.innerHeight - 8) top = Math.max(8, rect.top - h - pad);
  el.style.top = `${top}px`;
  el.style.left = `${left}px`;
}

function applyMention(
  _editor: Editor,
  props: SuggestionProps<MentionListItem>,
  item: MentionListItem
) {
  // No llamamos a `.focus()` antes de `props.command(...)` porque eso movería
  // el cursor y el plugin de sugerencias perdería el rango actual del trigger
  // (`@xxx`), provocando que el click no insertase nada y obligando a usar el
  // teclado. `props.command` se encarga internamente de aplicar la mención en
  // la posición correcta.
  props.command({ id: item.id, label: item.label });
}

function renderSuggestionList(
  shell: HTMLDivElement,
  props: SuggestionProps<MentionListItem>,
  editor: Editor,
  selectedIndex: number,
  setSelected: (i: number) => void
) {
  shell.className = shellClass();
  shell.innerHTML = "";
  shell.setAttribute("role", "listbox");

  const items = props.items;
  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "rich-editor-mention-empty";
    empty.textContent = "Sin coincidencias";
    shell.appendChild(empty);
    return;
  }

  items.forEach((item, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", index === selectedIndex ? "true" : "false");
    btn.className = rowClass(index === selectedIndex);
    const main = document.createElement("span");
    main.className = "rich-editor-mention-name";
    if (item.kind === "dept-all") {
      main.textContent = "@all";
      const meta = document.createElement("span");
      meta.className = metaClass();
      meta.textContent = "Todo el departamento";
      btn.appendChild(main);
      btn.appendChild(meta);
    } else {
      main.textContent = item.label;
      btn.appendChild(main);
      if (item.email) {
        const meta = document.createElement("span");
        meta.className = metaClass();
        meta.textContent = item.email;
        btn.appendChild(meta);
      }
    }
    btn.addEventListener("mouseenter", () => setSelected(index));
    // `mousedown` con preventDefault impide que el editor pierda el foco
    // (lo que cerraría la sugerencia antes de tiempo). El insert lo hacemos
    // en `click` para que también funcione bien con teclado/accesibilidad.
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
    });
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      applyMention(editor, props, item);
    });
    shell.appendChild(btn);
  });
}

function createMentionSuggestionRender() {
  let shell: HTMLDivElement | null = null;
  let lastProps: SuggestionProps<MentionListItem> | null = null;
  let selectedIndex = 0;
  let editorRef: Editor | null = null;

  function dismiss() {
    const view = editorRef?.view;
    if (view) exitSuggestion(view, richEditorMentionPluginKey);
  }

  function onDocPointerDown(e: MouseEvent) {
    if (!shell) return;
    const t = e.target as Node;
    if (shell.contains(t)) return;
    dismiss();
  }

  function onDocKeyDown(e: KeyboardEvent) {
    if (e.key !== "Escape" || !shell) return;
    e.preventDefault();
    e.stopPropagation();
    dismiss();
  }

  const setSelected = (i: number) => {
    if (!lastProps || !editorRef || lastProps.items.length === 0) return;
    selectedIndex = ((i % lastProps.items.length) + lastProps.items.length) % lastProps.items.length;
    if (shell) renderSuggestionList(shell, lastProps, editorRef, selectedIndex, setSelected);
  };

  return {
    onStart: (props: SuggestionProps<MentionListItem>) => {
      lastProps = props;
      editorRef = props.editor;
      selectedIndex = 0;
      shell = document.createElement("div");
      shell.className = shellClass();
      document.body.appendChild(shell);
      renderSuggestionList(shell, props, props.editor, selectedIndex, setSelected);
      document.addEventListener("mousedown", onDocPointerDown, true);
      document.addEventListener("keydown", onDocKeyDown, true);
      requestAnimationFrame(() => {
        if (shell) positionEl(shell, props);
      });
    },
    onUpdate: (props: SuggestionProps<MentionListItem>) => {
      lastProps = props;
      editorRef = props.editor;
      selectedIndex = Math.min(selectedIndex, Math.max(0, props.items.length - 1));
      if (!shell) return;
      renderSuggestionList(shell, props, props.editor, selectedIndex, setSelected);
      requestAnimationFrame(() => {
        if (shell) positionEl(shell, props);
      });
    },
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (!lastProps || lastProps.items.length === 0) return false;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelected(selectedIndex + 1);
        return true;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelected(selectedIndex - 1);
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const item = lastProps.items[selectedIndex];
        if (item && editorRef) {
          event.preventDefault();
          applyMention(editorRef, lastProps, item);
          return true;
        }
      }
      return false;
    },
    onExit: () => {
      document.removeEventListener("mousedown", onDocPointerDown, true);
      document.removeEventListener("keydown", onDocKeyDown, true);
      shell?.remove();
      shell = null;
      lastProps = null;
      editorRef = null;
      selectedIndex = 0;
    },
  };
}

/**
 * Instancia Mention con soporte opcional `@all` (departamento de la entrada en
 * edición) y búsqueda multi-departamento — útil cuando la nota está compartida
 * con otros departamentos y quieres poder mencionar a sus miembros.
 *
 * @param departmentIdForAll  Departamento dueño de la nota. Habilita `@all`.
 * @param extraDepartmentIds  Departamentos adicionales (p. ej. los `shares`)
 *                            cuyos miembros también aparecerán en el autocompletado.
 */
export function createRichEditorMention(
  departmentIdForAll: string,
  extraDepartmentIds: string[] = []
) {
  return Mention.configure({
    HTMLAttributes: {
      class: "mention-node",
    },
    suggestion: {
      pluginKey: richEditorMentionPluginKey,
      char: "@",
      allowSpaces: false,
      shouldShow: ({ query }) => (query?.trim() ?? "").length >= 1,
      items: async ({ query }) =>
        fetchMentionItemsWithDeptOption(
          query,
          departmentIdForAll,
          extraDepartmentIds
        ),
      render: () => createMentionSuggestionRender(),
    },
  });
}
