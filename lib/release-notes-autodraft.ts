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

/**
 * Lee los commits desde `since` (siempre acotado por fecha; nunca se
 * traen los ultimos N commits ciegos para no incluir commits viejos).
 */
function readCommitsSince(since: Date): RawCommit[] {
  // Formato: hash | iso-date | subject | body (separados por nuestros tokens)
  const format = ["%H", "%cI", "%s", "%b"].join(FIELD_SEPARATOR) + COMMIT_SEPARATOR;
  const args = [
    "log",
    `--pretty=format:${format}`,
    "--no-merges",
    // Solo el primer parent en merges (irrelevante por --no-merges, pero seguro)
    "--first-parent",
    `--since=${since.toISOString()}`,
  ];

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
    .filter((c): c is RawCommit => c !== null)
    // Extra-safety: aunque git --since suele respetar la fecha, filtramos
    // tambien aqui por si acaso (timezones, commits con --date sobrescrita,
    // etc.).
    .filter((c) => c.date.getTime() >= since.getTime());
}

/**
 * Devuelve hoy a las 00:00:00.000 en hora local del servidor.
 */
function startOfLocalDay(): Date {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  );
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

interface BulletLine {
  /** Texto del bullet, sin el guion/asterisco inicial. */
  text: string;
  /** Si el cuerpo trae `feat:` / `fix:` dentro del bullet, lo respetamos. */
  type: string | null;
}

/**
 * Extrae lineas de bullet del cuerpo del commit (`- foo`, `* bar`,
 * `1. baz`). Devuelve [] si no hay ninguno.
 */
function extractBulletsFromBody(body: string): BulletLine[] {
  if (!body) return [];
  const out: BulletLine[] = [];
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    // Conventional Commits trailers como "Co-authored-by:" o "Refs:" no son novedades
    if (/^(co-authored-by|signed-off-by|refs|reviewed-by|closes|fixes):/i.test(line)) {
      continue;
    }
    const m = line.match(/^(?:[-*•]|\d+[.)])\s+(.*\S)/);
    if (!m) continue;
    const content = m[1]!.trim();
    if (content.length < 4) continue;
    // Si el bullet tiene su propio prefijo "feat:" o "fix:", lo usamos.
    const typeMatch = content.match(/^([a-zA-Z]+):\s*/);
    let type: string | null = null;
    let text = content;
    if (typeMatch) {
      type = typeMatch[1]!.toLowerCase();
      text = content.slice(typeMatch[0].length).trim();
    }
    out.push({ text, type });
  }
  return out;
}

/**
 * Cuando alguien escribe `feat(novedades): foo, bar, baz y qux` queremos
 * desglosarlo en 4 bullets. Solo cortamos cuando el mensaje no contiene
 * dos puntos/parentesis raros y todos los items quedan razonablemente
 * cortos (evitamos cortar frases naturales con comas).
 */
function maybeSplitMessage(message: string): string[] {
  if (!message) return [message];
  // Si hay punto y aparte, ya es una frase compuesta; no troceamos.
  if (/[.!?]/.test(message)) return [message];
  // Si es muy corto, no merece la pena.
  if (message.length < 25) return [message];

  // Cortar por coma o " y " (manteniendo la primera mayuscula).
  const parts = message
    .replace(/\s+y\s+/gi, ", ")
    .split(/\s*,\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length < 2) return [message];
  // Heuristica: cada parte debe ser >=5 chars y la suma de longitudes
  // de cada parte debe ser parecida (rechaza algo como "foo, sobre todo cuando bar...").
  if (parts.some((p) => p.length < 5)) return [message];
  if (parts.length > 8) return [message]; // probablemente texto continuo
  return parts;
}

/**
 * Convierte un RawCommit en 1 o varios ParsedCommit:
 *   - Subject simple sin desgloses    -> 1 entrada.
 *   - Subject con "a, b y c"          -> N entradas.
 *   - Subject + body con bullets      -> 1 + N entradas.
 *
 * Devuelve array vacio si es ruido.
 */
