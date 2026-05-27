/**
 * Auto-draft de novedades a partir del historial git.
 *
 * Lee los commits del repositorio desde la fecha del último release-note
 * publicado (o los últimos 40 si no hay ninguno), los filtra, los agrupa por
 * categoría usando prefijos convencionales (`feat`, `fix`, `refactor`…) y
 * reformula los mensajes a lenguaje cotidiano que cualquier compañero pueda
 * entender, sin jerga técnica.
 *
 * No usa IA externa: todo es determinista a base de reglas + diccionario.
 */

import { execFileSync } from "node:child_process";
import { prisma } from "@/lib/prisma/client";
import { ReleaseNoteCategory } from "@/app/generated/prisma/enums";

export interface AutoDraftPayload {
  title: string;
  version: string;
  summary: string;
  /** HTML listo para guardar (será sanitizado por el backend al persistir). */
  body: string;
  category: ReleaseNoteCategory;
  /** Número de commits que han entrado en el resumen (después del filtrado). */
  commitCount: number;
  /** Si no había nada nuevo desde la última novedad. */
  empty: boolean;
}

/* ────────────────────────────────────────────────────────────────────────────
 *  1. Lectura de commits desde git
 * ────────────────────────────────────────────────────────────────────────── */

interface RawCommit {
  hash: string;
  date: Date;
  subject: string;
  body: string;
}

const COMMIT_SEPARATOR = "<<<CC_COMMIT_SEP>>>";
const FIELD_SEPARATOR = "<<<CC_FIELD_SEP>>>";

function readCommitsSince(sinceIso: string | null): RawCommit[] {
  // Formato: hash | iso-date | subject | body (separados por nuestros tokens)
  const format = ["%H", "%cI", "%s", "%b"].join(FIELD_SEPARATOR) + COMMIT_SEPARATOR;
  const args = [
    "log",
    `--pretty=format:${format}`,
    "--no-merges",
    // Solo el primer parent en merges (irrelevante por --no-merges, pero seguro)
    "--first-parent",
  ];
  if (sinceIso) {
    args.push(`--since=${sinceIso}`);
  } else {
    args.push("-n", "40");
  }

  let stdout: string;
  try {
    stdout = execFileSync("git", args, {
      cwd: process.cwd(),
      encoding: "utf-8",
      // Si tarda más de 8s, abortamos
      timeout: 8_000,
      // No queremos que stderr contamine la salida
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 4 * 1024 * 1024,
    });
  } catch (err) {
    console.error("[release-notes-autodraft] git log failed", err);
    return [];
  }

  return stdout
    .split(COMMIT_SEPARATOR)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw): RawCommit | null => {
      const [hash, dateStr, subject, body] = raw.split(FIELD_SEPARATOR);
      if (!hash || !subject) return null;
      const date = new Date(dateStr ?? Date.now());
      return {
        hash: hash.slice(0, 7),
        date: isNaN(date.getTime()) ? new Date() : date,
        subject: subject.trim(),
        body: (body ?? "").trim(),
      };
    })
    .filter((c): c is RawCommit => c !== null);
}

/* ────────────────────────────────────────────────────────────────────────────
 *  2. Filtrado de ruido
 * ────────────────────────────────────────────────────────────────────────── */

const NOISE_PATTERNS = [
  /^merge\b/i,
  /^revert\b/i,
  /^chore(\(.+?\))?:\s*(release|version|bump|deps|deps?-?update|cleanup|format)/i,
  /^build(\(.+?\))?:/i,
  /^ci(\(.+?\))?:/i,
  /^docs?(\(.+?\))?:/i,
  /^style(\(.+?\))?:\s*(format|lint|prettier)/i,
  /^test(\(.+?\))?:/i,
  /^wip\b/i,
  /^tmp\b/i,
  /^typo\b/i,
  /^restart service\b/i,
  /^update package(-lock)?\.json/i,
];

function isNoise(commit: RawCommit): boolean {
  if (NOISE_PATTERNS.some((rx) => rx.test(commit.subject))) return true;
  // Subjects ultra cortos (<= 4 chars) probablemente no aportan
  if (commit.subject.length <= 4) return true;
  return false;
}

/* ────────────────────────────────────────────────────────────────────────────
 *  3. Clasificación por categoría
 * ────────────────────────────────────────────────────────────────────────── */

