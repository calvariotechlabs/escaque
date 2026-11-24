// Comprueba vercel.json (cabeceras de seguridad y región) y que el sitio publicado cumple la CSP:
// sin scripts ni estilos en línea, que es lo que permite una CSP sin nonce en una web estática.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSite } from "./build-site.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const config = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));

const SOURCES = ["/(.*)", "/sw.js", "/manifest.webmanifest"];
const parseCsp = (csp) => new Map(csp.split(";").map((d) => d.trim().split(/\s+/)).filter((d) => d[0]).map(([name, ...values]) => [name, values]));

/** Cabeceras que Vercel aplicaría a `path`: las reglas que casan, de arriba abajo; las posteriores pisan. */
function headersFor(path) {
  const out = new Map();
  for (const rule of config.headers) {
    assert.ok(SOURCES.includes(rule.source), `regla nueva ${rule.source}: amplía SOURCES y headersFor para que el test sepa casarla`);
    if (rule.source !== "/(.*)" && rule.source !== path) continue;
    for (const { key, value } of rule.headers) out.set(key.toLowerCase(), value);
  }
  return out;
}

const PATHS = ["/", "/index.html", "/sw.js", "/manifest.webmanifest", "/dist/src/ui/main.js", "/src/ui/page.css", "/icons/icono-192.png"];

test("región fra1 fijada (solo afecta a funciones) y sin funciones: es una web estática", () => {
  assert.deepEqual(config.regions, ["fra1"]);
  assert.equal(config.functions, undefined, "es una web estática: sin funciones");
  assert.equal(config.outputDirectory, "site");
});

test("todas las respuestas llevan las cabeceras de seguridad", () => {
  for (const path of PATHS) {
    const h = headersFor(path);
    assert.equal(h.get("x-frame-options"), "DENY", path);
    assert.equal(h.get("x-content-type-options"), "nosniff", path);
    assert.equal(h.get("referrer-policy"), "no-referrer", path);
    assert.equal(h.get("cross-origin-opener-policy"), "same-origin", path);
    const permissions = h.get("permissions-policy") ?? "";
    for (const feature of ["camera", "microphone", "geolocation", "payment", "usb"]) assert.ok(permissions.includes(`${feature}=()`), `${path}: Permissions-Policy debe cerrar ${feature}`);
    assert.ok(!/=\*|\(\*\)/.test(permissions), "Permissions-Policy no abre nada a todos");
  }
});

test("la CSP es estricta, deja funcionar el worker y el manifiesto y prohíbe incrustar la web", () => {
  const csp = headersFor("/").get("content-security-policy");
  assert.ok(csp, "falta Content-Security-Policy");
  const directives = parseCsp(csp);
  assert.deepEqual(directives.get("default-src"), ["'none'"]);
  assert.deepEqual(directives.get("frame-ancestors"), ["'none'"]);
  assert.deepEqual(directives.get("script-src"), ["'self'"]);
  assert.deepEqual(directives.get("style-src"), ["'self'"]);
  assert.deepEqual(directives.get("worker-src"), ["'self'"], "el motor y el service worker");
  assert.deepEqual(directives.get("manifest-src"), ["'self'"]);
  assert.deepEqual(directives.get("font-src"), ["'self'"], "las tipografías de marca, servidas desde el propio dominio (CAL-398)");
  assert.deepEqual(directives.get("connect-src"), ["'self'"], "el service worker descarga los ficheros a guardar");
  assert.deepEqual(directives.get("base-uri"), ["'none'"]);
  assert.ok(!/unsafe-inline|unsafe-eval|\*|https?:|data:/.test(csp), "sin comodines, orígenes externos ni unsafe-*");
  assert.equal(headersFor("/sw.js").get("content-security-policy"), csp, "el service worker usa la misma CSP");
});

test("la etiqueta meta de index.html (la que usa `npm run serve`) no es más laxa que la cabecera", () => {
  const html = readFileSync(join(root, "index.html"), "utf8");
  const meta = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1];
  assert.ok(meta, "falta la meta CSP");
  const header = headersFor("/").get("content-security-policy");
  const headerDirectives = parseCsp(header);
  for (const [name, values] of parseCsp(meta)) assert.deepEqual(headerDirectives.get(name), values, `la directiva ${name} difiere entre meta y cabecera`);
});

test("el sitio publicado no tiene código en línea que la CSP bloquearía", () => {
  const tmp = mkdtempSync(join(tmpdir(), "escaque-csp-"));
  try {
    buildSite({ root, out: tmp });
    const html = readFileSync(join(tmp, "index.html"), "utf8");
    assert.ok(!/<style[\s>]/i.test(html), "index.html lleva <style> en línea");
    assert.ok(!/\sstyle\s*=/i.test(html), "index.html lleva atributos style");
    assert.ok(!/\son[a-z]+\s*=/i.test(html), "index.html lleva manejadores on…=");
    // Un bloque JSON-LD es un dato, no código: la CSP no lo ejecuta ni lo bloquea. Cualquier otro script ha de ser un módulo con src.
    for (const [, tag] of html.matchAll(/<script\b([^>]*)>/gi)) if (!/type="application\/ld\+json"/.test(tag)) assert.match(tag, /\ssrc="/, "script en línea");
    assert.ok(!/javascript:/i.test(html));
    const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
    for (const file of walk(join(tmp, "dist")).concat(join(tmp, "sw.js"))) {
      const code = readFileSync(file, "utf8");
      assert.ok(!/\beval\s*\(|new Function\s*\(/.test(code), `${file} usa eval`);
      assert.ok(!/setAttribute\(\s*["']style["']|\sstyle=\\?["']/.test(code), `${file} escribe atributos style (la CSP los bloquea)`);
      assert.ok(!/https?:\/\/(?!www\.w3\.org)/.test(code), `${file} llama a un origen externo`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("los metadatos de marca de index.html: JSON-LD válido con la creadora y © con el nombre legal", () => {
  const html = readFileSync(join(root, "index.html"), "utf8");
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)];
  assert.equal(blocks.length, 1, "un único bloque JSON-LD");
  const data = JSON.parse(blocks[0][1]);
  assert.equal(data["@type"], "WebApplication");
  assert.equal(data.name, "Escaque");
  assert.deepEqual(data.creator, { "@type": "Organization", name: "Calvario TechLabs", url: "https://calvariotechlabs.com/" });
  assert.match(html, /<meta name="author" content="Calvario TechLabs">/);
  assert.match(html, /© 2026 Calvario TechLabs/);
  assert.match(html, /<meta property="og:image" content="https:\/\/escaque\.calvariotechlabs\.com\/og-image\.png">/, "la imagen OG sigue siendo la de siempre, sin firma, hasta que Sergio decida");
});
