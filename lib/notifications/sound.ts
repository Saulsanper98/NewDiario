/**
 * Sonido de aviso al recibir mensaje nuevo. No usa un fichero externo: el
 * tono se sintetiza con Web Audio API, asi evitamos bloqueos por autoplay
 * en navegadores recientes y no tenemos que servir ningun mp3.
 *
 * La preferencia de "sonido on/off" se guarda en localStorage bajo la clave
 * `chat-sound-enabled` (default: true). Cualquier componente puede llamar a
 * `playNotificationSound()` y respetara la preferencia automaticamente.
 */

const STORAGE_KEY = "chat-sound-enabled";
const COOLDOWN_MS = 2500;
let lastPlayedAt = 0;
let cachedCtx: AudioContext | null = null;

export function isChatSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === null ? true : v === "true";
  } catch {
    return true;
  }
}

export function setChatSoundEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
  } catch {
    /* localStorage puede estar bloqueado */
  }
}

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (cachedCtx && cachedCtx.state !== "closed") return cachedCtx;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  cachedCtx = new Ctor();
  return cachedCtx;
}

/**
 * Reproduce un "pluck" corto. La frecuencia y la envolvente estan pensadas
 * para sonar como una notificacion ligera, no agresiva.
 */
export function playNotificationSound() {
  if (!isChatSoundEnabled()) return;
  // Cooldown: no spammar el sonido si llegan muchos mensajes seguidos.
  const now = Date.now();
  if (now - lastPlayedAt < COOLDOWN_MS) return;
  lastPlayedAt = now;

  const ctx = getContext();
  if (!ctx) return;

  // Algunos navegadores arrancan el contexto en "suspended" hasta el primer
  // gesto del usuario; intentamos resumir en silencio.
  if (ctx.state === "suspended") {
    void ctx.resume();
  }

  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  // Dos tonos encadenados para sonar como "dingding" pequeno.
  osc.frequency.setValueAtTime(880, t0);
  osc.frequency.setValueAtTime(1320, t0 + 0.07);

  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);

  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.25);
}
