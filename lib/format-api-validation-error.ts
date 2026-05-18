/** Convierte el cuerpo de error de la API (p. ej. Zod flatten) en texto legible para toast. */
export function formatApiValidationError(payload: unknown): string | null {
  if (payload == null) return null;
  if (typeof payload === "string" && payload.trim()) return payload.trim();

  if (typeof payload !== "object") return null;
  const o = payload as Record<string, unknown>;

  if (typeof o.message === "string" && o.message.trim()) return o.message.trim();
  if (typeof o.error === "string" && o.error.trim()) return o.error.trim();

  const err = o.error;
  if (err && typeof err === "object" && !Array.isArray(err)) {
    const fromFlatten = flattenZodLike(err as Record<string, unknown>);
    if (fromFlatten) return fromFlatten;
  }

  return flattenZodLike(o);
}

function flattenZodLike(obj: Record<string, unknown>): string | null {
  const parts: string[] = [];

  const fieldErrors = obj.fieldErrors;
  if (fieldErrors && typeof fieldErrors === "object") {
    for (const [key, val] of Object.entries(fieldErrors as Record<string, unknown>)) {
      const msgs = normalizeMessages(val);
      if (msgs.length) parts.push(`${labelForField(key)}: ${msgs.join(", ")}`);
    }
  }

  const formErrors = obj.formErrors;
  if (Array.isArray(formErrors)) {
    for (const m of formErrors) {
      if (typeof m === "string" && m.trim()) parts.push(m.trim());
    }
  }

  return parts.length ? parts.join(" · ") : null;
}

function normalizeMessages(val: unknown): string[] {
  if (typeof val === "string" && val.trim()) return [val.trim()];
  if (Array.isArray(val)) {
    return val
      .filter((m): m is string => typeof m === "string" && m.trim().length > 0)
      .map((m) => m.trim());
  }
  return [];
}

function labelForField(key: string): string {
  const labels: Record<string, string> = {
    title: "Título",
    content: "Contenido",
    type: "Tipo",
    shift: "Turno",
    status: "Estado",
    departmentId: "Departamento",
    polls: "Encuestas",
    inviteeUserIds: "Invitados",
    forDate: "Fecha",
  };
  return labels[key] ?? key;
}
