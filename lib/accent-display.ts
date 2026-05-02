/**
 * Suaviza acentos muy claros / amarillo neón para UI en tema claro.
 * No altera colores ya oscuros o equilibrados (p. ej. azules de departamento).
 */

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function parseHexRgb(input: string): [number, number, number] | null {
  let h = input.trim();
  if (!h.startsWith("#")) h = `#${h}`;
  const raw = h.slice(1);
  if (raw.length === 3 && /^[0-9a-fA-F]{3}$/i.test(raw)) {
    const r = parseInt(raw[0]! + raw[0]!, 16);
    const g = parseInt(raw[1]! + raw[1]!, 16);
    const b = parseInt(raw[2]! + raw[2]!, 16);
    return [r, g, b];
  }
  if (raw.length === 6 && /^[0-9a-fA-F]{6}$/i.test(raw)) {
    const n = parseInt(raw, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  return null;
}

function toHex6([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b]
    .map((x) => clamp255(x).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Mezcla hacia `target` con peso t en [0,1]. */
function mixRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [
    a[0] * (1 - t) + b[0] * t,
    a[1] * (1 - t) + b[1] * t,
    a[2] * (1 - t) + b[2] * t,
  ];
}

/**
 * Devuelve un hex #rrggbb más apagado si el color es un amarillo/crema muy luminoso.
 */
export function softenChillAccent(input: string): string {
  const rgb = parseHexRgb(input);
  if (!rgb) {
    const t = input.trim();
    return t.startsWith("#") ? t : `#${t}`;
  }
  const [r, g, b] = rgb;
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  // Amarillo neón tipo #FFEB66 o similares
  const isNeonYellow = luma > 0.72 && r > 210 && g > 200 && b < 175;
  const isPaperYellow = luma > 0.88 && r > 230 && g > 225;
  if (isNeonYellow || isPaperYellow) {
    const target: [number, number, number] = [142, 122, 26];
    const t = isPaperYellow ? 0.5 : 0.48;
    return toHex6(mixRgb([r, g, b], target, t));
  }
  // Cualquier acento casi blanco
  if (luma > 0.82) {
    const target: [number, number, number] = [88, 82, 58];
    return toHex6(mixRgb([r, g, b], target, 0.28));
  }
  if (luma > 0.76) {
    const target: [number, number, number] = [96, 88, 52];
    return toHex6(mixRgb([r, g, b], target, 0.18));
  }
  return toHex6(rgb);
}
