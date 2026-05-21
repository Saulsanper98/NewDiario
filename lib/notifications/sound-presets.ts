/**
 * Catálogo de "sonidos predefinidos" del sistema.
 *
 * Cada preset es una pequeña función que recibe un AudioContext y reproduce
 * un sonido sintetizado en tiempo real con Web Audio API. Esto tiene dos
 * ventajas grandes frente a servir archivos MP3/OGG estáticos:
 *
 *   1. Cero peso en assets: no aumentamos el bundle ni el almacenamiento.
 *   2. Funciona offline y sin permisos extra (mediaSession, autoplay, etc.).
 *
 * Si el usuario quiere un sonido más "real" puede subir uno propio o
 * importar una URL desde "Mi cuenta".
 *
 * NOTA: este módulo es client-side. No usa nada de window directamente, pero
 * espera que el caller le pase un AudioContext válido.
 */

export type PresetId =
  | "pluck-duo"
  | "ding"
  | "bell"
  | "swoosh"
  | "blip"
  | "success-up"
  | "alert-soft";

export interface SoundPreset {
  id: PresetId;
  /** Nombre legible para mostrar en la UI. */
  name: string;
  /** Breve descripción del carácter del sonido. */
  description: string;
  /** Renderiza el sonido en el contexto dado. */
  play: (ctx: AudioContext) => void;
}

/**
 * Conveniencia: crea un oscilador con envolvente (attack-release) y lo conecta
 * al destino. Devuelve los nodos por si se necesita encadenar.
 */
function tone(
  ctx: AudioContext,
  opts: {
    /** Frecuencia base en Hz. */
    freq: number;
    /** Frecuencia objetivo al final (si se quiere glide). */
    endFreq?: number;
    /** Tipo de onda. */
    type?: OscillatorType;
    /** Volumen pico (0-1). */
    peak?: number;
    /** Tiempo de subida desde 0 al pico (s). */
    attack?: number;
    /** Tiempo de bajada desde el pico hasta casi 0 (s). */
    release?: number;
    /** Retraso respecto a "ahora" antes de empezar el tono. */
    delay?: number;
  }
) {
  const t0 = ctx.currentTime + (opts.delay ?? 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = opts.type ?? "sine";
  const peak = opts.peak ?? 0.18;
  const attack = opts.attack ?? 0.01;
  const release = opts.release ?? 0.22;
  osc.frequency.setValueAtTime(opts.freq, t0);
  if (opts.endFreq) {
    osc.frequency.exponentialRampToValueAtTime(
      opts.endFreq,
      t0 + attack + release
    );
  }
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + release);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + attack + release + 0.02);
  return { osc, gain };
}

export const PRESETS: SoundPreset[] = [
  {
    id: "pluck-duo",
    name: "Pluck doble",
    description: "El sonido clásico de la app, suave y discreto",
    play(ctx) {
      tone(ctx, { freq: 880, peak: 0.18, release: 0.2 });
      tone(ctx, { freq: 1320, peak: 0.18, release: 0.2, delay: 0.07 });
    },
  },
  {
    id: "ding",
    name: "Ding",
    description: "Una sola nota brillante, tipo notificación de email",
    play(ctx) {
      tone(ctx, {
        freq: 1500,
        endFreq: 1100,
        type: "triangle",
        peak: 0.22,
        attack: 0.005,
        release: 0.35,
      });
    },
  },
  {
    id: "bell",
    name: "Campanada",
    description: "Tono cálido con cola larga, evocador",
    play(ctx) {
      tone(ctx, {
        freq: 660,
        type: "sine",
        peak: 0.24,
        attack: 0.005,
        release: 0.9,
      });
      tone(ctx, {
        freq: 1320,
        type: "sine",
        peak: 0.1,
        attack: 0.005,
        release: 0.6,
      });
    },
  },
  {
    id: "swoosh",
    name: "Swoosh",
    description: "Barrido descendente, sutil, futurista",
    play(ctx) {
      const t0 = ctx.currentTime;
      // Ruido filtrado para conseguir el "siseo" característico.
      const bufferSize = ctx.sampleRate * 0.35;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.6;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(2000, t0);
      filter.frequency.exponentialRampToValueAtTime(400, t0 + 0.3);
      filter.Q.value = 4;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
      noise.connect(filter).connect(gain).connect(ctx.destination);
      noise.start(t0);
      noise.stop(t0 + 0.35);
    },
  },
  {
    id: "blip",
    name: "Blip",
    description: "Pip corto y limpio, tipo videojuego retro",
    play(ctx) {
      tone(ctx, {
        freq: 1200,
        type: "square",
        peak: 0.12,
        attack: 0.002,
        release: 0.07,
      });
    },
  },
  {
    id: "success-up",
    name: "Triada ascendente",
    description: "Tres notas que suben — para login o tarea completada",
    play(ctx) {
      tone(ctx, { freq: 523, peak: 0.16, release: 0.18 }); // C5
      tone(ctx, { freq: 659, peak: 0.16, release: 0.18, delay: 0.09 }); // E5
      tone(ctx, { freq: 784, peak: 0.18, release: 0.3, delay: 0.18 }); // G5
    },
  },
  {
    id: "alert-soft",
    name: "Alerta suave",
    description: "Doble tono medio-grave, llama la atención sin asustar",
    play(ctx) {
      tone(ctx, {
        freq: 520,
        type: "triangle",
        peak: 0.22,
        attack: 0.005,
        release: 0.18,
      });
      tone(ctx, {
        freq: 520,
        type: "triangle",
        peak: 0.22,
        attack: 0.005,
        release: 0.18,
        delay: 0.22,
      });
    },
  },
];

export function getPreset(id: string): SoundPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}
