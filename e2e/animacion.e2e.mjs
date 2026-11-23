// Pruebas de extremo a extremo de la animación de piezas (lienzo «Piezas que se mueven», CAL-391), sin
// dependencias: Chrome real manejado por tools/cdp.mjs. Miran las animaciones con document.getAnimations().
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
  browser = await launchBrowser({ width: 1280, height: 900 });
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
  await page.call("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 0, x: a.x, y: a.y }] });
  for (let i = 1; i <= steps; i++) {
    const x = a.x + ((b.x - a.x) * i) / steps;
    const y = a.y + ((b.y - a.y) * i) / steps;
    await page.call("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ id: 0, x, y }] });
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


/** Página de escritorio; con `reduced`, el sistema pide reducir movimiento. */
async function deskPage({ reduced = false } = {}) {
  const page = await browser.newPage();
  await page.call("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference" }] });
  return page;
}

/** Animaciones en curso dentro del tablero visible: casilla, clases de lo animado, duración y propiedades. */
const running = (page) =>
  page.eval(`(() => {
    const board = [...document.querySelectorAll('.tablero')].find((e) => e.offsetParent !== null);
    return document.getAnimations().filter((a) => a.playState === 'running' && board.contains(a.effect.target)).map((a) => ({
      square: a.effect.target.closest('[data-square]').dataset.square,
      cls: a.effect.target.getAttribute('class'),
      duration: a.effect.getTiming().duration,
      props: [...new Set(a.effect.getKeyframes().flatMap((k) => Object.keys(k)).filter((k) => !['offset', 'easing', 'composite', 'computedOffset'].includes(k)))].sort(),
    }));
  })()`);

async function play(page, from, to) {
  await mouseClick(page, from);
  await mouseClick(page, to);
}

describe("animación de las piezas", () => {
  test("clic con clic: la pieza se desliza 200 ms hasta su casilla y después no queda nada en marcha", async () => {
    const page = await deskPage();
    await startTwoPlayers(page);
    await mouseClick(page, "g1");
    const { x, y } = await center(page, "f3");
    for (const type of ["mousePressed", "mouseReleased"]) await page.call("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
    const now = await running(page);
    assert.deepEqual(now.map((a) => [a.square, a.duration, a.props.join()]), [["f3", 200, "transform"]]);
    // El anuncio en notación algebraica no espera a la animación.
    assert.match(await page.eval(`document.getElementById('anuncio').textContent`), /Cf3/);
    await pause(300);
    assert.deepEqual(await running(page), []);
    assert.equal(await pieceOn(page, "f3"), true);
  });

  test("en una captura la capturada se desvanece debajo de la atacante", async () => {
    const page = await deskPage();
    await startTwoPlayers(page);
    await play(page, "e2", "e4");
    await play(page, "d7", "d5");
    await pause(300);
    await mouseClick(page, "e4");
    const { x, y } = await center(page, "d5");
    for (const type of ["mousePressed", "mouseReleased"]) await page.call("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
    const now = await running(page);
    assert.deepEqual(now.map((a) => [a.square, a.props.join()]).sort(), [["d5", "opacity,transform"], ["d5", "transform"]]);
    await pause(300);
    const left = await page.eval(`[...document.querySelectorAll('[data-square="d5"]')].find((e) => e.offsetParent !== null).querySelectorAll('.pieza').length`);
    assert.equal(left, 1, "al terminar solo queda la pieza que captura");
  });

  test("el enroque desliza a la vez el rey y la torre", async () => {
    const page = await deskPage();
    await startTwoPlayers(page);
    for (const [a, b] of [["e2", "e4"], ["e7", "e5"], ["g1", "f3"], ["b8", "c6"], ["f1", "c4"], ["g8", "f6"]]) {
      await play(page, a, b);
      await pause(250);
    }
    await play(page, "e1", "g1");
    const now = await running(page);
    assert.deepEqual(now.map((a) => a.square).sort(), ["f1", "g1"]);
  });

  test("arrastrar y soltar no vuelve a animar la pieza", async () => {
    const page = await deskPage();
    await startTwoPlayers(page);
    const a = await center(page, "e2");
    const b = await center(page, "e4");
    await page.call("Input.dispatchMouseEvent", { type: "mousePressed", x: a.x, y: a.y, button: "left", clickCount: 1 });
    for (let i = 1; i <= 8; i++) {
      await page.call("Input.dispatchMouseEvent", { type: "mouseMoved", x: a.x + ((b.x - a.x) * i) / 8, y: a.y + ((b.y - a.y) * i) / 8, button: "left" });
      await pause(16);
    }
    await page.call("Input.dispatchMouseEvent", { type: "mouseReleased", x: b.x, y: b.y, button: "left", clickCount: 1 });
    assert.deepEqual(await running(page), []);
    assert.equal(await pieceOn(page, "e4"), true);
  });

  test("con reducir movimiento la pieza no se desliza: aparece en su destino con un fundido de 120 ms", async () => {
    const page = await deskPage({ reduced: true });
    await startTwoPlayers(page);
    await mouseClick(page, "g1");
    const { x, y } = await center(page, "f3");
    for (const type of ["mousePressed", "mouseReleased"]) await page.call("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
    const now = await running(page);
    assert.deepEqual(now.map((a) => [a.square, a.duration, a.props.join()]), [["f3", 120, "opacity"]]);
  });

  test("Deshacer anima la jugada al revés y el tablero acepta clics mientras tanto", async () => {
    const page = await deskPage();
    await startTwoPlayers(page);
    await play(page, "g1", "f3");
    await pause(300);
    await page.eval(`(document.getElementById('deshacer').click(), true)`);
    const now = await running(page);
    assert.deepEqual(now.map((a) => [a.square, a.props.join()]), [["g1", "transform"]]);
    await mouseClick(page, "b1");
    const marks = await page.eval(`[...document.querySelectorAll('[data-square="b1"]')].find((e) => e.offsetParent !== null).dataset.marks ?? ''`);
    assert.match(marks, /selected/);
  });
});

describe("lo que cambia de golpe", () => {
  test("Nueva partida tras una jugada no anima la vuelta a la posición inicial", async () => {
    const page = await deskPage();
    await startTwoPlayers(page);
    await play(page, "g1", "f3");
    await pause(300);
    await page.eval(`(document.getElementById('nueva').click(), document.getElementById('empezar').click(), true)`);
    await page.waitFor(`!document.getElementById('pantalla-ajustes').hidden`, { what: "pantalla de ajustes" });
    await page.eval(`(() => { document.getElementById('modo-dos').click(); document.querySelector('#pantalla-ajustes [type=submit]').click(); return true; })()`);
    await page.waitFor(`!document.getElementById('pantalla-partida').hidden`, { what: "pantalla de partida" });
    assert.deepEqual(await running(page), []);
    assert.equal(await pieceOn(page, "g1"), true);
  });
});
