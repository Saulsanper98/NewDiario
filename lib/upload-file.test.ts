import { describe, it, expect } from "vitest";
import { isAllowedImageUpload, resolveUploadExt } from "./upload-file";

describe("resolveUploadExt", () => {
  it("acepta GIF por MIME", () => {
    expect(
      resolveUploadExt({ name: "anim.gif", type: "image/gif" })
    ).toBe("gif");
  });

  it("acepta GIF por extensión cuando Windows no envía MIME", () => {
    expect(resolveUploadExt({ name: "anim.gif", type: "" })).toBe("gif");
    expect(
      resolveUploadExt({ name: "anim.gif", type: "application/octet-stream" })
    ).toBe("gif");
  });

  it("rechaza extensiones no permitidas", () => {
    expect(resolveUploadExt({ name: "doc.pdf", type: "" })).toBeNull();
  });
});

describe("isAllowedImageUpload", () => {
  it("incluye GIF", () => {
    expect(isAllowedImageUpload({ name: "x.gif", type: "" })).toBe(true);
  });
});
