/**
 * Motor de reproducción de sonidos del usuario.
 *
 * Centraliza la lógica de "tengo que avisar al usuario por evento X, ¿qué
 * sonido reproduzco?". Las preferencias del usuario se sincronizan desde el
 * servidor (`/api/me/sound-preferences`) y se cachean en localStorage para
 * evitar latencias en el primer aviso de cada sesión.
 *
 * Un identificador de sonido (`soundId`) puede tener estos formatos:
 *
 *   - "preset:<presetId>" -> usa uno de los presets sintéticos.
 *   - "user:<userSoundId>" -> usa un audio subido o importado por el usuario.
 *     Se reproduce vía un elemento <audio> con la URL que dio el backend.
 *   - "default" -> sonido por defecto de la categoría (configurado abajo).
 *   - "off" -> silencio explícito para esa categoría.
 *
 * Las categorías que soportamos son:
 *   - chat    -> mensaje nuevo recibido en el chat
 *   - mention -> me mencionan en un mensaje
 *   - login   -> login correcto al entrar en la app
 *   - task    -> tarea asignada / cambio relevante
 */

import { getPreset, PRESETS } from "./sound-presets";

export type SoundCategory = "chat" | "mention" | "login" | "task";

const CATEGORY_DEFAULT: Record<SoundCategory, string> = {
  chat: "preset:pluck-duo",
  mention: "preset:alert-soft",
  login: "preset:success-up",
  task: "preset:blip",
};

const STORAGE_PREFS = "sound-prefs-v1";
const STORAGE_ENABLED = "chat-sound-enabled"; // compat con clave previa
const COOLDOWN_PER_CAT_MS: Record<SoundCategory, number> = {
  chat: 2500,
  mention: 1500,
  login: 0,
  task: 1500,
};

const lastPlayedAt: Partial<Record<SoundCategory, number>> = {};
let cachedCtx: AudioContext | null = null;
// userSounds[soundId] -> url. Necesario para que el reproductor sepa de qué
// archivo cargar el HTMLAudio cuando una preferencia apunta a "user:<id>".
let userSoundUrls: Record<string, string> = {};

export interface UserSoundLite {
  id: string;
  name: string;
  fileUrl: string;
}

export interface SoundPreferences {
  chat?: string;
  mention?: string;
  login?: string;
  task?: string;
}

/** Devuelve `true` si el usuario tiene los sonidos GLOBALMENTE activados. */
export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = window.localStorage.getItem(STORAGE_ENABLED);
    return v === null ? true : v === "true";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_ENABLED, enabled ? "true" : "false");
  } catch {
    /* localStorage bloqueado */
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
 * Devuelve las preferencias guardadas en localStorage o un objeto vacío.
 * El servidor llena este cache en cuanto el usuario tiene sesión.
 */
function readPrefs(): SoundPreferences {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFS);
    if (!raw) return {};
    const obj = JSON.parse(raw) as unknown;
    if (!obj || typeof obj !== "object") return {};
    return obj as SoundPreferences;
  } catch {
    return {};
  }
}

/**
 * Persiste las preferencias en localStorage. Esto NO contacta con el servidor;
 * el caller debe llamar adicionalmente a PATCH /api/me/sound-preferences si
 * quiere que la preferencia viaje a otros dispositivos.
 */
export function setLocalPrefs(prefs: SoundPreferences) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_PREFS, JSON.stringify(prefs));
  } catch {
    /* localStorage bloqueado */
  }
}

/**
 * Carga en memoria los sonidos del usuario para que `playCategory` pueda
 * resolver "user:<id>" -> URL sin un fetch extra cada vez. Llamar al iniciar
 * sesión y cuando el usuario añade o borra sonidos.
 */
export function setUserSoundsCache(sounds: UserSoundLite[]) {
  userSoundUrls = {};
  for (const s of sounds) userSoundUrls[s.id] = s.fileUrl;
}

/**
 * Resuelve qué sonido reproducir para una categoría dada según las
 * preferencias guardadas. Devuelve `null` si la categoría está en "off".
 */
function resolveSoundId(category: SoundCategory): string | null {
  const prefs = readPrefs();
  const raw = prefs[category] ?? "default";
  if (raw === "off") return null;
  if (raw === "default") return CATEGORY_DEFAULT[category];
  return raw;
}

/**
 * Reproduce el sonido identificado por `soundId` IGNORANDO los cooldowns y
 * la preferencia global. Útil para los previews ("Probar" en Mi cuenta).
 */
export async function playSoundId(soundId: string): Promise<void> {
  if (soundId === "off") return;
  if (soundId === "default") return;
  if (soundId.startsWith("preset:")) {
    const presetId = soundId.slice("preset:".length);
    const preset = getPreset(presetId);
    if (!preset) return;
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        /* noop */
      }
    }
    preset.play(ctx);
    return;
  }
  if (soundId.startsWith("user:")) {
    const userSoundId = soundId.slice("user:".length);
    const url = userSoundUrls[userSoundId];
    if (!url) return;
    try {
      const audio = new Audio(url);
      audio.volume = 0.85;
      await audio.play();
    } catch {
      /* autoplay bloqueado: ignoramos */
    }
  }
}

/**
 * Reproduce el sonido para la categoría dada respetando:
 *   - El toggle global "sonido on/off".
 *   - El cooldown por categoría.
 *   - Las preferencias del usuario.
 */
export function playCategory(category: SoundCategory) {
  if (!isSoundEnabled()) return;
  const now = Date.now();
  const cd = COOLDOWN_PER_CAT_MS[category];
  if (cd > 0 && now - (lastPlayedAt[category] ?? 0) < cd) return;
  lastPlayedAt[category] = now;
  const id = resolveSoundId(category);
  if (!id) return;
  void playSoundId(id);
}

/** Catálogo de presets re-exportado para que la UI no los importe directamente. */
export const SOUND_PRESETS = PRESETS;

/** Mapa amistoso de categorías a etiquetas. */
export const CATEGORY_LABELS: Record<SoundCategory, string> = {
  chat: "Mensaje nuevo en el chat",
  mention: "Cuando me mencionan",
  login: "Login correcto",
  task: "Tarea asignada / cambio relevante",
};

/** Por compatibilidad con código que llamaba a la API anterior. */
export function playNotificationSound() {
  playCategory("chat");
}