type CommitClass = "feature" | "improvement" | "fix" | "breaking";

interface ParsedCommit {
  hash: string;
  date: Date;
  classification: CommitClass;
  scope: string | null;
  message: string;
  /** Cuerpo del commit, ya saneado de saltos extras. */
  detail: string;
  breaking: boolean;
}

function parseCommit(commit: RawCommit): ParsedCommit | null {
  if (isNoise(commit)) return null;

  // Detectar BREAKING CHANGE
  const isBreaking =
    /^[a-z]+(\(.+?\))?!:/i.test(commit.subject) ||
    /BREAKING CHANGE/i.test(commit.body);

  // Convención: type(scope): mensaje
  const convMatch = commit.subject.match(
    /^([a-zA-Z]+)(?:\(([^)]+)\))?!?:\s*(.+)$/
  );

  let type = "";
  let scope: string | null = null;
  let message = commit.subject;

  if (convMatch) {
    type = convMatch[1]!.toLowerCase();
    scope = (convMatch[2] ?? null)?.toLowerCase() ?? null;
    message = convMatch[3]!.trim();
  }

  let classification: CommitClass;
  if (isBreaking) {
    classification = "breaking";
  } else if (
    type === "feat" ||
    type === "feature" ||
    /\bañad[ie]|\bnuevo\b|\bcrea[rd]|\bagregad?\b/i.test(message)
  ) {
    classification = "feature";
  } else if (
    type === "fix" ||
    type === "bug" ||
    type === "hotfix" ||
    /\barreglad?|\bsoluciona[rd]?|\bcorri[gj]/i.test(message)
  ) {
    classification = "fix";
  } else if (
    type === "perf" ||
    type === "improve" ||
    type === "refactor" ||
    type === "ux" ||
    type === "ui" ||
    type === "style" ||
    /\bmejorad?|\boptimizad?|\bredise[ñn]ad?/i.test(message)
  ) {
    classification = "improvement";
  } else {
    classification = "improvement";
  }

  return {
    hash: commit.hash,
    date: commit.date,
    classification,
    scope,
    message,
    detail: commit.body.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n"),
    breaking: isBreaking,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 *  4. Reformulación a lenguaje cotidiano
 * ────────────────────────────────────────────────────────────────────────── */

/** Diccionario scope técnico → nombre que ve el usuario en la app. */
const SCOPE_LABELS: Record<string, string> = {
  bitacora: "Bitácora",
  bitácora: "Bitácora",
  log: "Bitácora",
  logs: "Bitácora",
  novedades: "Novedades",
  release: "Novedades",
  "release-notes": "Novedades",
  releasenotes: "Novedades",
  avisos: "Avisos globales",
  announcement: "Avisos globales",
  announcements: "Avisos globales",
  chat: "Mensajes",
  mensajes: "Mensajes",
  proyectos: "Proyectos",
  proyecto: "Proyectos",
  projects: "Proyectos",
  project: "Proyectos",
  kanban: "Proyectos",
  tasks: "Tareas",
  task: "Tareas",
  tareas: "Tareas",
  calendario: "Calendario",
  calendar: "Calendario",
  evento: "Calendario",
  eventos: "Calendario",
  events: "Calendario",
  dashboard: "Inicio",
  configuracion: "Configuración",
  configuración: "Configuración",
  config: "Configuración",
  ajustes: "Configuración",
  settings: "Configuración",
  usuarios: "Usuarios",
  user: "Usuarios",
  users: "Usuarios",
  perfil: "Mi cuenta",
  profile: "Mi cuenta",
  cuenta: "Mi cuenta",
  account: "Mi cuenta",
  notifications: "Notificaciones",
  notif: "Notificaciones",
  push: "Notificaciones",
  sounds: "Sonidos",
  sonido: "Sonidos",
  sonidos: "Sonidos",
  audio: "Sonidos",
  media: "Archivos adjuntos",
  upload: "Archivos adjuntos",
  uploads: "Archivos adjuntos",
  archivos: "Archivos adjuntos",
  login: "Inicio de sesión",
  auth: "Inicio de sesión",
  signin: "Inicio de sesión",
  bug: "Reporte de bugs",
  bugs: "Reporte de bugs",
  incidencias: "Bandeja de incidencias",
  bandeja: "Bandeja de incidencias",
  mobile: "Móvil",
  movil: "Móvil",
  móvil: "Móvil",
  responsive: "Móvil",
  ui: "Diseño",
  ux: "Diseño",
  visual: "Diseño",
  theme: "Diseño",
  tema: "Diseño",
  layout: "Diseño",
  sidebar: "Navegación",
  navbar: "Navegación",
  nav: "Navegación",
  header: "Navegación",
  traspaso: "Traspaso",
  handoff: "Traspaso",
  reports: "Informes",
  informe: "Informes",
  informes: "Informes",
  reactions: "Reacciones",
  reaccion: "Reacciones",
  comments: "Comentarios",
  comentarios: "Comentarios",
  mentions: "Menciones",
  menciones: "Menciones",
  microsoft: "Microsoft 365",
  outlook: "Microsoft 365",
  teams: "Microsoft 365",
};

/** Reemplazos literales de palabras técnicas que aparecen en commits. */
const TERM_REPLACEMENTS: [RegExp, string][] = [
  // Inglés técnico → español llano
  [/\bAPI\b/g, "el servidor"],
  [/\bendpoint(s)?\b/gi, "función$1 del servidor"],
  [/\bbackend\b/gi, "servidor"],
  [/\bfrontend\b/gi, "la app"],
  [/\bUI\b/g, "interfaz"],
  [/\bUX\b/g, "experiencia"],
  [/\bperformance\b/gi, "rendimiento"],
  [/\blint(ing)?\b/gi, "revisión de código"],
  [/\btypecheck\b/gi, "revisión de tipos"],
  [/\bbuild\b/gi, "compilación"],
  [/\brefactor(ed|ing)?\b/gi, "reorganización"],
  [/\bcleanup\b/gi, "limpieza"],
  [/\bdeploy(ment)?\b/gi, "publicación"],
  [/\brestart\b/gi, "reinicio"],
  [/\brace condition\b/gi, "conflicto de tiempos"],
  [/\bmemory leak\b/gi, "fuga de memoria"],
  [/\bz-?index\b/gi, "orden de capas"],
  [/\boverlay\b/gi, "ventana flotante"],
  [/\bmodal\b/gi, "ventana"],
  [/\bdropdown\b/gi, "desplegable"],
  [/\btooltip\b/gi, "indicador de ayuda"],
  [/\btoast\b/gi, "aviso emergente"],
  [/\bsnapshot\b/gi, "copia"],
  [/\bdebounce\b/gi, "espera anti-rebote"],
  [/\bcache\b/gi, "caché"],
  [/\bcron\b/gi, "tarea programada"],
  [/\bcrash(ed|es)?\b/gi, "fallo"],
  [/\bbreaking change\b/gi, "cambio importante"],
  [/\brollback\b/gi, "vuelta atrás"],
  [/\bhotfix\b/gi, "parche urgente"],
  [/\bworkaround\b/gi, "solución alternativa"],
  [/\bdry\s*run\b/gi, "prueba en seco"],
  [/\bSSE\b/g, "actualización en tiempo real"],
  [/\bWebSocket\b/gi, "conexión en tiempo real"],
  [/\bMIME\b/g, "tipo de archivo"],
  [/\bauth(entication)?\b/gi, "inicio de sesión"],
  [/\bsuper\s*admin\b/gi, "administrador maestro"],
  [/\bn\s*\+\s*1\b/gi, "consulta repetida"],
  // Convenciones que aparecen sueltas
  [/\bz-index\b/gi, "orden de capas"],
];

function humanizeMessage(raw: string): string {
  let s = raw;
  // Sustituir términos técnicos
  for (const [rx, rep] of TERM_REPLACEMENTS) {
    s = s.replace(rx, rep);
  }
  // Mayúscula inicial
  s = s.trim();
  if (s.length === 0) return s;
  s = s.charAt(0).toUpperCase() + s.slice(1);
  // Quitar punto final repetido y normalizar puntuación
  s = s.replace(/\.+$/g, "").trim();
  return s;
}

function readableScope(scope: string | null): string | null {
  if (!scope) return null;
  const key = scope.toLowerCase().trim();
  return SCOPE_LABELS[key] ?? null;
}

/* ────────────────────────────────────────────────────────────────────────────
 *  5. Agrupado y deduplicación
 * ────────────────────────────────────────────────────────────────────────── */

interface GroupedItem {
  /** Texto humano final, sin el prefijo de scope. */
  text: string;
  /** Etiqueta visual (Bitácora, Mensajes…) o null si no se reconoce el scope. */
  scopeLabel: string | null;
  hashes: string[];
}

function groupAndDedupe(items: ParsedCommit[]): Record<CommitClass, GroupedItem[]> {
  const groups: Record<CommitClass, GroupedItem[]> = {
    feature: [],
    improvement: [],
    fix: [],
    breaking: [],
  };

  for (const item of items) {
    const scopeLabel = readableScope(item.scope);
    const text = humanizeMessage(item.message);

    // Deduplicación: si ya hay una entrada con el mismo texto y scope, juntamos hashes.
    const bucket = groups[item.classification];
    const dup = bucket.find(
      (g) => g.text.toLowerCase() === text.toLowerCase() && g.scopeLabel === scopeLabel
    );
    if (dup) {
      dup.hashes.push(item.hash);
    } else {
      bucket.push({ text, scopeLabel, hashes: [item.hash] });
    }
  }

  return groups;
}

/* ────────────────────────────────────────────────────────────────────────────
 *  6. Composición del payload final
 * ────────────────────────────────────────────────────────────────────────── */

function nextAutoVersion(latest: string | null): string {
  // Si la última terminaba en " — DD mes", solo cambiamos la fecha.
  // Si tenía formato vX.Y o vX.Y.Z, incrementamos Y.
  const today = new Date();
  const dateLabel = today.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });

  if (!latest) {
    return `v1.0 — ${dateLabel}`;
  }

  const semver = latest.match(/v?(\d+)\.(\d+)(?:\.(\d+))?/);
  if (semver) {
    const major = Number(semver[1]);
    const minor = Number(semver[2]) + 1;
    return `v${major}.${minor} — ${dateLabel}`;
  }

  return `Actualización — ${dateLabel}`;
}

