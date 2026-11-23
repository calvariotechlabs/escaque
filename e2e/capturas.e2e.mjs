// Prueba de extremo a extremo del panel «Capturas»: piezas capturadas, ventaja de material, orden según el
// giro del tablero y que no se anuncie en cada jugada. Chrome real manejado por tools/cdp.mjs.
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

const FILES = "abcdefgh";

/** Información del elemento con el foco. */
const focusInfo = (page) =>
  page.eval(`(() => { const e = document.activeElement; return { tag: e.tagName, id: e.id, square: e.dataset.square ?? null, text: (e.getAttribute('aria-label') ?? e.textContent ?? '').trim() }; })()`);

/** Tabula hasta que el foco cumple la condición (expresión sobre `document.activeElement`). */
async function tabTo(page, condition, max = 60) {
  for (let i = 0; i < max; i++) {
    if (await page.eval(`(() => { const e = document.activeElement; return Boolean(${condition}); })()`)) return;
    await page.press("Tab");
  }
  throw new Error(`El foco no llega a: ${condition}`);
}

/** Lleva el foco del tablero a una casilla solo con flechas (tablero con las blancas abajo). */
async function focusSquare(page, to) {
  await tabTo(page, `e.getAttribute('role') === 'gridcell'`);
  for (let i = 0; i < 16; i++) {
    const { square } = await focusInfo(page);
    if (square === to) return;
    const dx = FILES.indexOf(to[0]) - FILES.indexOf(square[0]);
    const dy = Number(to[1]) - Number(square[1]);
    await page.press(dx > 0 ? "ArrowRight" : dx < 0 ? "ArrowLeft" : dy > 0 ? "ArrowUp" : "ArrowDown");
  }
  throw new Error(`No se llega a ${to}`);
}

async function moveByKeyboard(page, from, to) {
  await focusSquare(page, from);
  await page.press("Enter");
  await focusSquare(page, to);
  await page.press("Enter");
}

/** Abre la web y empieza una partida de dos jugadores, solo con el teclado. */
async function startTwoPlayers(page) {
  await page.goto(base + "/#/jugar"); // perfil de Chrome nuevo: sin partida guardada
  await page.waitFor(`!document.getElementById('pantalla-ajustes').hidden`, { what: "pantalla de ajustes" });
  await tabTo(page, `e.name === 'modo' && e.type === 'radio'`);
  await page.press("ArrowUp"); // «Dos jugadores» (el grupo de radios se maneja con flechas)
  await page.waitFor(`document.getElementById('modo-dos').checked`);
  await tabTo(page, `e.type === 'submit'`);
  await page.press("Enter");
  await page.waitFor(`!document.getElementById('pantalla-partida').hidden`, { what: "pantalla de partida" });
}

const announcement = (page) => page.eval(`document.getElementById('anuncio').textContent`);


/** Texto de cada fila del panel: bando, número de piezas dibujadas y ventaja. */
const rows = (page) =>
  page.eval(`[...document.querySelectorAll('#capturas .capturas__fila')].map((fila) => ({
    quien: fila.querySelector('.capturas__quien').textContent.trim(),
    piezas: fila.querySelectorAll('.pieza').length,
    ventaja: fila.querySelector('.capturas__ventaja')?.textContent ?? null,
    lector: fila.querySelector('.oculto').textContent,
  }))`);

describe("panel de capturas de extremo a extremo", () => {
  let page;
  before(async () => {
    page = await browser.newPage();
  });

  test("sin jugadas no hay capturas y el panel no es una región viva", async () => {
    await startTwoPlayers(page);
    assert.deepEqual(await rows(page), [
      { quien: "Blancas", piezas: 0, ventaja: null, lector: "Blancas no han capturado nada." },
      { quien: "Negras", piezas: 0, ventaja: null, lector: "Negras no han capturado nada." },
    ]);
    const live = await page.eval(`Boolean(document.getElementById('capturas').closest('[aria-live], [role=status], [role=alert]')) || Boolean(document.getElementById('capturas').querySelector('[aria-live], [role=status], [role=alert]'))`);
    assert.equal(live, false);
  });

  test("capturar un peón lo dibuja, da +1 a las blancas y no se anuncia", async () => {
    await moveByKeyboard(page, "e2", "e4");
    await moveByKeyboard(page, "d7", "d5");
    await moveByKeyboard(page, "e4", "d5");
    const [blancas, negras] = await rows(page);
    assert.deepEqual(blancas, { quien: "Blancas", piezas: 1, ventaja: "+1", lector: "Blancas han capturado un peón. Ventaja de 1." });
    assert.equal(negras.piezas, 0);
    assert.doesNotMatch(await announcement(page), /captura(s|do)? un peón.*Ventaja|Capturas/);
  });

  test("al girar el tablero va primero la fila del bando que queda abajo", async () => {
    await page.eval(`document.getElementById('girar').click()`);
    const [primera, segunda] = await rows(page);
    assert.equal(primera.quien, "Negras");
    assert.equal(segunda.quien, "Blancas");
  });

  test("deshacer la captura vuelve a dejar el panel vacío", async () => {
    await page.eval(`document.getElementById('deshacer').click()`);
    assert.deepEqual((await rows(page)).map((fila) => fila.piezas), [0, 0]);
  });
});
