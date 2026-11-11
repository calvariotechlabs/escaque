// Monta el sitio estático que se publica en Vercel (y que sirve `npm run serve`) en `site/`.
// Sin dependencias. Uso: npm run build:site   (compila antes con tsc)
//
// Contenido de site/:
//   index.html, manifest, iconos y favicon  (index.html y public/)
//   src/ui/*.css                             (estilos que carga index.html)
//   dist/src/**/*.js                         (módulos ES compilados; sin mapas, tests ni herramientas)
//   sw.js                                    (service worker con la versión y la lista a guardar)
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Ficheros de `dir` (rutas relativas con «/»), ordenados, recursivamente. */
function listFiles(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, base));
    else out.push(relative(base, full).split(sep).join("/"));
  }
  return out.sort();
}

function copyFile(from, to) {
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to);
}

/**
 * @param {{ root: string, out: string }} options
 * @returns {{ version: string, precache: string[] }}
 */
export function buildSite({ root, out }) {
  const dist = join(root, "dist", "src");
  if (!existsSync(join(dist, "pwa", "sw.js"))) throw new Error("Falta dist/: ejecuta `npm run build` antes.");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  copyFile(join(root, "index.html"), join(out, "index.html"));
  const publicDir = join(root, "public");
  for (const file of listFiles(publicDir)) copyFile(join(publicDir, file), join(out, file));
  for (const file of listFiles(join(root, "src", "ui")).filter((f) => f.endsWith(".css"))) {
    copyFile(join(root, "src", "ui", file), join(out, "src", "ui", file));
  }
  for (const file of listFiles(dist).filter((f) => f.endsWith(".js") && f !== "pwa/sw.js")) {
    copyFile(join(dist, file), join(out, "dist", "src", file));
  }

  // Todo lo que hay hasta aquí se guarda al instalar; la huella cambia con cualquier byte.
  const files = listFiles(out);
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file);
    hash.update("\0");
    hash.update(readFileSync(join(out, file)));
    hash.update("\0");
  }
  const version = hash.digest("hex").slice(0, 12);
  const precache = ["./", ...files.map((f) => `./${f}`)];

  const script = readFileSync(join(dist, "pwa", "sw.js"), "utf8").replace(/\n?\/\/# sourceMappingURL=.*\s*$/, "\n");
  const header = `const __VERSION__ = ${JSON.stringify(version)};\nconst __PRECACHE__ = ${JSON.stringify(precache, null, 2)};\n`;
  writeFileSync(join(out, "sw.js"), header + script);
  return { version, precache };
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const out = join(root, "site");
  const { version, precache } = buildSite({ root, out });
  if (!statSync(out).isDirectory()) throw new Error("No se creó site/");
  console.log(`site/ listo: ${precache.length - 1} ficheros, versión ${version}`);
}