function parseCommit(commit: RawCommit): ParsedCommit[] {
  if (isNoise(commit)) return [];

  const isBreaking =
    /^[a-z]+(\(.+?\))?!:/i.test(commit.subject) ||
    /BREAKING CHANGE/i.test(commit.body);

  const convMatch = commit.subject.match(
    /^([a-zA-Z]+)(?:\(([^)]+)\))?!?:\s*(.+)$/,
  );

  let type = "";
  let scope: string | null = null;
  let subjectMsg = commit.subject;
  if (convMatch) {
    type = convMatch[1]!.toLowerCase();
    scope = (convMatch[2] ?? null)?.toLowerCase() ?? null;
    subjectMsg = convMatch[3]!.trim();
  }

  function classify(commitType: string, msg: string): CommitClass {
    if (isBreaking) return "breaking";
    if (
      commitType === "feat" ||
      commitType === "feature" ||
      /\baña[dn]|\bnuevo\b|\bcrea[rd]|\bagregad?\b/i.test(msg)
    ) {
      return "feature";
    }
    if (
      commitType === "fix" ||
      commitType === "bug" ||
      commitType === "hotfix" ||
      /\barreglad?|\bsoluciona[rd]?|\bcorri[gj]/i.test(msg)
    ) {
      return "fix";
    }
    if (
      commitType === "perf" ||
      commitType === "improve" ||
      commitType === "refactor" ||
      commitType === "ux" ||
      commitType === "ui" ||
      commitType === "style" ||
      /\bmejorad?|\boptimizad?|\bredise[ñn]ad?/i.test(msg)
    ) {
      return "improvement";
    }
    return "improvement";
  }

  const detail = commit.body.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  const bullets = extractBulletsFromBody(detail);

  const results: ParsedCommit[] = [];

  if (bullets.length > 0) {
    // Si el cuerpo tiene bullets explicitos, esos son las novedades; el
    // subject queda como "titulo" y NO se emite como entry separada salvo
    // que sea suficientemente especifico.
    for (const b of bullets) {
      const effectiveType = b.type ?? type;
      results.push({
        hash: commit.hash,
        date: commit.date,
        classification: classify(effectiveType, b.text),
        scope,
        message: b.text,
        detail: "",
        breaking: isBreaking,
      });
    }
  } else {
    // Sin bullets: probar a desglosar el subject por comas/`y`.
    const pieces = maybeSplitMessage(subjectMsg);
    for (const piece of pieces) {
      results.push({
        hash: commit.hash,
        date: commit.date,
        classification: classify(type, piece),
        scope,
        message: piece,
        detail,
        breaking: isBreaking,
      });
    }
  }

  return results;
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
  // ── Seguridad y autenticación
  [/\bbcrypt\b/gi, "cifrado de contraseñas"],
  [/\bhash(ing|ed)?\b/gi, "cifrado"],
  [/\bsalt(ing|ed)?\b/gi, "cifrado"],
  [/\brate[\s-]?limit(ing|ed)?\b/gi, "límite de intentos"],
  [/\bthrottl(e|ing|ed)\b/gi, "límite de intentos"],
  [/\block[\s-]?out\b/gi, "bloqueo temporal de la cuenta"],
  [/\bsess?ion(s)?\b/gi, "sesión$1"],
  [/\btoken(s)?\b/gi, "credencial$1 de sesión"],
  [/\bJWT(s)?\b/g, "credencial$1 de sesión"],
  [/\bCSRF\b/g, "ataques de origen cruzado"],
  [/\bXSS\b/g, "código malicioso inyectado"],
  [/\bSSRF\b/g, "peticiones a redes internas"],
  [/\bIDOR(s)?\b/gi, "acceso a recursos ajenos"],
  [/\bsanitiz(e|ing|ed|er|ation)\b/gi, "limpieza"],
  [/\bescape[d]?\b/gi, "limpieza"],
  [/\bwhitelist(ing|ed)?\b/gi, "lista permitida"],
  [/\bblacklist(ing|ed)?\b/gi, "lista bloqueada"],
  [/\bvalidate[d]?\b/gi, "validar"],
  [/\bvalidation\b/gi, "validación"],
  [/\bpermission(s)?\b/gi, "permiso$1"],
  [/\brole(s)?\b/gi, "rol$1"],
  [/\bbruteforce\b/gi, "ataque por fuerza bruta"],
  // ── Red / web
  [/\bHSTS\b/g, "conexión segura forzada"],
  [/\bCSP\b/g, "política de seguridad del navegador"],
  [/\bDNS\b/g, "resolución de nombres"],
  [/\bIPv?[46]?\b/g, "direcciones de red"],
  [/\bTCP\b/g, "conexión de red"],
  [/\bHTTPS?\b/g, "web"],
  [/\bTLS\b/g, "conexión cifrada"],
  [/\bSSL\b/g, "conexión cifrada"],
  [/\bCORS\b/g, "orígenes permitidos"],
  [/\bhostname(s)?\b/gi, "dirección$1 web"],
  [/\bredirect(s)?\b/gi, "redirección$1"],
  // ── Datos / DB
  [/\bschema(s)?\b/gi, "estructura$1 de datos"],
  [/\bmigration(s)?\b/gi, "traslado$1 de datos"],
  [/\bmigrat(e|ing|ed)\b/gi, "trasladar"],
  [/\bquery(ing)?\b/gi, "consulta$1"],
  [/\brecord(s)?\b/gi, "registro$1"],
  [/\bdraft(s)?\b/gi, "borrador$1"],
  [/\bidempoten(t|cy)\b/gi, "seguro de repetir"],
  // ── Términos de proceso / código
  [/\bhandler(s)?\b/gi, "manejador$1"],
  [/\bmiddleware\b/gi, "control intermedio"],
  [/\bhardcoded\b/gi, "fijo en el código"],
  [/\bdebug(ging|ged)?\b/gi, "diagnóstico"],
  [/\blog(s|ging|ged)?\b/gi, "registro"],
  [/\bcommit(s|ted)?\b/gi, "cambio$1"],
  [/\bmagic\s*bytes\b/gi, "contenido real del archivo"],
  [/\bpayload(s)?\b/gi, "contenido$1"],
  [/\brequest(s)?\b/gi, "petición$1"],
  [/\bresponse(s)?\b/gi, "respuesta$1"],
  [/\btimeout(s)?\b/gi, "tiempo límite"],
  [/\bgranular\b/gi, "afinado"],
  [/\bsafe-?guard(s)?\b/gi, "protección$1"],
  [/\bunlink(ed)?\b/gi, "borrado"],
  // ── Identificadores comunes que se filtran sueltos
  [/\bedge config\b/gi, "configuración global"],
  [/\bnext\.config(\.ts|\.js)?\b/gi, "configuración global"],
  [/\bnextauth\b/gi, "sistema de inicio de sesión"],
  [/\bprisma\b/gi, "base de datos"],
  [/\bcurrentPassword\b/g, "contraseña actual"],
  [/\bpasswordChangedAt\b/g, "fecha de cambio de contraseña"],
  [/\bisSelf\b/g, "uno mismo"],
  [/\busers?\.role\b/gi, "rol del usuario"],
  // ── Términos de diseño UI que sin contexto no significan nada
  [/\bhero(\s+section)?\b/gi, "cabecera destacada"],
  [/\bKPI(s)?\b/g, "indicador$1 clave"],
  [/\bCTA(s)?\b/g, "botón$1 de acción"],
  [/\bchip(s)?\b/gi, "etiqueta$1"],
  [/\bpill(s)?\b/gi, "etiqueta$1"],
  [/\bbadge(s)?\b/gi, "etiqueta$1"],
  [/\bglassmorphism\b/gi, "estética acristalada"],
  [/\bscrim\b/gi, "fondo difuminado"],
  [/\bring\b/gi, "borde de resalte"],
  [/\bgradient(s)?\b/gi, "degradado$1"],
  [/\bshimmer\b/gi, "efecto brillante"],
  [/\btheme-?aware\b/gi, "compatible con modo claro y oscuro"],
  [/\bdark-?only\b/gi, "solo modo oscuro"],
  [/\blight-?mode\b/gi, "modo claro"],
  [/\bdark-?mode\b/gi, "modo oscuro"],
  [/\bskeleton(s)?\b/gi, "esqueleto$1 de carga"],
  [/\bsticky\b/gi, "fijo en pantalla"],
  [/\bcollapse(d|ing)?\b/gi, "plegado"],
  [/\bexpand(ed|ing)?\b/gi, "desplegado"],
  [/\btoggle(s|d)?\b/gi, "interruptor$1"],
  [/\baccent(s)?\b/gi, "acento$1 visual"],
  [/\bsnapshot panel\b/gi, "panel de instantáneas"],
  [/\bdialog\b/gi, "ventana de diálogo"],
  [/\bportal\b/gi, "anclaje flotante"],
  [/\bCard(s)?\b/g, "tarjeta$1"],
  [/\bstrip(s)?\b/gi, "tira$1"],
  [/\bshell\b/gi, "marco común"],
  [/\bedge\b/gi, "borde"],
  [/\bhardcoded?\b/gi, "fijo"],
  [/\bplano\b/gi, "plano"],
  [/\bgris(aceo)?\b/gi, "gris"],
  // ── Símbolos / marcas técnicas que ensucian
  [/\(C\d+(?:,\s*[CHM]?\d+)*\)/g, ""], // (C1, C2, H3)
  [/\b[CHM]\d+(?:\/[CHM]\d+)*\b/g, ""], // C1, C2/C3, H7…
  // Saltos de línea raros del body
  [/[\r\n]+/g, " "],
];

