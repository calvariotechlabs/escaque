// Prueba de extremo a extremo del aviso «Instala Escaque»: solo en la pantalla de inicio, tras el botón de
// empezar, nunca durante la partida, y con el foco bien puesto al descartarlo. Chrome real manejado por tools/cdp.mjs.
// Uso: npm run test:e2e (monta el sitio y lo sirve en un puerto libre).
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

/** Simula que el navegador ofrece instalar (Chrome lo emite una vez cargada la página). */
const offerInstall = (page) =>
  page.eval(`(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = () => Promise.resolve(); e.userChoice = Promise.resolve({ outcome: 'dismissed' }); window.dispatchEvent(e); })()`);

describe("aviso de instalar de extremo a extremo", () => {
  let page;
  before(async () => {
    page = await browser.newPage();
  });

  test("sale en la pantalla de inicio, fuera de la región de avisos de la partida", async () => {
    await page.goto(base + "/#/jugar");
    await page.waitFor(`!document.getElementById('pantalla-ajustes').hidden`, { what: "pantalla de ajustes" });
    await offerInstall(page);
    await page.waitFor(`document.querySelector('#aviso-instalar .aviso')`, { what: "aviso de instalar" });
    assert.equal(await page.eval(`document.querySelector('#aviso-instalar .aviso__titulo').textContent`), "Instala Escaque.");
    assert.equal(await page.eval(`document.getElementById('avisos').children.length`), 0);
    // Va después del botón de empezar, para no empujarlo.
    assert.equal(await page.eval(`Boolean(document.querySelector('#ajustes [type=submit]').compareDocumentPosition(document.getElementById('aviso-instalar')) & Node.DOCUMENT_POSITION_FOLLOWING)`), true);
  });

  test("no aparece al jugar", async () => {
    await page.eval(`document.getElementById('modo-dos').click()`);
    await page.eval(`document.querySelector('#ajustes [type=submit]').click()`);
    await page.waitFor(`!document.getElementById('pantalla-partida').hidden`, { what: "pantalla de partida" });
    assert.equal(await page.eval(`document.getElementById('pantalla-ajustes').hidden`), true);
    assert.equal(await page.eval(`document.getElementById('aviso-instalar').offsetParent`), null, "el aviso de instalar no se ve en la partida");
    assert.equal(await page.eval(`document.getElementById('avisos').children.length`), 0);
  });

  test("«Ahora no» lo quita y el foco pasa al título de la pantalla", async () => {
    // Otra dirección para que Chrome cargue de verdad (con la misma y solo el # no hay carga) y sin partida guardada.
    await page.eval(`localStorage.clear()`);
    await page.goto(base + "/?otra#/jugar");
    await page.waitFor(`!document.getElementById('pantalla-ajustes').hidden`, { what: "pantalla de ajustes" });
    await offerInstall(page);
    await page.waitFor(`document.querySelector('#aviso-instalar .aviso')`);
    await page.eval(`[...document.querySelectorAll('#aviso-instalar button')].find((b) => b.textContent === 'Ahora no').click()`);
    assert.equal(await page.eval(`document.querySelector('#aviso-instalar .aviso')`), null);
    assert.equal(await page.eval(`document.activeElement.id`), "titulo-ajustes");
  });
});
