// Prueba de extremo a extremo de los errores de entrada (issue #75): una jugada no válida en el tablero
// deja un aviso bajo el estado, que se quita con la siguiente acción, y el diálogo PGN carga una
// partida en notación española. Chrome real (tools/cdp.mjs).
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
  await page.waitFor(`document.querySelector('#tablero [data-square="e1"]')`, { what: "casillas del tablero" });
}

/** Pulsa teclas sobre la casilla con el foco del tablero (el foco empieza en el rey, e1). */
async function keys(page, ...list) {
  for (const key of list) {
    await page.eval(`(() => {
      const target = document.querySelector('#tablero [tabindex="0"]');
      target.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true, cancelable: true }));
    })()`);
  }
}

const notice = `(() => { const n = document.getElementById('estado-aviso'); return n.hidden ? null : n.textContent; })()`;

describe("jugada no válida: aviso en el estado", () => {
  test("el caballo de b1 a b4 explica por qué y el aviso se quita al elegir otra vez", async () => {
    const page = await browser.newPage();
    await startTwoPlayers(page);
    assert.equal(await page.eval(notice), null, "sin aviso al empezar");
    await keys(page, "ArrowLeft", "ArrowLeft", "ArrowLeft", "Enter"); // elige el caballo de b1
    await keys(page, "ArrowUp", "ArrowUp", "ArrowUp", "Enter"); // b4: un caballo no llega
    assert.equal(await page.eval(notice), "Ese caballo no puede ir a b4.");
    assert.equal(await page.eval(`document.getElementById('estado').contains(document.getElementById('estado-aviso'))`), true);
    // Se anuncia una vez, en la región de anuncios; el aviso visible no se lee otra vez desde el estado.
    assert.equal(await page.eval(`document.getElementById('anuncio').textContent`), "Ese caballo no puede ir a b4.");
    assert.equal(await page.eval(`document.getElementById('estado-aviso').getAttribute('aria-hidden')`), "true");
    // El mismo intento otra vez cambia el anuncio, para que el lector lo repita.
    await keys(page, "ArrowDown", "ArrowDown", "ArrowDown", "Enter", "ArrowUp", "ArrowUp", "ArrowUp", "Enter");
    assert.equal(await page.eval(`document.getElementById('anuncio').textContent.trim()`), "Ese caballo no puede ir a b4.");
    assert.notEqual(await page.eval(`document.getElementById('anuncio').textContent`), "Ese caballo no puede ir a b4.");
    await keys(page, "ArrowDown"); // mover el foco no lo quita
    assert.equal(await page.eval(notice), "Ese caballo no puede ir a b4.");
    await keys(page, "ArrowDown", "ArrowDown", "Enter"); // vuelve a b1 y elige el caballo
    assert.equal(await page.eval(notice), null, "elegir pieza quita el aviso");
  });
});

describe("PGN en notación española", () => {
  test("«1. e4 e5 2. Cf3 Cc6» se carga y abre el repaso", async () => {
    const page = await browser.newPage();
    await page.goto(base + "/#/jugar");
    await page.waitFor(`document.getElementById('cargar-pgn')`, { what: "botón Cargar PGN" });
    await page.eval(`document.getElementById('cargar-pgn').click()`);
    await page.eval(`(() => { document.getElementById('pgn-campo').value = '1. e4 e5 2. Cf3 Cc6'; document.getElementById('pgn-cargar').click(); })()`);
    assert.equal(await page.eval(`document.getElementById('pgn-error').hidden`), true, "sin error");
    assert.match(await page.eval(`document.getElementById('pgn-ayuda').textContent`), /español \(C, A, T, D, R\) o en inglés \(N, B, R, Q, K\)/);
  });
});