function pickHeroCategory(groups: Record<CommitClass, GroupedItem[]>): ReleaseNoteCategory {
  if (groups.breaking.length > 0) return ReleaseNoteCategory.BREAKING;
  if (groups.feature.length >= groups.fix.length && groups.feature.length > 0) {
    return ReleaseNoteCategory.FEATURE;
  }
  if (groups.fix.length > 0 && groups.feature.length === 0 && groups.improvement.length === 0) {
    return ReleaseNoteCategory.FIX;
  }
  if (groups.improvement.length > 0) return ReleaseNoteCategory.IMPROVEMENT;
  return ReleaseNoteCategory.FEATURE;
}

function composeTitle(groups: Record<CommitClass, GroupedItem[]>): string {
  const f = groups.feature.length;
  const i = groups.improvement.length;
  const x = groups.fix.length;
  const b = groups.breaking.length;

  if (b > 0) return "Cambios importantes en esta versión";
  if (f > 0 && i === 0 && x === 0) {
    return f === 1 ? "Nueva funcionalidad" : "Nuevas funcionalidades";
  }
  if (x > 0 && f === 0 && i === 0) {
    return x === 1 ? "Arreglo aplicado" : "Arreglos aplicados";
  }
  if (i > 0 && f === 0 && x === 0) {
    return i === 1 ? "Mejora visual" : "Mejoras y ajustes";
  }
  if (f > 0 && (i > 0 || x > 0)) {
    return "Novedades y mejoras de esta semana";
  }
  return "Actualización de la app";
}

