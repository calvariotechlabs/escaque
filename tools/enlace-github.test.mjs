// El enlace al repositorio (CAL-385) está en la navegación de la cabecera, es accesible y no rompe la CSP.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const html = readFileSync(join(root, "index.html"), "utf8");
const nav = /<nav class="lecc-nav"[^>]*>(.*?)<\/nav>/s.exec(html)?.[1] ?? "";
const link = /<a id="enlace-github"[^>]*>.*?<\/a>/s.exec(nav)?.[0] ?? "";

test("el enlace a GitHub está al final de la navegación principal", () => {
  assert.ok(link, "falta #enlace-github dentro de la navegación");
  assert.ok(nav.trim().endsWith("</a>") && nav.lastIndexOf("enlace-github") > nav.lastIndexOf("enlace-lecciones"));
  assert.match(link, /href="https:\/\/github\.com\/calvariotechlabs\/escaque"/);
});

test("se abre en una pestaña nueva sin dar acceso a la ventana de origen", () => {
  assert.match(link, /target="_blank"/);
  const rel = /rel="([^"]*)"/.exec(link)?.[1].split(/\s+/) ?? [];
  assert.ok(rel.includes("noopener") && rel.includes("noreferrer"));
});

test("tiene nombre accesible en español, avisa de la pestaña nueva y el logo está oculto al lector", () => {
  assert.match(link, /<span class="enlace-gh__texto">GitHub<\/span>/);
  assert.match(link, /class="oculto"> \(se abre en una pestaña nueva\)<\/span>/);
  assert.match(link, /<svg [^>]*aria-hidden="true"[^>]*focusable="false"/);
});

test("el logo es SVG propio en línea: ni imágenes ni recursos externos nuevos", () => {
  assert.ok(!/<img\b|<use\b|xlink:href|<image\b/.test(link));
  assert.ok(!/style=/.test(link), "sin atributos style: la CSP no los admite");
});

test("la hoja de estilos define objetivo táctil de 44 px y foco visible", () => {
  const css = readFileSync(join(root, "src", "ui", "lecciones.css"), "utf8");
  assert.match(css, /\.enlace-gh\{[^}]*min-height:44px/);
  assert.match(css, /\.enlace-gh:focus-visible\{[^}]*outline:3px solid var\(--accent\)/);
});
