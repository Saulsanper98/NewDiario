import { describe, it, expect } from "vitest";
import { sanitizeHtml, BITACORA_BLANK_LINE_CLASS } from "./sanitize-html";

describe("sanitizeHtml (bitácora)", () => {
  it("conserva varios párrafos con texto", () => {
    const raw = "<p>Primero</p><p>Segundo</p><p>Tercero</p>";
    const out = sanitizeHtml(raw);
    expect(out).toContain("Primero");
    expect(out).toContain("Segundo");
    expect(out).toContain("Tercero");
    expect(out.match(/<p/g)?.length).toBe(3);
  });

  it("marca párrafo solo-<br> con clase de línea en blanco", () => {
    const raw = "<p>A</p><p><br></p><p>B</p>";
    const out = sanitizeHtml(raw);
    expect(out).toContain(BITACORA_BLANK_LINE_CLASS);
    expect(out).toMatch(/<p[^>]*class="[^"]*bitacora-blank-line[^"]*"[^>]*>\s*<br\s*\/?>/i);
    expect(out).toContain("A");
    expect(out).toContain("B");
  });

  it("preserva <p></p> vacíos del editor como línea en blanco intencional", () => {
    /* TipTap serializa el doble Enter del usuario como `<p></p>` puro.
       Antes se borraban; ahora los normalizamos a `<p><br></p>` con la
       clase de línea en blanco, para respetar el espaciado vertical que
       el autor escribió en el editor. */
    const out = sanitizeHtml("<p>A</p><p></p><p>B</p>");
    expect(out).toContain("A");
    expect(out).toContain("B");
    expect(out).toContain(BITACORA_BLANK_LINE_CLASS);
    expect(out).toMatch(/<p[^>]*class="[^"]*bitacora-blank-line[^"]*"[^>]*>\s*<br\s*\/?>/i);
  });

  it("normaliza <p>&nbsp;</p> y <p> </p> a línea en blanco", () => {
    const a = sanitizeHtml("<p>X</p><p>&nbsp;</p><p>Y</p>");
    const b = sanitizeHtml("<p>X</p><p> </p><p>Y</p>");
    expect(a).toContain(BITACORA_BLANK_LINE_CLASS);
    expect(b).toContain(BITACORA_BLANK_LINE_CLASS);
  });

  it("colapsa espacio antes de puntuación tras cerrar negrita", () => {
    const raw = "<p><strong>x</strong> .</p>";
    const out = sanitizeHtml(raw);
    expect(out).toContain("</strong>.</p>");
    expect(out).not.toContain("</strong> .");
  });

  it("elimina br decorativo ProseMirror-trailingBreak (línea fantasma)", () => {
    const raw =
      '<p>Primero<br class="ProseMirror-trailingBreak"></p><p>Segundo</p>';
    const out = sanitizeHtml(raw);
    expect(out).not.toContain("ProseMirror-trailingBreak");
    expect(out).toMatch(/<p>Primero<\/p>/i);
    expect(out).toContain("Segundo");
  });
});
