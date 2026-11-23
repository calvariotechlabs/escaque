// El logo junto al nombre (CAL-387): decorativo, en línea y compatible con la CSP.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const html = readFileSync(join(root, "index.html"), "utf8");
const h1 = /<h1 class="cabecera-marca">(.*?)<\/h1>/s.exec(html)?.[1] ?? "";
const css = readFileSync(join(root, "src", "ui", "page.css"), "utf8");

test("el título lleva el logo a la izquierda del nombre y el nombre accesible sigue siendo «Escaque»", () => {
  assert.ok(h1, "falta <h1 class=\"cabecera-marca\">");
  assert.ok(h1.indexOf("<svg") < h1.indexOf("<span>Escaque</span>"));
  assert.equal(h1.replace(/<svg.*?<\/svg>/s, "").replace(/<[^>]+>/g, ""), "Escaque");
});

test("el logo es decorativo: aria-hidden, sin foco, sin título ni nombre", () => {
  assert.match(h1, /<svg class="cabecera-marca__logo"[^>]*aria-hidden="true"[^>]*focusable="false"/);
  assert.ok(!/<title\b|aria-label|role=/.test(h1));
});

test("es SVG en línea: ni imágenes ni recursos externos ni atributos style (CSP)", () => {
  assert.ok(!/<img\b|<use\b|xlink:href|<image\b|style=|https?:/.test(h1.replace('xmlns="http://www.w3.org/2000/svg"', "")));
});

test("el tamaño del logo sigue al del título en cada tramo", () => {
  assert.equal((css.match(/\.cabecera-marca__logo\{width:36px;height:36px\}/g) ?? []).length, 2);
  assert.match(css, /\.cabecera-marca__logo\{[^}]*width:24px;height:24px/);
});