/**
 * Detecta si el texto contiene marcadores que solo entiende un dev
 * (paths, nombres de archivos/clases internas, jerga cripto/red).
 * Se aplica DESPUÉS de la sustitución de términos: si todavía quedan
 * marcadores, asumimos que la línea es demasiado técnica para usuarios.
 */
const TECHNICAL_TOKEN_PATTERNS: RegExp[] = [
  // Rutas de archivos
  /\b[\w.-]+\.(ts|tsx|js|jsx|json|prisma|sql|yml|yaml|md|env|css|scss|html)\b/i,
  // Rutas con carpeta /
  /\b(lib|app|components|hooks|utils|prisma|scripts|public|tests?|api|server|src)\/[\w/-]+/i,
  // Identifiers con punto Foo.bar (User.role, Session.maxAge)
  /\b[A-Z][a-zA-Z]+\.[a-zA-Z_][a-zA-Z0-9_]+\b/,
  // CamelCase compuesto (ConfirmModal, DepartmentsTab, BoardSnapshotPanel)
  /\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/,
  // camelCase puro de >=8 caracteres (probablemente nombre interno)
  /\b[a-z]+[A-Z][a-zA-Z]{6,}\b/,
  // CONSTANTES UPPER_SNAKE (HSTS, NEXTAUTH_URL, FAILED_BEFORE_LOCK)
  /\b[A-Z][A-Z0-9]{2,}(?:_[A-Z0-9]+)+\b/,
  // Llamadas a función foo()
  /\b\w+\(\s*[^)]{0,40}\s*\)/,
  // Variables/flags tipo --foo, -X
  /(?:^|\s)--?[a-zA-Z][\w-]+/,
  // Bloques entre backticks `code`
  /`[^`]+`/,
  // Comandos típicos
  /\b(npm|yarn|pnpm|npx|nvm|git|node|tsc|eslint|prettier)\s+\w+/i,
  // Operadores y arrows en código (excepto la flecha que ya sustituimos)
  /=>|\|\||&&|::|===|\.{3}/,
  // URLs
  /\b\w+:\/\/\S+/,
  // Asignaciones var = valor
  /\b\w+\s*=\s*\w+/,
  // Cabeceras HTTP estilo X-Foo-Bar
  /\bX-[A-Z][a-zA-Z]+(?:-[A-Z][a-zA-Z]+)+/,
  // Métodos HTTP
  /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)(\/[A-Z]+)+\b/,
  // Status codes "410 Gone", "404", "500"
  /\b[345]\d{2}\b/,
];

function isPureTechnical(text: string): boolean {
  if (!text) return false;
  for (const rx of TECHNICAL_TOKEN_PATTERNS) {
    if (rx.test(text)) return true;
  }
  return false;
}

/**
 * Elimina artefactos técnicos pero conserva la frase si tras la limpieza
 * sigue teniendo sentido. Devuelve "" si la línea queda vacía.
 */
function stripTechnicalArtifacts(text: string): string {
  let s = text;
  // Convertir flechas -> y => a "a" (lectura natural)
  s = s.replace(/\s*->\s*|\s*=>\s*/g, " a ");
  // Quitar hex colors #abc #abcdef
  s = s.replace(/#[0-9a-fA-F]{3,8}\b/g, "");
  // Quitar clases Tailwind/CSS: text-white, bg-red-500, w-3.5, h-3.5
  s = s.replace(
    /\b(?:text|bg|border|p|m|mx|my|mt|mb|ml|mr|w|h|min-w|min-h|max-w|max-h|flex|grid|rounded|shadow|ring|opacity|gap|space|col|row|inset|top|bottom|left|right|z|tracking|leading|font|truncate|line-clamp|overflow|hover|focus|active|disabled|dark|light)-[a-z\d/.[\]-]+/gi,
    "",
  );
  // Quitar paths con extensión: lib/foo.ts, app/api/x.tsx
  s = s.replace(
    /\b[\w./[\]-]+?\.(ts|tsx|js|jsx|json|prisma|sql|yml|yaml|md|env|css|scss|html)\b/gi,
    "",
  );
  // Quitar paths estilo /api/foo/bar o /uploads/projects/*
  s = s.replace(/(?:^|\s)\/(?:api|uploads|public|lib|app|scripts|components)\/[\w/[\].*-]+/gi, " ");
  // Quitar referencias estilo Foo.bar (Modelo.campo)
  s = s.replace(/\b[A-Z][a-zA-Z]+\.[a-zA-Z_][a-zA-Z0-9_]+\b/g, "");
  // Quitar CamelCase compuesto (nombres de componentes/clases internas)
  s = s.replace(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g, "");
  // Quitar UPPER_SNAKE_CASE (constantes internas)
  s = s.replace(/\b[A-Z][A-Z0-9]{2,}(?:_[A-Z0-9]+)+\b/g, "");
  // Quitar llamadas a función foo(args)
  s = s.replace(/\b\w+\(\s*[^)]{0,60}\s*\)/g, "");
  // Quitar asignaciones var = valor (Session.maxAge = 7, cost = 12)
  s = s.replace(/\b\w+(?:\.\w+)?\s*=\s*[\w."'/-]+/g, "");
  // Quitar cabeceras HTTP X-Foo-Bar
  s = s.replace(/\bX-[A-Z][a-zA-Z]+(?:-[A-Z][a-zA-Z]+)+/g, "");
  // Quitar listas de métodos HTTP "POST/PATCH/DELETE", "GET/POST"
  s = s.replace(/\b(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)(?:\/(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS))+/g, "");
  // Quitar status codes 4xx/5xx sueltos
  s = s.replace(/\b[345]\d{2}\b/g, "");
  // Quitar paréntesis con contenido puramente técnico
  // Ej: (5 fallos -> 15 min) ; (8/15min) ; (C1, H3) ; (cost 12) ; (object-src none)
  s = s.replace(
    /\(\s*(?:[\d./-]+\s*(?:min|ms|s|sec|h|hour|hours|fallos?|veces|intentos?)|cost\s*\d+|C\d+(?:[,/\s]*[CHM]?\d+)*|[CHM]\d+(?:[,/\s]*[CHM]?\d+)*)\s*\)/gi,
    "",
  );
  // Quitar paréntesis con código (contiene `=`, `:` excepto inicio, `()`, comas con tipos)
  s = s.replace(/\([^()]{0,80}[=:]\s*\w[^()]{0,80}\)/g, "");
  s = s.replace(/\([^()]{0,80}[+&|/*]\s*\w[^()]{0,80}\)/g, "");
  // Quitar paréntesis vacíos o solo con basura
  s = s.replace(/\(\s*[+\-*/.]?\s*\)/g, "");
  // Compactar espacios y comas dentro de paréntesis ("(  ,  foo, bar  )" -> "(foo, bar)")
  s = s.replace(/\(\s*[,\s]+/g, "(");
  s = s.replace(/[,\s]+\s*\)/g, ")");
  s = s.replace(/\(\s*\)/g, "");
  // Quitar backticks y su contenido si parece código
  s = s.replace(/`[^`]+`/g, "");
  // Quitar -- flags y opciones
  s = s.replace(/(?:^|\s)--?[a-zA-Z][\w-]+(?=\s|$)/g, " ");
  // Quitar URLs sueltas
  s = s.replace(/\bhttps?:\/\/\S+/g, "");
  // Quitar esquemas javascript:, data:, mailto:
  s = s.replace(/\b(?:javascript|data|file|mailto|tel):\s*/gi, "");
  // Si quedan paréntesis no balanceados al final, quitarlos
  const openParens = (s.match(/\(/g) ?? []).length;
  const closeParens = (s.match(/\)/g) ?? []).length;
  if (openParens > closeParens) {
    s = s.replace(/\s*\([^()]*$/, "");
  }
  // Si quedan paréntesis no balanceados al inicio, quitarlos
  if (closeParens > openParens) {
    s = s.replace(/^[^()]*\)\s*/, "");
  }
  // Compactar espacios y comas duplicadas, signos colgando
  s = s.replace(/\s{2,}/g, " ");
  s = s.replace(/,\s*,/g, ",");
  s = s.replace(/\s+([,.;:])/g, "$1");
  s = s.replace(/^[\s,.:;+\-*/=]+/, "");
  s = s.replace(/[\s,.:;+\-*/=]+$/, "");
  return s.trim();
}

