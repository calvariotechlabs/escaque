// Comprueba la vista previa al compartir el enlace (CAL-393): etiquetas Open Graph / Twitter e imagen 1200x630.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const html = readFileSync(join(root, "index.html"), "utf8");
const meta = (attr, name) => new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`).exec(html)?.[1];
const ORIGIN = "https://escaque.calvariotechlabs.com";

test("og y twitter apuntan al dominio y a una imagen absoluta", () => {
  assert.equal(meta("property", "og:url"), `${ORIGIN}/`);
  assert.equal(meta("property", "og:image"), `${ORIGIN}/og-image.png`);
  assert.equal(meta("name", "twitter:image"), `${ORIGIN}/og-image.png`);
  assert.equal(meta("name", "twitter:card"), "summary_large_image");
  assert.equal(meta("property", "og:image:width"), "1200");
  assert.equal(meta("property", "og:image:height"), "630");
  assert.ok(meta("property", "og:image:alt"));
  assert.equal(meta("property", "og:title"), /<title>([^<]*)/.exec(html)[1]);
});

test("public/og-image.png es un PNG de 1200x630", () => {
  const png = readFileSync(join(root, "public", "og-image.png"));
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  assert.ok(png.length < 300 * 1024, "pesa menos de 300 KB");
});
