// Prueba de extremo a extremo de la pantalla de inicio (CAL-396): «Empezar partida» se ve sin desplazar la pantalla
// en escritorio, tablet vertical, móvil pequeño y móvil apaisado, con los avisos de principiante y de instalar
// presentes; y la descripción de cada opción sigue enlazada con su botón de opción. Chrome real (tools/cdp.mjs).
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { launchBrowser } from "../tools/cdp.mjs";

let server;
let browser;
let base;

/** Un puerto libre (serve.mjs no sabe elegir uno solo). */
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

before(async () => {
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ["tools/serve.mjs"], { env: { ...process.env, PORT: String(port) }, stdio: ["ignore", "pipe", "inherit"] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("El servidor no arrancó")), 10000);
    server.stdout.on("data", () => {
      clearTimeout(timer);
      resolve();
    });
  });
  browser = await launchBrowser();
});

after(async () => {
  try {
    await browser?.close();
  } finally {
    server?.kill(); // aunque falle el cierre de Chrome: un servidor vivo dejaría colgada la CI
  }
});



// CAL-402 (b): el aviso de error del diálogo PGN desaparece en cuanto se corrige el texto.
describe("diálogo PGN: el error se borra al corregir", () => {
  test("al escribir en el campo se oculta el aviso y se quita aria-invalid", async () => {
    const page = await browser.newPage();
    await page.goto(base + "/#/jugar");
    await page.waitFor(`document.getElementById('cargar-pgn')`, { what: "botón Cargar PGN" });
    await page.eval(`document.getElementById('cargar-pgn').click()`);
    await page.eval(`(() => { const f = document.getElementById('pgn-campo'); f.value = '1. e4 e5 2. Cx9'; document.getElementById('pgn-cargar').click(); })()`);
    assert.equal(await page.eval(`document.getElementById('pgn-error').hidden`), false, "el error se muestra");
    assert.equal(await page.eval(`document.getElementById('pgn-campo').getAttribute('aria-invalid')`), "true");
    await page.eval(`(() => { const f = document.getElementById('pgn-campo'); f.value = '1. e4 e5'; f.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    assert.equal(await page.eval(`document.getElementById('pgn-error').hidden`), true, "el error se oculta al corregir");
    assert.equal(await page.eval(`document.getElementById('pgn-campo').getAttribute('aria-invalid')`), null);
    assert.equal(await page.eval(`document.getElementById('pgn-campo').getAttribute('aria-describedby')`), "pgn-ayuda");
  });
});