/**
 * Lista negra final: palabras que indican que la frase sigue siendo
 * jerga técnica aunque haya sobrevivido a las otras reglas. Si una
 * palabra de esta lista aparece tras humanizar, descartamos la línea.
 */
const FINAL_BLACKLIST_TOKENS: RegExp[] = [
  /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/,
  /\b(max-age|no-store|no-cache|object-src|script-src|style-src|img-src|media-src|connect-src|font-src|default-src|unsafe-inline|unsafe-eval|nonces?|self-?host)\w*/i,
  /\b(hop|rebinding|webhook|owner|trailers?|payload|stringify|parse|encode|decode|base64|hex|sha\d+)\b/i,
  /\b(cost|chars|password|token|undefined|null|cli(ent)?|hostname|subscribe|publish)\b/i,
  // Siglas técnicas que no aportan al usuario (BD/DB sí entendibles, no las metemos)
  /\b(UUID|UID|HTTPS?|FCM|WNS|APNs?|SSE|SSO|HSTS|DNS|TLS|SSL|XSS|CSRF|MIME|CDN|CSP|IDOR|JSON|XML|YAML|API|REST|SOAP|RPC)\b/,
  /\b(useTheme|useState|useEffect|useMemo|useCallback|useRef|useContext)\b/,
  /\[\d*\]/,
];