function composeSummary(groups: Record<CommitClass, GroupedItem[]>): string {
  const parts: string[] = [];
  if (groups.feature.length > 0) {
    parts.push(
      `${groups.feature.length} novedad${groups.feature.length === 1 ? "" : "es"}`
    );
  }
  if (groups.improvement.length > 0) {
    parts.push(
      `${groups.improvement.length} mejora${groups.improvement.length === 1 ? "" : "s"}`
    );
  }
  if (groups.fix.length > 0) {
    parts.push(
      `${groups.fix.length} arreglo${groups.fix.length === 1 ? "" : "s"}`
    );
  }
  if (groups.breaking.length > 0) {
    parts.push(
      `${groups.breaking.length} cambio${groups.breaking.length === 1 ? "" : "s"} importante${groups.breaking.length === 1 ? "" : "s"}`
    );
  }
  if (parts.length === 0) {
    return "Pequeños ajustes internos para que todo funcione mejor.";
  }
  const human = listWithCommasAnd(parts);
  return `Esta versión incluye ${human}. Echa un vistazo abajo para los detalles.`;
}

function listWithCommasAnd(arr: string[]): string {
  if (arr.length === 0) return "";
  if (arr.length === 1) return arr[0]!;
  if (arr.length === 2) return `${arr[0]} y ${arr[1]}`;
  return `${arr.slice(0, -1).join(", ")} y ${arr[arr.length - 1]}`;
}

