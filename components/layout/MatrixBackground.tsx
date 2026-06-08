"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<MatrixBackground />` — capa de atmósfera del tema TRIBUTO "Matrix".
 *
 * Lluvia de código fosfórico verde (12 columnas determinísticas con
 * caracteres katakana), glow CRT inferior, scanlines, grano y viñeta.
 * Todo determinístico (sin Math.random) → mismo markup en SSR/CSR.
 */

function subscribeMatrix(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
function getIsMatrix(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "matrix";
}
function getServerIsMatrix(): boolean { return false; }

/** Alfabeto Matrix: katakana media-anchura + dígitos + símbolos. */
const MATRIX_GLYPHS =
  "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789ｦﾟ:.<>$+";

/** Genera una cadena determinística de N glifos a partir de una semilla. */
function genColumn(seed: number, len: number): string {
  let out = "";
  let s = seed;
  for (let i = 0; i < len; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out += MATRIX_GLYPHS[s % MATRIX_GLYPHS.length] + "\n";
  }
  return out;
}

/**
 * 14 columnas a posiciones porcentuales fijas, con duraciones y delays
 * variados para que la cascada se sienta orgánica sin random.
 */
const COLUMNS: Array<{ left: string; dur: number; delay: number; seed: number; len: number }> = [
  { left: "3%",  dur: 11, delay:  0.0, seed: 17,  len: 60 },
  { left: "9%",  dur: 16, delay:  2.0, seed: 41,  len: 80 },
  { left: "15%", dur: 13, delay:  0.8, seed: 73,  len: 70 },
  { left: "21%", dur: 18, delay:  3.4, seed: 109, len: 90 },
  { left: "27%", dur: 12, delay:  1.2, seed: 151, len: 65 },
  { left: "34%", dur: 15, delay:  4.5, seed: 197, len: 75 },
  { left: "41%", dur: 10, delay:  0.4, seed: 251, len: 55 },
  { left: "48%", dur: 17, delay:  2.6, seed: 313, len: 85 },
  { left: "55%", dur: 13, delay:  5.0, seed: 379, len: 70 },
  { left: "62%", dur: 14, delay:  1.6, seed: 449, len: 72 },
  { left: "69%", dur: 19, delay:  3.0, seed: 521, len: 95 },
  { left: "76%", dur: 11, delay:  0.6, seed: 599, len: 60 },
  { left: "83%", dur: 16, delay:  4.0, seed: 683, len: 80 },
  { left: "92%", dur: 12, delay:  2.2, seed: 769, len: 65 },
];

export function MatrixBackground() {
  const { theme } = useTheme();
  const htmlActive = useSyncExternalStore(subscribeMatrix, getIsMatrix, getServerIsMatrix);
  if (theme !== "matrix" && !htmlActive) return null;

  return (
    <div className="matrix-bg print:hidden" aria-hidden="true">
      {COLUMNS.map((c, i) => (
        <div
          key={i}
          className="matrix-rain-col"
          style={{
            left: c.left,
            ["--dur" as string]: `${c.dur}s`,
            ["--delay" as string]: `-${c.delay}s`,
          }}
        >
          {genColumn(c.seed, c.len)}
        </div>
      ))}
      <div className="matrix-glow" />
      <div className="matrix-veil" />
      <div className="matrix-scanlines" />
      <div className="matrix-grain" />
      <div className="matrix-vignette" />
    </div>
  );
}
