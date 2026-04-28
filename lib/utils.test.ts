import { describe, it, expect } from "vitest";
import { cn, getInitials, slugify } from "./utils";

describe("cn", () => {
  it("fusiona clases tailwind conflictivas", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});

describe("getInitials", () => {
  it("usa hasta dos palabras", () => {
    expect(getInitials("Ana García")).toBe("AG");
  });
});

describe("slugify", () => {
  it("quita acentos y normaliza", () => {
    expect(slugify("Área Técnica")).toBe("area-tecnica");
  });
});
