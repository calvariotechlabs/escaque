// Prueba de extremo a extremo de «Pulido 2» (CAL-402, revisión visual 2): el velo de los diálogos es oscuro en los dos temas,
// la partida pone el coach antes que el selector «Tablero», el repaso deja los botones de paso a la vista, ← → Inicio y Fin
// funcionan en toda la pantalla del repaso y las jugadas van en mono (regla de notación). Chrome real (tools/cdp.mjs).
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



// CAL-402 (revisión visual 2): velo oscuro en los dos temas, orden de la partida y del repaso, ←/→ en todo el repaso
// y regla de notación (mono solo para jugadas, coordenadas y cifras).
const PGN = "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6";

let visits = 0;
async function openRepaso(page) {
  await page.goto(base + `/?r=${++visits}#/jugar`); // la consulta distinta fuerza una carga nueva (un cambio de # no la haría)
  await page.waitFor(`document.getElementById('cargar-pgn')`, { what: "botón Cargar PGN" });
  await page.eval(`document.getElementById('cargar-pgn').click()`);
  await page.eval(`(() => { document.getElementById('pgn-campo').value = ${JSON.stringify(PGN)}; document.getElementById('pgn-cargar').click(); })()`);
  await page.waitFor(`!document.getElementById('pantalla-repaso').hidden`, { what: "pantalla de repaso" });
}

describe("pulido 2", () => {
  let page;
  before(async () => {
    page = await browser.newPage();
    await page.call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  });

  after(async () => {
    await page.goto("about:blank"); // corta el análisis del repaso antes de cerrar Chrome
  });

  test("el velo del diálogo es oscuro en el tema oscuro y en el claro", async () => {
    await page.goto(base + "/#/jugar");
    await page.waitFor(`document.getElementById('cargar-pgn')`, { what: "botón Cargar PGN" });
    for (const theme of ["dark", "light"]) {
      await page.eval(`document.documentElement.setAttribute('data-theme', '${theme}')`);
      await page.eval(`document.getElementById('cargar-pgn').click()`);
      const rgba = await page.eval(`getComputedStyle(document.getElementById('dialogo-pgn'), '::backdrop').backgroundColor`);
      const [r, g, b] = rgba.match(/[\d.]+/g).map(Number);
      assert.ok((r + g + b) / 3 < 40, `${theme}: el velo es oscuro (${rgba})`);
      await page.eval(`document.getElementById('dialogo-pgn').close()`);
    }
  });

  test("partida: el coach va antes que el selector «Tablero», que queda al final del panel", async () => {
    await page.goto(base + "/?v=orden#/jugar");
    await page.waitFor(`document.getElementById('ajustes')`, { what: "ajustes" });
    await page.eval(`document.querySelector('#ajustes [type=submit]').click()`);
    await page.waitFor(`!document.getElementById('pantalla-partida').hidden`, { what: "partida" });
    const tops = await page.eval(`({ coach: document.getElementById('coach').getBoundingClientRect().top, tema: document.getElementById('tema-tablero').getBoundingClientRect().top, temaLeft: document.getElementById('tema-tablero').getBoundingClientRect().left, coachLeft: document.getElementById('coach').getBoundingClientRect().left, tableroAncho: document.querySelector('.partida__tablero').getBoundingClientRect().width, jugadas: document.querySelector('.partida__jugadas').getBoundingClientRect().top })`);
    assert.ok(tops.coach < tops.jugadas && tops.jugadas < tops.tema, `orden coach < jugadas < tablero: ${JSON.stringify(tops)}`);
    assert.ok(Math.abs(tops.temaLeft - tops.coachLeft) < 2, `el selector está en la columna del panel: ${JSON.stringify(tops)}`);
    assert.ok(tops.tableroAncho > 500, `el tablero conserva su columna (${tops.tableroAncho} px)`);
  });

  test("repaso: los botones de paso quedan a la vista y Capturas va después", async () => {
    await openRepaso(page);
    const box = await page.eval(`(() => { const p = document.querySelector('#repaso-paso [data-paso=siguiente]').getBoundingClientRect(); const q = document.getElementById('repaso-paso').getBoundingClientRect(); const c = document.getElementById('repaso-capturas').getBoundingClientRect(); return { bottom: p.bottom, h: window.innerHeight, capTop: c.top, pasoBottom: q.bottom }; })()`);
    assert.ok(box.bottom <= box.h, `los botones de paso caben en ${box.h} px (acaban en ${Math.round(box.bottom)})`);
    assert.ok(box.capTop >= box.pasoBottom - 1, "Capturas va después de los botones de paso");
  });

  test("repaso: ← y → funcionan con el foco fuera de los botones de paso", async () => {
    await openRepaso(page);
    await page.eval(`document.activeElement && document.activeElement.blur()`);
    const current = `(() => { const c = document.querySelector('.jugada[aria-current="true"]'); return c ? c.textContent : ''; })()`;
    await page.press("Home");
    const first = await page.eval(current);
    await page.press("ArrowRight");
    await page.press("ArrowRight");
    const after = await page.eval(current);
    assert.notEqual(after, first, "la jugada seleccionada cambia con →");
    await page.press("ArrowLeft");
    assert.notEqual(await page.eval(current), after, "la jugada seleccionada cambia con ←");
    await page.press("End");
    const last = await page.eval(current);
    assert.notEqual(last, after, "Fin salta a la última jugada");
    // En un campo de texto las flechas no mueven el repaso.
    await page.eval(`(() => { const t = document.createElement('textarea'); t.id = 'prueba-campo'; document.body.append(t); t.focus(); })()`);
    await page.press("ArrowLeft");
    assert.equal(await page.eval(current), last, "con el foco en un campo de texto no se mueve");
    await page.eval(`document.getElementById('prueba-campo').remove()`);
  });

  test("notación: las jugadas de la lista van en mono", async () => {
    await openRepaso(page);
    const family = await page.eval(`getComputedStyle(document.querySelector('.jugada')).fontFamily`);
    assert.match(family, /IBM Plex Mono/);
    const frase = await page.eval(`(() => { const e = document.createElement('span'); e.className = 'coach__valor coach__valor--frase'; document.body.append(e); const f = getComputedStyle(e).fontFamily; e.remove(); return f; })()`);
    assert.match(frase, /IBM Plex Sans/, "«Mate en 1» va en Sans");
  });
});