function hasBlacklistedToken(text: string): boolean {
  for (const rx of FINAL_BLACKLIST_TOKENS) {
    if (rx.test(text)) return true;
  }
  return false;
}

/**
 * Reglas para decidir si una linea debe DESCARTARSE por completo:
 *   - Muy corta tras limpiar (<10 chars o <4 palabras).
 *   - Termina en conjunción/preposición/coma (frase cortada por el body).
 *   - Empieza por verbo/conector sin sujeto (queda crípitca).
 *   - >50% de caracteres no alfabéticos (parece código).
 *   - Sigue conteniendo marcadores técnicos tras la limpieza.
 *   - Contiene una palabra de FINAL_BLACKLIST_TOKENS.
 */
const SENTENCE_FRAGMENT_TAIL =
  /\b(y|o|u|e|el|la|los|las|del|de|al|en|con|sin|por|para|que|si|no|cuando|donde|como|debe|hace|tiene|sobre|ni|pero|via)$/i;

/**
 * Verbos/adjetivos típicos que en español NO empiezan una frase con
 * sujeto explícito ("Persistido…", "Aplicado…", "Devuelve…", "Compatible
 * con…"). Indican que el sujeto era un identificador interno que ya
 * hemos eliminado, así que la frase queda manca.
 */
const SENTENCE_FRAGMENT_HEAD =
  /^(?:y\s|ya\s+no\s|ya\s|compatible\s+con|usa\s|devuelve\s|persistido|aplicado|trasladar|requiere\s|permite\s|exige\s|filtra\s|borra\s|hereda\s|comparte|incluye\s+solo|sin\s+depender)/i;

