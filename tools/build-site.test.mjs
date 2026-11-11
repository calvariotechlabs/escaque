// Prueba el montaje del sitio (tools/build-site.mjs) y el manifiesto que publica.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSite } from "./build-site.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const tmp = mkdtempSync(join(tmpdir(), "escaque-site-"));

test("el sitio trae lo que index.html necesita y el service worker lo guarda todo", () => {
  const out = join(tmp, "a");
  const { version, precache } = buildSite({ root, out });
  for (const file of ["index.html", "manifest.webmanifest", "favicon.svg", "favicon.ico", "sw.js", "src/ui/tokens.css", "src/ui/board.css", "src/ui/page.css", "src/ui/lecciones.css", "dist/src/ui/main.js", "dist/src/pwa/pwa.js"]) {
    assert.ok(existsSync(join(out, file)), `falta ${file}`);
  }
  assert.ok(!existsSync(join(out, "dist", "tests")), "los tests no se publican");
  assert.ok(!existsSync(join(out, "dist", "src", "pwa", "sw.js")), "el worker va solo en la raíz");
  assert.match(version, /^[0-9a-f]{12}$/);
  assert.ok(precache.includes("./") && precache.includes("./index.html") && precache.includes("./dist/src/ui/main.js"));
  assert.ok(!precache.includes("./sw.js"), "sw.js no se guarda a sí mismo");
  for (const url of precache) {
    if (url !== "./") assert.ok(existsSync(join(out, url)), `la lista guarda ${url}, que no existe`);
  }
  const html = readFileSync(join(out, "index.html"), "utf8");
  for (const [, href] of html.matchAll(/(?:href|src)="([^":]+)"/g)) {
    if (href.startsWith("#")) continue; // enlaces de la propia página (rutas #/jugar, #/lecciones)
    assert.ok(existsSync(join(out, href)), `index.html enlaza ${href}, que no existe`);
  }
});

test("la versión cambia con el contenido y no con el momento", () => {
  const same = buildSite({ root, out: join(tmp, "b") }).version;
  assert.equal(buildSite({ root, out: join(tmp, "c") }).version, same);
  const css = join(root, "src", "ui", "page.css");
  const original = readFileSync(css, "utf8");
  try {
    writeFileSync(css, original + "\n/* cambio */\n");
    assert.notEqual(buildSite({ root, out: join(tmp, "d") }).version, same);
  } finally {
    writeFileSync(css, original);
  }
});

test("el manifiesto es instalable: nombre, inicio, pantalla completa, colores e iconos que existen", () => {
  const manifest = JSON.parse(readFileSync(join(root, "public", "manifest.webmanifest"), "utf8"));
  assert.equal(manifest.name, "Escaque");
  assert.equal(manifest.lang, "es");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.theme_color, "#f1f3f5");
  assert.equal(manifest.background_color, "#f1f3f5");
  const purposes = manifest.icons.map((i) => `${i.sizes}/${i.purpose}`);
  for (const need of ["192x192/any", "512x512/any", "192x192/maskable", "512x512/maskable"]) assert.ok(purposes.includes(need), `falta el icono ${need}`);
  for (const icon of manifest.icons) assert.ok(existsSync(join(root, "public", icon.src)), `falta ${icon.src}`);
});

test("limpieza", () => {
  rmSync(tmp, { recursive: true, force: true });
});
