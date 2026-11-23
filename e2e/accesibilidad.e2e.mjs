// Pruebas de extremo a extremo de accesibilidad, sin dependencias: Chrome real manejado por tools/cdp.mjs.
// Comprueban que se puede jugar solo con teclado, que hay etiquetas ARIA y que las jugadas se anuncian en SAN,
// también en el repaso de la partida. Uso: npm run test:e2e (monta el sitio y lo sirve en un puerto libre).
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
  await browser?.close();
  server?.kill();
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

describe("accesibilidad de extremo a extremo", () => {
  let page;
  before(async () => {
    page = await browser.newPage();
  });

  test("el documento tiene idioma, título, puntos de referencia y nombres accesibles", async () => {
    await startTwoPlayers(page);
    const audit = await page.eval(`(() => {
      const name = (el) => (el.getAttribute('aria-label') ?? el.getAttribute('aria-labelledby') ?? (el.labels && el.labels[0]?.textContent) ?? el.textContent ?? '').trim();
      const visible = (el) => !el.closest('[hidden]') && !el.closest('[inert]');
      const nameless = [...document.querySelectorAll('button, a[href], input, select, [role=button]')].filter(visible).filter((el) => name(el) === '').map((el) => el.outerHTML.slice(0, 80));
      const imgs = [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length;
      return {
        lang: document.documentElement.lang,
        title: document.title,
        nav: document.querySelector('nav')?.getAttribute('aria-label'),
        mains: [...document.querySelectorAll('main')].filter(visible).length,
        h1: document.querySelectorAll('h1').length,
        nameless, imgs,
        liveRegions: [...document.querySelectorAll('[aria-live], [role=status], [role=alert]')].length,
      };
    })()`);
    assert.equal(audit.lang, "es");
    assert.match(audit.title, /Escaque/);
    assert.equal(audit.nav, "Principal");
    assert.equal(audit.mains, 1, "una sola región main visible");
    assert.equal(audit.h1, 1);
    assert.deepEqual(audit.nameless, [], "todo control visible tiene nombre");
    assert.equal(audit.imgs, 0, "ninguna imagen sin alt");
    assert.ok(audit.liveRegions >= 3, "regiones vivas para estado y anuncios");
  });

  test("el tablero es una rejilla ARIA con 64 casillas etiquetadas y un solo tabulable", async () => {
    const board = await page.eval(`(() => {
      const grid = document.querySelector('#tablero [role=grid]');
      const cells = [...grid.querySelectorAll('[role=gridcell]')];
      return {
        label: grid.getAttribute('aria-label'),
        rows: grid.querySelectorAll('[role=row]').length,
        cells: cells.length,
        unlabelled: cells.filter((c) => !c.getAttribute('aria-label')).length,
        tabbable: cells.filter((c) => c.tabIndex === 0).length,
        e2: cells.find((c) => c.dataset.square === 'e2').getAttribute('aria-label'),
      };
    })()`);
    assert.match(board.label, /^Tablero de ajedrez, visto desde las blancas/);
    assert.equal(board.rows, 8);
    assert.equal(board.cells, 64);
    assert.equal(board.unlabelled, 0);
    assert.equal(board.tabbable, 1, "tabindex itinerante: una sola casilla en el orden de tabulación");
    assert.match(board.e2, /e2/);
  });

  test("se juega una partida entera solo con el teclado y cada jugada se anuncia en SAN española", async () => {
    await moveByKeyboard(page, "f2", "f3");
    assert.match(await announcement(page), /^Blancas: f3\. Peón de f2 a f3\./);
    await moveByKeyboard(page, "e7", "e5");
    assert.match(await announcement(page), /^Negras: e5\. Peón de e7 a e5\./);
    await moveByKeyboard(page, "g2", "g4");
    assert.match(await announcement(page), /^Blancas: g4\./);
    await moveByKeyboard(page, "d8", "h4"); // dama: en SAN inglesa es «Qh4#», en la interfaz «Dh4#»
    const last = await announcement(page);
    assert.match(last, /^Negras: Dh4#\. Dama de d8 a h4\. Jaque mate\.$/);
    const moves = await page.eval(`[...document.querySelectorAll('#lista-jugadas button')].map((b) => b.getAttribute('aria-label'))`);
    assert.equal(moves.length, 4);
    assert.match(moves[3], /Dh4#/);
    assert.match(await page.eval(`document.getElementById('estado-texto').textContent`), /Jaque mate\. Ganan las negras\./);
  });

  test("el repaso de la partida se maneja con teclado, tiene nombres ARIA y anuncia el análisis", async () => {
    // El repaso es de las partidas contra la máquina: se recupera del guardado una partida perdida (mate del loco).
    await page.eval(`localStorage.setItem('escaque:partida', JSON.stringify({ v: 2, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', moves: ['f2f3', 'e7e5', 'g2g4', 'd8h4'], ply: 4, orientation: 'w', mode: 'maquina', level: 'facil', player: 'w' }))`);
    await page.goto(base + "/?recuperar#/jugar"); // otra URL: navegación completa, no solo cambio de fragmento
    await page.waitFor(`!document.getElementById('resultado').hidden`, { what: "panel de resultado" });
    assert.match(await page.eval(`document.getElementById('resultado-titulo').textContent`), /Has perdido/);
    await tabTo(page, `e.id === 'repasar'`);
    await page.press("Enter");
    await page.waitFor(`!document.getElementById('pantalla-repaso').hidden`, { what: "pantalla de repaso" });
    assert.equal((await focusInfo(page)).id, "repaso-titulo", "el foco pasa al título al abrir el repaso");
    await page.waitFor(`/Análisis terminado/.test(document.getElementById('repaso-anuncio').textContent)`, { timeout: 60000, what: "fin del análisis" });

    const names = await page.eval(`(() => {
      const visible = (el) => !el.closest('[hidden]');
      const buttons = [...document.querySelectorAll('#pantalla-repaso button')].filter(visible);
      return {
        nameless: buttons.filter((b) => !(b.getAttribute('aria-label') ?? b.textContent).trim()).length,
        group: document.getElementById('repaso-paso').getAttribute('aria-label'),
        shortcuts: [...document.querySelectorAll('#repaso-paso [aria-keyshortcuts]')].map((b) => b.getAttribute('aria-keyshortcuts')),
        curve: document.getElementById('repaso-lienzo').getAttribute('aria-label'),
        moveLabels: [...document.querySelectorAll('#repaso-lista button')].map((b) => b.getAttribute('aria-label')).filter(Boolean),
      };
    })()`);
    assert.equal(names.nameless, 0, "todos los botones del repaso tienen nombre");
    assert.equal(names.group, "Moverse por la partida");
    assert.deepEqual(names.shortcuts, ["Home", "ArrowLeft", "ArrowRight", "End"]);
    assert.ok(names.curve && names.curve.length > 10, "la curva se describe con texto");
    assert.ok(names.moveLabels.some((l) => /Dh4#/.test(l)), `la lista del repaso nombra las jugadas en SAN española: ${names.moveLabels.join(" | ")}`);

    // Navegación por la partida solo con flechas desde el botón «Siguiente».
    await tabTo(page, `e.dataset.paso === 'siguiente'`);
    await page.press("Home");
    const at = () => page.eval(`document.querySelector('#repaso-lista [aria-current=true]')?.getAttribute('aria-label') ?? null`);
    const first = await at();
    await page.press("End");
    const lastSel = await at();
    assert.notEqual(first, lastSel, "Inicio y Fin cambian la jugada seleccionada");
    assert.match(lastSel ?? "", /Dh4#/);
    await page.press("ArrowLeft");
    assert.match((await at()) ?? "", /g4/);
    await page.press("ArrowRight");
    assert.match((await at()) ?? "", /Dh4#/);
  });

  test("sin errores de consola ni excepciones durante todo el recorrido", () => {
    assert.deepEqual(page.errors, []);
  });
});
