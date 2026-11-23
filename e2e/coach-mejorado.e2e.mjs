// Pruebas de extremo a extremo del coach mejorado (lienzo «Coach mejorado», CAL-394), sin dependencias:
// Chrome real manejado por tools/cdp.mjs. Partida a dos con la trampa de Légal: 5. h3 en lugar de 5. Cxe5.
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

const LEGAL = [["e2", "e4"], ["e7", "e5"], ["g1", "f3"], ["d7", "d6"], ["f1", "c4"], ["c8", "g4"], ["b1", "c3"], ["g7", "g6"], ["h2", "h3"]];

const state = (page) =>
  page.eval(`(() => {
    const board = document.getElementById('tablero');
    const piece = (sq) => Boolean(board.querySelector('[data-square="' + sq + '"] .pieza:not(.pieza--copia)'));
    return {
      banner: !document.getElementById('vista-revision').hidden,
      legend: !document.getElementById('vista-leyenda').hidden,
      arrows: board.querySelectorAll('.tablero__flechas path').length,
      grid: board.querySelector('.tablero__rejilla').getAttribute('aria-label'),
      h2: piece('h2'),
      h3: piece('h3'),
      f3marks: board.querySelector('[data-square="f3"]').dataset.marks ?? '',
    };
  })()`);

describe("coach mejorado de extremo a extremo", () => {
  let page;
  before(async () => {
    page = await browser.newPage();
    await startTwoPlayers(page);
    for (const [from, to] of LEGAL) await moveByKeyboard(page, from, to);
  });

  test("la revisión explica por qué Cxe5 era mejor y da la línea", async () => {
    await page.waitFor(`document.querySelector('#coach .coach__alternativa')`, { what: "bloque de la alternativa", timeout: 20000 });
    const text = await page.eval(`document.querySelector('#coach .coach__alternativa').textContent`);
    assert.match(text, /Mejor jugada: Cxe5/);
    assert.match(text, /Por qué: Cxe5 gana un peón\./);
    assert.match(text, /Línea de Alfil Beta: 5\. Cxe5 dxe5 6\. Dxg4/);
  });

  test("«Ver en el tablero» enseña la posición de antes con dos flechas y bloquea el tablero", async () => {
    await page.eval(`(() => { const b = document.querySelector('#coach .coach__alternativa button'); b.focus(); b.click(); })()`);
    const s = await state(page);
    assert.equal(s.banner, true);
    assert.equal(s.legend, true);
    assert.equal(s.arrows, 2);
    assert.equal(s.h2, true); // el peón aún no ha ido a h3
    assert.equal(s.h3, false);
    assert.match(s.grid, /posición antes de 5\. h3/);
    assert.match(await announcement(page), /Posición antes de tu jugada 5\. h3\. Mejor jugada: Cxe5\./);
    assert.equal(await page.eval(`document.querySelector('#coach .coach__alternativa button').textContent`), "Volver a la partida");
    assert.equal(await page.eval(`document.activeElement === document.querySelector('#coach .coach__alternativa button')`), true);
    // Con el tablero bloqueado, Enter no selecciona.
    await focusSquare(page, "e5");
    await page.press("Enter");
    assert.doesNotMatch(await page.eval(`document.querySelector('#tablero [data-square="e5"]').dataset.marks ?? ''`), /selected/);
  });

  test("Escape vuelve a la partida", async () => {
    await page.press("Escape");
    const s = await state(page);
    assert.equal(s.banner, false);
    assert.equal(s.arrows, 0);
    assert.equal(s.h3, true);
    assert.doesNotMatch(s.grid, /antes/);
    assert.equal(await page.eval(`document.querySelector('#coach .coach__alternativa button').textContent`), "Ver en el tablero");
  });

  test("tres pistas para las negras: idea, pieza marcada y jugada con flecha", async () => {
    const button = `document.getElementById('coach-pistas-boton')`;
    assert.equal(await page.eval(`${button}.textContent`), "Pedir pista 1 de 3");
    await page.eval(`${button}.click()`);
    await page.waitFor(`document.querySelectorAll('#coach-pistas-lista li').length === 1`, { what: "pista 1" });
    assert.match(await page.eval(`document.querySelectorAll('#coach-pistas-lista li')[0].textContent`), /^Pista 1 de 3/);
    await page.eval(`${button}.click()`);
    await page.waitFor(`document.querySelectorAll('#coach-pistas-lista li').length === 2`, { what: "pista 2" });
    const second = await page.eval(`document.querySelectorAll('#coach-pistas-lista li')[1].textContent`);
    const from = second.match(/de ([a-h][1-8])\.$/)[1];
    assert.match(await page.eval(`document.querySelector('#tablero [data-square="${from}"]').dataset.marks ?? ''`), /selected/);
    await page.eval(`${button}.click()`);
    await page.waitFor(`document.querySelectorAll('#coach-pistas-lista li').length === 3`, { what: "pista 3" });
    assert.match(await page.eval(`document.querySelectorAll('#coach-pistas-lista li')[2].textContent`), /^Pista 3 de 3Alfil Beta jugaría .+\. Mira la flecha\.$/);
    assert.equal(await page.eval(`document.querySelectorAll('#tablero .tablero__flechas path').length`), 1);
    assert.equal(await page.eval(`${button}.textContent`), "No quedan más pistas");
    assert.equal(await page.eval(`${button}.getAttribute('aria-disabled')`), "true");
  });

  test("al mover, las pistas vuelven a empezar y la flecha desaparece", async () => {
    await moveByKeyboard(page, "a7", "a6");
    assert.equal(await page.eval(`document.querySelectorAll('#coach-pistas-lista li').length`), 0);
    assert.equal(await page.eval(`document.querySelectorAll('#tablero .tablero__flechas path').length`), 0);
    assert.equal(await page.eval(`document.getElementById('coach-pistas-boton').textContent`), "Pedir pista 1 de 3");
  });

  test("una partida nueva empieza sin pistas aunque la posición sea la misma", async () => {
    const newGame = async () => {
      await page.eval(`(document.getElementById('nueva').click(), document.getElementById('empezar').click(), true)`);
      await page.waitFor(`!document.getElementById('pantalla-ajustes').hidden`, { what: "pantalla de ajustes" });
      await page.eval(`(() => { document.getElementById('modo-dos').click(); document.querySelector('#pantalla-ajustes [type=submit]').click(); return true; })()`);
      await page.waitFor(`!document.getElementById('pantalla-partida').hidden`, { what: "pantalla de partida" });
    };
    await newGame();
    await page.eval(`document.getElementById('coach-pistas-boton').click()`);
    await page.waitFor(`document.querySelectorAll('#coach-pistas-lista li').length === 1`, { what: "pista en la posición inicial" });
    await newGame();
    assert.equal(await page.eval(`document.querySelectorAll('#coach-pistas-lista li').length`), 0);
    assert.equal(await page.eval(`document.getElementById('coach-pistas-boton').textContent`), "Pedir pista 1 de 3");
  });

  test("sin errores en la consola", () => {
    assert.deepEqual(page.errors, []);
  });
});
