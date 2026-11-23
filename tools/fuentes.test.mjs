// Tipografías de marca (CAL-398): alojadas en el propio dominio, con su licencia, y permitidas por la CSP.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const css = readFileSync(join(root, "src", "ui", "fonts.css"), "utf8");
const html = readFileSync(join(root, "index.html"), "utf8");
const faces = [...css.matchAll(/@font-face\{([^}]*)\}/g)].map((m) => m[1]);

test("cada @font-face apunta a un woff2 que existe en public/fonts", () => {
  assert.equal(faces.length, 4);
  for (const face of faces) {
    const url = /url\("\.\.\/\.\.\/fonts\/([^"]+\.woff2)"\)/.exec(face)?.[1];
    assert.ok(url, `@font-face sin url a fonts/: ${face}`);
    const file = join(root, "public", "fonts", url);
    assert.ok(existsSync(file), `falta public/fonts/${url}`);
    assert.equal(readFileSync(file).subarray(0, 4).toString("latin1"), "wOF2", `${url} no es woff2`);
    assert.match(face, /font-display:swap/, "con swap, el texto nunca se queda en blanco mientras cargan");
  }
});

test("solo los pesos del Design System: Space Grotesk 600, Plex Sans 400 y 600, Plex Mono 500", () => {
  const got = faces.map((f) => `${/font-family:"([^"]+)"/.exec(f)?.[1]} ${/font-weight:(\d+)/.exec(f)?.[1]}`).sort();
  assert.deepEqual(got, ["IBM Plex Mono 500", "IBM Plex Sans 400", "IBM Plex Sans 600", "Space Grotesk 600"]);
});

test("van con su licencia (SIL OFL) y no hay ficheros sueltos", () => {
  const files = readdirSync(join(root, "public", "fonts")).sort();
  assert.ok(files.includes("OFL.txt"));
  const license = readFileSync(join(root, "public", "fonts", "OFL.txt"), "utf8");
  assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
  for (const name of ["Space Grotesk", "IBM Plex Sans", "IBM Plex Mono"]) assert.ok(license.includes(name), `la licencia no nombra ${name}`);
  for (const file of files.filter((f) => f !== "OFL.txt")) assert.ok(css.includes(`fonts/${file}`), `public/fonts/${file} no se usa`);
});

test("index.html carga fonts.css antes que los tokens y precarga fuentes que existen, con crossorigin", () => {
  assert.ok(html.indexOf('href="src/ui/fonts.css"') < html.indexOf('href="src/ui/tokens.css"'));
  const preloads = [...html.matchAll(/<link rel="preload" href="([^"]+)" as="font" type="font\/woff2" crossorigin>/g)].map((m) => m[1]);
  assert.ok(preloads.length >= 1);
  for (const href of preloads) assert.ok(existsSync(join(root, "public", href)), `precarga ${href}, que no existe`);
});
