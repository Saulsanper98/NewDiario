/**
 * Compatibilidad con el módulo previo `lib/notifications/sound.ts`.
 *
 * El motor real vive en `sound-player.ts`, que soporta múltiples categorías
 * (chat, mention, login, task) y sonidos personalizados del usuario. Aquí
 * reexportamos las funciones que ya consumían otros componentes para que
 * sigan funcionando sin cambios.
 */

export {
  isSoundEnabled as isChatSoundEnabled,
  setSoundEnabled as setChatSoundEnabled,
  playNotificationSound,
  playCategory,
  playSoundId,
} from "./sound-player";
