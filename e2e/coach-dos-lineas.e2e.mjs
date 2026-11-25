// Pruebas de extremo a extremo de «Coach: las dos líneas» (issue #87, lienzo «CoachRefutacion*»), sin dependencias:
// Chrome real manejado por tools/cdp.mjs. Partida a dos: 1. e4 e5 2. Ac4 Cc6 3. Dh5 De7 4. Dg5, que deja la dama (H-03).
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

const H03 = [["e2", "e4"], ["e7", "e5"], ["f1", "c4"], ["b8", "c6"], ["d1", "h5"], ["d8", "e7"], ["h5", "g5"]];

/** Lo que enseña el bloque de las dos líneas. */
const lines = (page) =>
  page.eval(`(() => {
    const box = document.querySelector('#coach .coach__lineas');
    if (box === null) return null;
    const title = box.querySelector('h3');
    const list = box.querySelector('ul');
    const items = [...list.children].map((li) => ({
      name: li.querySelector('.linea__nombre').textContent,
      moves: li.querySelector('.linea__jugadas').textContent,
      key: li.querySelector('.linea__clave')?.textContent ?? null,
      marks: li.querySelectorAll('svg[aria-hidden="true"]').length,
    }));
    return {
      title: title.textContent,
      labelled: list.getAttribute('aria-labelledby') === title.id && title.id !== '',
      role: list.getAttribute('role'),
      items,
      note: box.querySelector('.linea__nota').textContent,
      buttons: box.querySelectorAll('button, a, [tabindex]').length,
      single: document.querySelector('#coach .coach__linea') !== null,
      live: box.closest('[aria-live], [role="status"]') !== null,
      underline: getComputedStyle(box.querySelector('.linea__clave')).textDecorationLine,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  })()`);

describe("coach: las dos líneas de extremo a extremo", () => {
  let page;
  before(async () => {
    page = await browser.newPage();
    await startTwoPlayers(page);
    for (const [from, to] of H03) await moveByKeyboard(page, from, to);
    await page.waitFor(`document.querySelector('#coach .coach__alternativa')`, { what: "bloque de la alternativa", timeout: 20000 });
  });

  test("el «Por qué» cuenta la respuesta del rival y salen las dos líneas", async () => {
    const why = await page.eval(`document.querySelector('#coach .coach__porque').textContent`);
    assert.match(why, /^Por qué: Tras Dg5, las negras /);
    const l = await lines(page);
    assert.ok(l !== null, "no hay bloque de dos líneas");
    assert.equal(l.title, "Líneas de Alfil Beta");
    assert.equal(l.single, false);
    assert.equal(l.items.length, 2);
    assert.equal(l.items[0].name, "Línea de tu jugada");
    assert.match(l.items[0].moves, /^4\. Dg5 Dxg5 \(respuesta clave\)/);
    assert.equal(l.items[0].key, "Dxg5 (respuesta clave)");
    assert.equal(l.items[1].name, "Línea de la mejor jugada");
    assert.match(l.items[1].moves, /^4\. \S+/);
    assert.equal(l.note, "Subrayada: la respuesta clave del rival, la que explica el «Por qué».");
  });

  test("accesibilidad: lista con nombre, marcas decorativas, subrayado, sin controles nuevos ni región viva", async () => {
    const l = await lines(page);
    assert.equal(l.labelled, true);
    assert.equal(l.role, "list");
    assert.deepEqual(l.items.map((i) => i.marks), [1, 1]);
    assert.equal(l.buttons, 0);
    assert.equal(l.live, false);
    assert.equal(l.underline, "underline");
    assert.deepEqual(page.errors, []);
  });

  test("a 390 px de ancho no hay desplazamiento horizontal", async () => {
    await page.call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await page.waitFor(`document.querySelector('#coach .coach__lineas')`);
    const l = await lines(page);
    assert.equal(l.overflow, false);
  });
});