function renderSection(
  emoji: string,
  heading: string,
  items: GroupedItem[]
): string {
  if (items.length === 0) return "";
  const lis = items
    .map((it) => {
      const scope = it.scopeLabel ? `<strong>${escapeHtml(it.scopeLabel)}:</strong> ` : "";
      const text = escapeHtml(it.text);
      const punct = /[.!?…]$/.test(it.text) ? "" : ".";
      return `<li>${scope}${text}${punct}</li>`;
    })
    .join("");
  return `<h3>${emoji} ${escapeHtml(heading)}</h3><ul>${lis}</ul>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function composeBody(groups: Record<CommitClass, GroupedItem[]>): string {
  const sections: string[] = [];
  if (groups.breaking.length > 0) {
    sections.push(
      renderSection("⚠️", "Cambios importantes", groups.breaking)
    );
  }
  if (groups.feature.length > 0) {
    sections.push(
      renderSection("✨", "Lo nuevo", groups.feature)
    );
  }
  if (groups.improvement.length > 0) {
    sections.push(
      renderSection("💎", "Mejoras", groups.improvement)
    );
  }
  if (groups.fix.length > 0) {
    sections.push(
      renderSection("🐛", "Arreglos", groups.fix)
    );
  }
  if (sections.length === 0) {
    return "<p>Pequeños ajustes internos en esta versión. No hay cambios visibles para el equipo.</p>";
  }

  const intro =
    "<p>Hola equipo, este es el resumen de lo que ha cambiado. Si veis algo raro, escribidme y lo miramos.</p>";
  return intro + sections.join("");
}

/* ────────────────────────────────────────────────────────────────────────────
 *  7. Punto de entrada público
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Genera un borrador de novedad a partir de los commits desde el último
 * release-note publicado (o, si no hay ninguno, los últimos 40 commits).
 *
 * No persiste nada: el frontend recibe el payload y el dueño decide qué
 * publicar/editar.
 */
export async function buildAutoDraft(): Promise<AutoDraftPayload> {
  // Última novedad publicada (no borrador, no eliminada) para usar como cota
  const lastPublished = await prisma.releaseNote.findFirst({
    where: { isDraft: false, deletedAt: null },
    orderBy: { publishedAt: "desc" },
    select: { publishedAt: true, version: true },
  });

  const sinceIso = lastPublished?.publishedAt
    ? lastPublished.publishedAt.toISOString()
    : null;

  const rawCommits = readCommitsSince(sinceIso);
  const parsed = rawCommits
    .map(parseCommit)
    .filter((c): c is ParsedCommit => c !== null);

  const groups = groupAndDedupe(parsed);
  const commitCount =
    groups.feature.length +
    groups.improvement.length +
    groups.fix.length +
    groups.breaking.length;

  if (commitCount === 0) {
    return {
      title: "Sin cambios desde la última novedad",
      version: nextAutoVersion(lastPublished?.version ?? null),
      summary:
        "No he encontrado commits nuevos desde la última novedad publicada. Si crees que sí los hay, comprueba que la última novedad no esté como borrador.",
      body: "<p>No hay cambios nuevos para incluir en esta novedad.</p>",
      category: ReleaseNoteCategory.ANNOUNCEMENT,
      commitCount: 0,
      empty: true,
    };
  }

  return {
    title: composeTitle(groups),
    version: nextAutoVersion(lastPublished?.version ?? null),
    summary: composeSummary(groups),
    body: composeBody(groups),
    category: pickHeroCategory(groups),
    commitCount,
    empty: false,
  };
}
