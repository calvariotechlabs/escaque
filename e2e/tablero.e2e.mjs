// Prueba de extremo a extremo del tablero a elegir (CAL-397): Bosque por defecto, Nogal elegido y recordado,
// y un valor guardado inválido. Chrome real manejado por tools/cdp.mjs.
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


/** Abre la web y empieza una partida de dos jugadores. */
async function startTwoPlayers(page) {
  await page.goto(base + "/#/jugar"); // perfil de Chrome nuevo: sin partida guardada
  await page.waitFor(`!document.getElementById('pantalla-ajustes').hidden`, { what: "pantalla de ajustes" });
  await page.eval(`document.getElementById('modo-dos').click()`);
  await page.eval(`document.querySelector('#pantalla-ajustes button[type=submit]').click()`);
  await page.waitFor(`!document.getElementById('pantalla-partida').hidden`, { what: "pantalla de partida" });
}

// Tras recargar, el tablero se pinta un instante después de que el tema ya esté puesto: se espera a que haya casillas.
const darkSquare = async (page) => {
  await page.waitFor(`document.querySelector('#tablero .casilla--oscura')`, { what: "casillas del tablero" });
  return page.eval(`getComputedStyle(document.querySelector('#tablero .casilla--oscura')).backgroundColor`);
};

describe("tablero a elegir de extremo a extremo (CAL-397)", () => {
  let page;
  before(async () => {
    page = await browser.newPage();
  });

  test("por defecto se ve Bosque y el selector lo marca", async () => {
    await startTwoPlayers(page);
    assert.equal(await darkSquare(page), "rgb(74, 122, 88)");
    assert.equal(await page.eval(`document.documentElement.hasAttribute('data-tablero')`), false);
    assert.equal(await page.eval(`document.getElementById('tablero-bosque').checked`), true);
  });

  test("elegir Nogal cambia las casillas y se recuerda al recargar", async () => {
    await page.eval(`document.getElementById('tablero-nogal').click()`);
    assert.equal(await darkSquare(page), "rgb(162, 105, 61)");
    assert.equal(await page.eval(`document.documentElement.dataset.tablero`), "nogal");
    await page.eval(`setTimeout(() => location.reload(), 0)`);
    await page.waitFor(`document.documentElement.dataset.tablero === 'nogal' && document.getElementById('tablero-nogal').checked`, { what: "Nogal recordado" });
    assert.equal(await darkSquare(page), "rgb(162, 105, 61)");
  });

  test("las flechas llevan colores fijos, iguales con cualquier interfaz", async () => {
    const arrow = await page.eval(`(() => { const s = getComputedStyle(document.documentElement); return [s.getPropertyValue('--arrow-best').trim(), s.getPropertyValue('--arrow-yours').trim()]; })()`);
    assert.deepEqual(arrow, ["#0a5f78", "#1d2027"]);
  });

  test("un valor guardado que no es válido vuelve a Bosque", async () => {
    await page.eval(`localStorage.setItem('escaque:tablero', 'x<y')`);
    await page.eval(`setTimeout(() => location.reload(), 0)`);
    await page.waitFor(`document.getElementById('tablero-bosque')?.checked === true`, { what: "Bosque por defecto" });
    assert.equal(await page.eval(`document.documentElement.hasAttribute('data-tablero')`), false);
  });
});
