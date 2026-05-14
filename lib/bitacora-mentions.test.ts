import { describe, it, expect } from "vitest";
import {
  BITACORA_DEPT_ALL_MENTION_ID,
  extractMentionDataIds,
  extractPlainAtMentionUserIds,
  matchesDeptAllMentionQuery,
  parseLeadingReplyMention,
  plainTextContainsDeptAllMention,
} from "./bitacora-mentions";

describe("bitacora-mentions", () => {
  it("matchesDeptAllMentionQuery: vacío sin fila @all; all/todo/depart sí", () => {
    expect(matchesDeptAllMentionQuery("")).toBe(false);
    expect(matchesDeptAllMentionQuery("a")).toBe(false);
    expect(matchesDeptAllMentionQuery("al")).toBe(true);
    expect(matchesDeptAllMentionQuery("all")).toBe(true);
    expect(matchesDeptAllMentionQuery("@all")).toBe(true);
    expect(matchesDeptAllMentionQuery("dep")).toBe(true);
    expect(matchesDeptAllMentionQuery("departamento")).toBe(true);
    expect(matchesDeptAllMentionQuery("juan")).toBe(false);
  });

  it("extractMentionDataIds incluye sentinel", () => {
    const html = `<p><span data-type="mention" data-id="${BITACORA_DEPT_ALL_MENTION_ID}" data-label="all">@all</span></p>`;
    expect(extractMentionDataIds(html)).toContain(BITACORA_DEPT_ALL_MENTION_ID);
  });

  it("plainTextContainsDeptAllMention detecta @all en texto y no en foo@all", () => {
    expect(plainTextContainsDeptAllMention("hola @all equipo")).toBe(true);
    expect(plainTextContainsDeptAllMention("@all gracias")).toBe(true);
    expect(plainTextContainsDeptAllMention("foo@all")).toBe(false);
  });

  it("extractPlainAtMentionUserIds resuelve @Nombre contra lista", () => {
    const users = [
      { id: "a", name: "Saul" },
      { id: "b", name: "Saul Ramos" },
    ];
    expect(extractPlainAtMentionUserIds("hey @Saul Ramos tú", users)).toEqual(["b"]);
    expect(extractPlainAtMentionUserIds("@Saul ", users)).toEqual(["a"]);
    expect(extractPlainAtMentionUserIds("@all @Saul", users)).toEqual(["a"]);
    expect(
      extractPlainAtMentionUserIds("**@Daniel Mendoza** en negrita", [
        { id: "dm", name: "Daniel Mendoza" },
      ])
    ).toEqual(["dm"]);
  });

  it("parseLeadingReplyMention: solo @Nombre: exacto; no hasta IP:", () => {
    const names = ["Saul", "Saul Ramos"];
    expect(parseLeadingReplyMention("@Saul: hola", names)).toEqual({
      replyTarget: "Saul",
      bodyText: "hola",
    });
    expect(parseLeadingReplyMention("@Saul Ramos: ok", names)).toEqual({
      replyTarget: "Saul Ramos",
      bodyText: "ok",
    });
    const long =
      "@Saul Esperamos a que pase X. Pon IP: 192.168.1.1";
    expect(parseLeadingReplyMention(long, names)).toBeNull();
  });
});
