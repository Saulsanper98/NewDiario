import { describe, it, expect } from "vitest";
import {
  BITACORA_DEPT_ALL_MENTION_ID,
  extractMentionDataIds,
  extractPlainAtMentionUserIds,
  matchesDeptAllMentionQuery,
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
  });
});