export function isDiscardableBullet(text: string, original?: string): boolean {
  const t = text.trim();
  if (t.length < 10) return true;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 4) return true;
  // Bullet sin ninguna letra acentuada/latina (puro símbolo)
  const letters = t.match(/[a-záéíóúñ]/gi)?.length ?? 0;
  if (letters < t.length * 0.5) return true;
  // Termina en coma o ,. tras limpiar -> frase cortada
  if (/[,;:]$/.test(t)) return true;
  // Termina en palabra conector (frase cortada)
  if (SENTENCE_FRAGMENT_TAIL.test(t)) return true;
  // Empieza con verbo/conector sin sujeto -> el sujeto era un identifier
  // que se eliminó al limpiar.
  if (SENTENCE_FRAGMENT_HEAD.test(t)) return true;
  // Si tras limpiar perdió >50% de las palabras originales, casi seguro
  // que era principalmente jerga técnica.
  if (original) {
    const originalWords = original.trim().split(/\s+/).filter(Boolean).length;
    if (originalWords > 0 && words.length < originalWords * 0.5) return true;
  }
  // Sigue siendo demasiado técnico
  if (isPureTechnical(t)) return true;
  // Lista negra final de palabras
  if (hasBlacklistedToken(t)) return true;
  return false;
}

export function humanizeMessage(raw: string): string {
  let s = raw;
  // Sustituir términos técnicos
  for (const [rx, rep] of TERM_REPLACEMENTS) {
    s = s.replace(rx, rep);
  }
  // Quitar paths, identifiers, paréntesis técnicos…
  s = stripTechnicalArtifacts(s);
  // Mayúscula inicial
  s = s.trim();
  if (s.length === 0) return s;
  s = s.charAt(0).toUpperCase() + s.slice(1);
  // Quitar punto final repetido
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

interface GroupingResult {
  groups: Record<CommitClass, GroupedItem[]>;
  /** Conteo de bullets descartados por demasiado técnicos, agrupado por scope. */
  internalNoiseByScope: Record<CommitClass, Map<string, number>>;
}

function groupAndDedupe(items: ParsedCommit[]): GroupingResult {
  const groups: Record<CommitClass, GroupedItem[]> = {
    feature: [],
    improvement: [],
    fix: [],
    breaking: [],
  };
  const internalNoiseByScope: Record<CommitClass, Map<string, number>> = {
    feature: new Map(),
    improvement: new Map(),
    fix: new Map(),
    breaking: new Map(),
  };

  for (const item of items) {
    const scopeLabel = readableScope(item.scope);
    const text = humanizeMessage(item.message);

    // Si la línea es demasiado técnica o un fragmento, la descartamos para
    // que no llegue al usuario, pero contamos cuántas hubo por scope para
    // poder emitir un resumen tipo "X mejoras internas en {scope}".
    if (isDiscardableBullet(text, item.message)) {
      const scopeKey = scopeLabel ?? "_global";
      const map = internalNoiseByScope[item.classification];
      map.set(scopeKey, (map.get(scopeKey) ?? 0) + 1);
      continue;
    }

    // Deduplicación: si ya hay una entrada con el mismo texto y scope, juntamos hashes.
    const bucket = groups[item.classification];
    const dup = bucket.find(
      (g) =>
        g.text.toLowerCase() === text.toLowerCase() &&
        g.scopeLabel === scopeLabel,
    );
    if (dup) {
      dup.hashes.push(item.hash);
    } else {
      bucket.push({ text, scopeLabel, hashes: [item.hash] });
    }
  }

  return { groups, internalNoiseByScope };
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

/**
 * Calcula las areas (scopeLabels) mas frecuentes en cada grupo para
 * componer titulos descriptivos como "Nuevo en Calendario y Bitácora".
 */
function topScopes(groups: Record<CommitClass, GroupedItem[]>, max = 2): string[] {
  const counts = new Map<string, number>();
  const order = ["breaking", "feature", "improvement", "fix"] as CommitClass[];
  for (const cls of order) {
    for (const it of groups[cls]) {
      if (!it.scopeLabel) continue;
      counts.set(it.scopeLabel, (counts.get(it.scopeLabel) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([label]) => label);
}

function composeTitle(groups: Record<CommitClass, GroupedItem[]>): string {
  const f = groups.feature.length;
  const i = groups.improvement.length;
  const x = groups.fix.length;
  const b = groups.breaking.length;
  const scopes = topScopes(groups);
  const scopesHuman = scopes.length > 0 ? listWithCommasAnd(scopes) : null;

  if (b > 0) {
    return scopesHuman
      ? `Cambios importantes en ${scopesHuman}`
      : "Cambios importantes en esta versión";
  }
  if (f > 0 && i === 0 && x === 0) {
    if (scopesHuman) return `Nuevo en ${scopesHuman}`;
    return f === 1 ? "Nueva funcionalidad" : "Nuevas funcionalidades";
  }
  if (x > 0 && f === 0 && i === 0) {
    if (scopesHuman) return `Arreglos en ${scopesHuman}`;
    return x === 1 ? "Arreglo aplicado" : "Arreglos aplicados";
  }
  if (i > 0 && f === 0 && x === 0) {
    if (scopesHuman) return `Mejoras en ${scopesHuman}`;
    return i === 1 ? "Mejora visual" : "Mejoras y ajustes";
  }
  if (f > 0 && (i > 0 || x > 0)) {
    return scopesHuman
      ? `Novedades y mejoras en ${scopesHuman}`
      : "Novedades y mejoras de esta semana";
  }
  return "Actualización de la app";
}

function formatHumanDate(d: Date): string {
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long" });
}

function composeSummary(
  groups: Record<CommitClass, GroupedItem[]>,
  sinceDate: Date | null,
  noiseCount = 0,
): string {
  const parts: string[] = [];
  if (groups.feature.length > 0) {
    parts.push(
      `${groups.feature.length} novedad${groups.feature.length === 1 ? "" : "es"}`,
    );
  }
  if (groups.improvement.length > 0) {
    parts.push(
      `${groups.improvement.length} mejora${groups.improvement.length === 1 ? "" : "s"}`,
    );
  }
  if (groups.fix.length > 0) {
    parts.push(
      `${groups.fix.length} arreglo${groups.fix.length === 1 ? "" : "s"}`,
    );
  }
  if (groups.breaking.length > 0) {
    parts.push(
      `${groups.breaking.length} cambio${groups.breaking.length === 1 ? "" : "s"} importante${groups.breaking.length === 1 ? "" : "s"}`,
    );
  }
  if (parts.length === 0) {
    // Solo había ruido técnico; nos aseguramos de no mentir diciendo "0
    // cambios" cuando sí hubo trabajo interno.
    if (noiseCount > 0) {
      return `${noiseCount} ${noiseCount === 1 ? "mejora interna" : "mejoras internas"} bajo el capó, sin cambios visibles para el equipo.`;
    }
    return "Pequeños ajustes internos para que todo funcione mejor.";
  }
  const human = listWithCommasAnd(parts);

  // Si la fecha de corte es hoy 00:00 -> "de hoy".
  // Si es hoy a una hora concreta (porque ya se publicó algo hoy)
  //                                         -> "desde las HH:mm de hoy".
  // Otros casos no deberían darse con la nueva regla, pero mantenemos
  // el fallback por seguridad.
  let sincePart = "";
  if (sinceDate) {
    const today = startOfLocalDay();
    const isSameDay =
      sinceDate.getFullYear() === today.getFullYear() &&
      sinceDate.getMonth() === today.getMonth() &&
      sinceDate.getDate() === today.getDate();
    const isMidnight =
      sinceDate.getHours() === 0 &&
      sinceDate.getMinutes() === 0 &&
      sinceDate.getSeconds() === 0;
    if (isSameDay && isMidnight) {
      sincePart = " de hoy";
    } else if (isSameDay) {
      sincePart = ` desde las ${formatHumanTime(sinceDate)} de hoy`;
    } else {
      sincePart = ` desde el ${formatHumanDate(sinceDate)}`;
    }
  }
  return `Esta versión incluye ${human}${sincePart}. Echa un vistazo abajo para los detalles.`;
}

function listWithCommasAnd(arr: string[]): string {
  if (arr.length === 0) return "";
  if (arr.length === 1) return arr[0]!;
  if (arr.length === 2) return `${arr[0]} y ${arr[1]}`;
  return `${arr.slice(0, -1).join(", ")} y ${arr[arr.length - 1]}`;
}

/** Número máximo de bullets mostrados en cada sección. */
const MAX_BULLETS_PER_SECTION = 10;

function renderSection(
  emoji: string,
  heading: string,
  items: GroupedItem[],
  internalNoise: Map<string, number>,
): string {
  // Si no hay bullets "limpios" pero sí descartados, generamos un resumen
  // genérico para que el usuario vea que sí hubo trabajo, aunque "interno".
  if (items.length === 0) {
    const noiseTotal = [...internalNoise.values()].reduce((a, b) => a + b, 0);
    if (noiseTotal === 0) return "";
    // No emitimos sección si solo había ruido: la categoría se omite.
    return "";
  }

  // Cortamos a MAX_BULLETS y avisamos del resto si lo hay.
  const visible = items.slice(0, MAX_BULLETS_PER_SECTION);
  const hidden = items.length - visible.length;
  const lis = visible
    .map((it) => {
      const scope = it.scopeLabel
        ? `<strong>${escapeHtml(it.scopeLabel)}:</strong> `
        : "";
      const text = escapeHtml(it.text);
      const punct = /[.!?…]$/.test(it.text) ? "" : ".";
      return `<li>${scope}${text}${punct}</li>`;
    })
    .join("");

  // Cierre con los descartados (internos) + los cortados por límite.
  const noiseTotal = [...internalNoise.values()].reduce((a, b) => a + b, 0);
  const tailCount = hidden + noiseTotal;
  const tail =
    tailCount > 0
      ? `<li><em>Y ${tailCount} ${tailCount === 1 ? "mejora interna" : "mejoras internas"} más bajo el capó, sin impacto visible para vosotros.</em></li>`
      : "";

  return `<h3>${emoji} ${escapeHtml(heading)}</h3><ul>${lis}${tail}</ul>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function composeBody(result: GroupingResult): string {
  const { groups, internalNoiseByScope } = result;
  const sections: string[] = [];
  if (groups.breaking.length > 0) {
    sections.push(
      renderSection(
        "⚠️",
        "Cambios importantes",
        groups.breaking,
        internalNoiseByScope.breaking,
      ),
    );
  }
  if (groups.feature.length > 0) {
    sections.push(
      renderSection(
        "✨",
        "Lo nuevo",
        groups.feature,
        internalNoiseByScope.feature,
      ),
    );
  }
  if (groups.improvement.length > 0) {
    sections.push(
      renderSection(
        "💎",
        "Mejoras",
        groups.improvement,
        internalNoiseByScope.improvement,
      ),
    );
  }
  if (groups.fix.length > 0) {
    sections.push(
      renderSection("🐛", "Arreglos", groups.fix, internalNoiseByScope.fix),
    );
  }

  // Si no había bullets "limpios" en NINGUNA categoría pero sí hubo
  // commits descartados por demasiado técnicos, generamos un único
  // mensaje genérico para que se vea que sí se trabajó.
  const totalNoise =
    [...internalNoiseByScope.feature.values()].reduce((a, b) => a + b, 0) +
    [...internalNoiseByScope.improvement.values()].reduce((a, b) => a + b, 0) +
    [...internalNoiseByScope.fix.values()].reduce((a, b) => a + b, 0) +
    [...internalNoiseByScope.breaking.values()].reduce((a, b) => a + b, 0);

  if (sections.filter(Boolean).length === 0) {
    if (totalNoise > 0) {
      return `<p>Esta versión incluye ${totalNoise} ${totalNoise === 1 ? "mejora interna" : "mejoras internas"} bajo el capó. No hay cambios visibles para el equipo en esta tanda; lo siguiente que veáis a la vista lo contaré aquí.</p>`;
    }
    return "<p>Pequeños ajustes internos en esta versión. No hay cambios visibles para el equipo.</p>";
  }

  const intro =
    "<p>Hola equipo, este es el resumen de lo que ha cambiado. Si veis algo raro, escribidme y lo miramos.</p>";
  return intro + sections.filter(Boolean).join("");
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

  // Regla 1: NUNCA traer commits anteriores al inicio del día de hoy.
  // Regla 2: Si ya se publicó una novedad hoy, subir el límite a su
  //          publishedAt para no repetir lo que ya salió en esa novedad.
  const todayStart = startOfLocalDay();
  const lastPublishedAt = lastPublished?.publishedAt ?? null;
  const sinceDate =
    lastPublishedAt && lastPublishedAt.getTime() > todayStart.getTime()
      ? lastPublishedAt
      : todayStart;

  const rawCommits = readCommitsSince(sinceDate);
  const parsed = rawCommits.flatMap(parseCommit);

  const result = groupAndDedupe(parsed);
  const { groups, internalNoiseByScope } = result;
  const visibleCount =
    groups.feature.length +
    groups.improvement.length +
    groups.fix.length +
    groups.breaking.length;
  const noiseCount =
    [...internalNoiseByScope.feature.values()].reduce((a, b) => a + b, 0) +
    [...internalNoiseByScope.improvement.values()].reduce((a, b) => a + b, 0) +
    [...internalNoiseByScope.fix.values()].reduce((a, b) => a + b, 0) +
    [...internalNoiseByScope.breaking.values()].reduce((a, b) => a + b, 0);
  const commitCount = visibleCount + noiseCount;

  if (commitCount === 0) {
    const publishedTodayAlready =
      lastPublishedAt && lastPublishedAt.getTime() > todayStart.getTime();
    return {
      title: publishedTodayAlready
        ? "Sin cambios nuevos desde la última novedad de hoy"
        : "Aún no hay commits hoy",
      version: nextAutoVersion(lastPublished?.version ?? null),
      summary: publishedTodayAlready
        ? `Desde la última novedad publicada (${formatHumanTime(lastPublishedAt!)}) no he encontrado commits nuevos. Cuando hagas más cambios, vuelve a darle al botón.`
        : `No he encontrado commits en el repositorio entre las 00:00 de hoy y ahora. El auto-borrador solo coge cambios del día.`,
      body: "<p>No hay cambios nuevos para incluir en esta novedad.</p>",
      category: ReleaseNoteCategory.ANNOUNCEMENT,
      commitCount: 0,
      empty: true,
    };
  }

  return {
    title: composeTitle(groups),
    version: nextAutoVersion(lastPublished?.version ?? null),
    summary: composeSummary(groups, sinceDate, noiseCount),
    body: composeBody(result),
    category: pickHeroCategory(groups),
    commitCount,
    empty: false,
  };
}

function formatHumanTime(d: Date): string {
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}
