// Pruebas de extremo a extremo del arrastre de piezas con el dedo, sin dependencias: Chrome real manejado por
// tools/cdp.mjs, con pantalla de móvil y toques de verdad (Input.dispatchTouchEvent).
// Comprueban que arrastrar mueve la pieza sin desplazar la página, también en las lecciones, y que un gesto
// que el navegador deja a medias (Safari en iOS puede no mandar ni pointerup ni pointercancel) no bloquea el tablero.
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
  browser = await launchBrowser({ width: 390, height: 844 });
});

after(async () => {
  try {
    await browser?.close();
  } finally {
    server?.kill();
  }
});

/** Página con pantalla y toques de móvil. */
async function phonePage() {
  const page = await browser.newPage();
  await page.call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await page.call("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  return page;
}

/** Centro de una casilla visible del tablero, en coordenadas de la ventana. */
const center = (page, square) =>
  page.eval(`(() => {
    const cell = [...document.querySelectorAll('[data-square="${square}"]')].find((e) => e.offsetParent !== null);
    const r = cell.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** Empieza a arrastrar con el dedo desde `from` hacia `to`, en pasos, sin levantarlo. */
async function touchDragStart(page, from, to, steps = 10) {
  // Un dedo solo toca lo que se ve: el tablero se centra antes (y el desplazamiento no cuenta como fallo).
  await page.eval(`([...document.querySelectorAll('.tablero')].find((e) => e.offsetParent !== null).scrollIntoView({ block: "center" }), true)`);
  await pause(100);
  await page.eval(`(window.__scroll = 0, true)`);
  const a = await center(page, from);
  const b = await center(page, to);
  await page.call("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: a.x, y: a.y }] });
  for (let i = 1; i <= steps; i++) {
    const x = a.x + ((b.x - a.x) * i) / steps;
    const y = a.y + ((b.y - a.y) * i) / steps;
    await page.call("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
    await pause(16);
  }
}

async function touchDrag(page, from, to) {
  await touchDragStart(page, from, to);
  await page.call("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await pause(100);
}

async function mouseClick(page, square) {
  const { x, y } = await center(page, square);
  for (const type of ["mousePressed", "mouseReleased"]) await page.call("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
  await pause(50);
}

/** ¿Hay pieza en la casilla visible? */
const pieceOn = (page, square) =>
  page.eval(`(() => {
    const cell = [...document.querySelectorAll('[data-square="${square}"]')].find((e) => e.offsetParent !== null);
    return cell.querySelector('.pieza') !== null;
  })()`);

/** Cuenta los pointercancel y el desplazamiento de la página desde ahora. */
const watch = (page) =>
  page.eval(`(() => {
    window.__cancel = 0;
    window.__scroll = 0;
    document.addEventListener('pointercancel', () => window.__cancel++, true);
    window.addEventListener('scroll', () => window.__scroll++);
    return true;
  })()`);

let visits = 0;

/** Empieza una partida de dos jugadores desde cero (las pruebas comparten perfil y la partida se guarda). */
async function startTwoPlayers(page) {
  await page.goto(base + "/");
  await page.eval(`(localStorage.clear(), true)`);
  await page.goto(`${base}/?visita=${++visits}#/jugar`);
  await page.waitFor(`!document.getElementById('pantalla-ajustes').hidden`, { what: "pantalla de ajustes" });
  await page.eval(`(() => { document.getElementById('modo-dos').click(); document.querySelector('#pantalla-ajustes [type=submit]').click(); return true; })()`);
  await page.waitFor(`!document.getElementById('pantalla-partida').hidden`, { what: "pantalla de partida" });
}

describe("arrastre con el dedo", () => {
  test("en la partida, arrastrar un peón lo mueve sin desplazar la página", async () => {
    const page = await phonePage();
    await startTwoPlayers(page);
    await watch(page);
    await touchDrag(page, "e2", "e4");
    assert.equal(await pieceOn(page, "e4"), true, "el peón llega a e4");
    assert.equal(await pieceOn(page, "e2"), false);
    assert.deepEqual(await page.eval(`({ cancel: window.__cancel, scroll: window.__scroll })`), { cancel: 0, scroll: 0 });
    assert.deepEqual(page.errors, []);
  });

  test("en una lección, arrastrar la torre la mueve sin desplazar la página", async () => {
    const page = await phonePage();
    await page.goto(base + "/#/lecciones/el-tablero");
    await page.waitFor(`document.querySelector('#leccion-tablero [data-square="e2"] .pieza') !== null`, { what: "tablero de la lección" });
    await watch(page);
    await touchDrag(page, "e2", "e6");
    assert.deepEqual(await page.eval(`({ cancel: window.__cancel, scroll: window.__scroll })`), { cancel: 0, scroll: 0 });
    assert.equal(await pieceOn(page, "e6"), true, "la torre llega a e6");
    assert.deepEqual(page.errors, []);
  });

  test("los tableros que se juegan no seleccionan texto con una pulsación larga; el del repaso deja desplazar la página", async () => {
    const page = await phonePage();
    await startTwoPlayers(page);
    const style = (id) =>
      page.eval(`(() => { const s = getComputedStyle(document.querySelector('#${id} .tablero__rejilla')); return { touch: s.touchAction, select: s.userSelect || s.webkitUserSelect }; })()`);
    assert.deepEqual(await style("tablero"), { touch: "none", select: "none" });
    assert.equal((await style("repaso-tablero")).touch, "auto");
    await page.goto(`${base}/?visita=${++visits}#/lecciones/el-tablero`);
    await page.waitFor(`document.querySelector('#leccion-tablero .tablero__rejilla') !== null`, { what: "tablero de la lección" });
    assert.deepEqual(await style("leccion-tablero"), { touch: "none", select: "none" });
  });

  test("si el navegador no cierra un arrastre, el siguiente toque o clic no se pierde", async () => {
    const page = await phonePage();
    await startTwoPlayers(page);
    // Simula Safari en iOS: el dedo arrastra el peón y el gesto se queda sin pointerup ni pointercancel.
    await touchDragStart(page, "e2", "e3");
    await mouseClick(page, "d2");
    await mouseClick(page, "d4");
    assert.equal(await pieceOn(page, "d4"), true, "el clic posterior juega d4");
    assert.equal(await pieceOn(page, "e2"), true, "el peón arrastrado vuelve a e2");
    assert.equal(
      await page.eval(`document.querySelector('#tablero [data-square="e2"] .pieza').style.transform`),
      "",
      "la pieza no se queda desplazada",
    );
    assert.deepEqual(page.errors, []);
  });
});
