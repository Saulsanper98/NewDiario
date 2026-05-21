/**
 * Genera dinamicamente un favicon que pinta el favicon original mas un
 * pequeno badge rojo con el contador en la esquina. Cuando `count` es 0
 * restaura el favicon original.
 *
 * Funciona en cliente (usa <canvas>) y guarda referencia al favicon original
 * para poder restaurarlo. Idempotente: llamar con el mismo numero no provoca
 * trabajo adicional.
 */

const SIZE = 64;
let originalHref: string | null = null;
let lastDrawnCount = -1;

function getLink(): HTMLLinkElement | null {
  if (typeof document === "undefined") return null;
  let link = document.querySelector(
    "link[rel='icon']"
  ) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  if (originalHref === null) originalHref = link.href || "/favicon.ico";
  return link;
}

function drawBadge(ctx: CanvasRenderingContext2D, count: number) {
  // Cifra a mostrar (con "9+" cuando hay 10 o mas).
  const text = count > 9 ? "9+" : String(count);
  const r = SIZE * 0.32;
  const cx = SIZE - r - 2;
  const cy = r + 2;

  // Sombra suave detras del badge.
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.arc(cx + 1, cy + 1, r, 0, Math.PI * 2);
  ctx.fill();

  // Circulo rojo.
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Borde sutil para destacar sobre fondos claros.
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Numero centrado.
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${
    text.length > 1 ? SIZE * 0.34 : SIZE * 0.46
  }px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy + 1);
}

export function setFaviconBadge(count: number) {
  if (typeof window === "undefined") return;
  if (count === lastDrawnCount) return;
  lastDrawnCount = count;

  const link = getLink();
  if (!link) return;

  if (count <= 0) {
    if (originalHref) link.href = originalHref;
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    ctx.clearRect(0, 0, SIZE, SIZE);
    try {
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
    } catch {
      // ignore drawing errors (favicon ICO en algunos navegadores)
    }
    drawBadge(ctx, count);
    try {
      link.href = canvas.toDataURL("image/png");
    } catch {
      /* ignore */
    }
  };
  img.onerror = () => {
    // Si el favicon original no se puede cargar (CORS) dibujamos solo el badge
    // sobre un fondo neutro.
    ctx.fillStyle = "#0a0f1e";
    ctx.fillRect(0, 0, SIZE, SIZE);
    drawBadge(ctx, count);
    try {
      link.href = canvas.toDataURL("image/png");
    } catch {
      /* ignore */
    }
  };
  img.src = originalHref ?? "/favicon.ico";
}
