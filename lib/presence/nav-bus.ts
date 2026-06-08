/**
 * Bus de presencia/navegación en memoria de proceso.
 *
 * Permite que una pestaña publicadora (típicamente la sesión humana de
 * Abián trabajando con la cuenta `tareas@`) emita cambios de URL/scroll
 * y que las pestañas seguidoras (típicamente el datawall) los reciban
 * por SSE y repliquen el estado visual.
 *
 * El canal se indexa por `linkedAccountKey` (ver `lib/presence/linked-account.ts`)
 * en lugar de por `userId` para que dos cuentas vinculadas (tareas@ ↔
 * abian@) compartan el mismo canal.
 *
 * Notas:
 *  - In-memory, sobrevive al HMR vía `globalThis`. Mismas limitaciones
 *    que `lib/chat/realtime-bus.ts`: para multi-proceso haría falta
 *    Redis pub/sub.
 *  - Mantenemos también el ÚLTIMO snapshot por canal para que cualquier
 *    follower que se conecte a posteriori reciba inmediatamente el
 *    estado actual sin tener que esperar al próximo cambio del operador.
 */

export interface NavMirrorEvent {
  type: "nav:update";
  /** URL completa relativa: `pathname + search + hash`. */
  url: string;
  /** Scroll vertical de la ventana en píxeles, o null si no aplicable. */
  scrollY: number | null;
  /**
   * Identificador opaco del cliente que originó el cambio. Cada pestaña
   * genera el suyo en `sessionStorage` al cargar; lo usamos para que
   * un cliente NO reaccione a sus propios eventos (loop guard).
   */
  sourceId: string;
  /** Email visible (para mostrar en el indicador "siguiendo a X"). */
  sourceEmail: string;
  /** Timestamp ms del evento. */
  ts: number;
}

export interface NavMirrorClient {
  /** Clave de canal compartida (par de cuentas vinculadas). */
  linkedKey: string;
  /** Identificador interno secuencial. */
  id: number;
  /** Envía un evento JSON al cliente como SSE. */
  send: (event: NavMirrorEvent) => void;
  /** Mantiene viva la conexión sin emitir un evento "real". */
  ping: () => void;
}

interface NavBus {
  clientsByKey: Map<string, Set<NavMirrorClient>>;
  /** Último snapshot por canal — para hidratar followers nuevos. */
  lastByKey: Map<string, NavMirrorEvent>;
  nextClientId: number;
}

const G = globalThis as unknown as { __navMirrorBus?: NavBus };
if (!G.__navMirrorBus) {
  G.__navMirrorBus = {
    clientsByKey: new Map(),
    lastByKey: new Map(),
    nextClientId: 1,
  };
}
const bus: NavBus = G.__navMirrorBus;

export function getNextNavClientId(): number {
  return bus.nextClientId++;
}

/**
 * TTL de la hidratación al conectar: solo enviamos al follower el último
 * snapshot si fue publicado hace menos de `HYDRATE_TTL_MS`. Así, si el
 * SSE se desconecta y reconecta (algo que pasa cada cierto tiempo por
 * comportamiento de los proxies/IIS) y mientras tanto el operador NO
 * publicó nada nuevo, el follower NO vuelve forzosamente a la última URL
 * conocida (que podía ser perfectamente "/configuracion" de hace media
 * hora). En su lugar se queda donde está hasta que llegue un evento real.
 */
const HYDRATE_TTL_MS = 60_000;

/**
 * Suscribe un cliente a su canal. Si ya hay un snapshot RECIENTE
 * (≤ HYDRATE_TTL_MS), se reenvía inmediatamente al nuevo cliente para
 * que pueda hidratarse sin esperar al próximo cambio. Si el snapshot es
 * antiguo, lo ignoramos: que el follower espere al próximo evento real.
 */
export function subscribeNavClient(client: NavMirrorClient): () => void {
  let set = bus.clientsByKey.get(client.linkedKey);
  if (!set) {
    set = new Set();
    bus.clientsByKey.set(client.linkedKey, set);
  }
  set.add(client);

  // Hidratación inicial con TTL.
  const last = bus.lastByKey.get(client.linkedKey);
  if (
    last &&
    last.sourceId !== "__hydrate-from-self__" &&
    Date.now() - last.ts < HYDRATE_TTL_MS
  ) {
    try {
      client.send(last);
    } catch {
      /* noop */
    }
  }

  return () => {
    set?.delete(client);
    if (set && set.size === 0) {
      bus.clientsByKey.delete(client.linkedKey);
      // No borramos `lastByKey` al quedarnos sin clientes: queremos que
      // el siguiente follower que aparezca dentro del TTL encuentre el
      // último estado.
    }
  };
}

/**
 * Publica un evento a todos los clientes del canal. Excluye al propio
 * publisher (matched por `sourceId`) para evitar feedback loops cuando
 * una sesión publisher tiene también un follower abierto en otra
 * pestaña dentro del mismo navegador.
 */
export function publishNavEvent(linkedKey: string, event: NavMirrorEvent) {
  bus.lastByKey.set(linkedKey, event);
  const set = bus.clientsByKey.get(linkedKey);
  if (!set) return;
  for (const client of set) {
    try {
      client.send(event);
    } catch {
      /* noop — el cleanup del SSE se ocupará */
    }
  }
}

/**
 * Devuelve el último snapshot conocido del canal o null. Útil para
 * endpoints que quieran responder con el estado actual de forma síncrona.
 */
export function getLastNavSnapshot(linkedKey: string): NavMirrorEvent | null {
  return bus.lastByKey.get(linkedKey) ?? null;
}

/** Cuenta de pestañas conectadas a un canal (debug / indicador de estado). */
export function countNavClients(linkedKey: string): number {
  return bus.clientsByKey.get(linkedKey)?.size ?? 0;
}
