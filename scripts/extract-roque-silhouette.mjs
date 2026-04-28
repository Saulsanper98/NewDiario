import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "public", "roque-nublo-vector.svg"), "utf8");
const marker = '<path fill="#010101"';
const first = src.indexOf(marker);
if (first === -1) throw new Error("No black paths found");
const header = src.slice(0, first);
/* Solo el primer macizo: los demás #010101 suelen ser bordes del trace o basura (p. ej. franja y≈191). */
const j = src.indexOf("z\"/>", first);
if (j === -1) throw new Error("Unclosed path");
const mainPath = src.slice(first, j + 4);
const out = `${header}${mainPath}\n</svg>`;
const dest = path.join(root, "public", "roque-nublo-silhouette-only.svg");
fs.writeFileSync(dest, out);
console.log("bytes", out.length, "->", dest);
