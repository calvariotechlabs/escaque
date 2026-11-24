// Prueba de extremo a extremo de la navegación de la cabecera en móvil apaisado estrecho (CAL-405): a 720×450, 667×375 o 640×360
// la columna derecha no da para «Escaque» y la navegación en una fila, así que esta baja a una segunda línea sin ensanchar la página
// ni pisar el estado; en 844×390 y más anchos sigue en una fila. Chrome real (tools/cdp.mjs).
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




/** Inicio limpio: sin partida guardada, «#/jugar» abre los ajustes. */
async function freshStart(page, tag) {
  await page.goto(base + `/?v=${tag}#/jugar`);
  await page.eval(`localStorage.clear()`);
  await page.goto(base + `/?v=${tag}-limpio#/jugar`);
  await page.waitFor(`!document.getElementById('pantalla-ajustes').hidden`, { what: "ajustes" });
}

const medidas = `(() => {
  const h = document.querySelector('.pagina__cabecera');
  const hr = h.getBoundingClientRect();
  const nav = document.querySelector('.pagina__cabecera .lecc-nav').getBoundingClientRect();
  const h1 = document.querySelector('.pagina__cabecera h1').getBoundingClientRect();
  const texto = document.getElementById('enlace-jugar');
  const r = document.createRange(); r.selectNodeContents(texto);
  return { ancho: document.documentElement.scrollWidth, ventana: innerWidth, hr: hr.right, hb: hr.bottom, navR: nav.right, navT: nav.top, navB: nav.bottom, h1T: h1.top, h1L: h1.left, h1B: h1.bottom, jugarL: r.getBoundingClientRect().left };
})()`;

// Ancho de la columna derecha = ancho − alto − 40 px: por debajo de unos 330 px la navegación no cabe junto al nombre.
const ESTRECHOS = [[720, 450], [667, 375], [640, 360], [568, 320]];
const ANCHOS = [[844, 390], [800, 360], [932, 430]];

describe("navegación de la cabecera en móvil apaisado (CAL-405)", () => {
  let page;
  before(async () => {
    page = await browser.newPage();
  });
  after(async () => {
    await page.goto("about:blank");
  });

  for (const [width, height] of [...ESTRECHOS, ...ANCHOS]) {
    const estrecho = ESTRECHOS.some(([w, h]) => w === width && h === height);
    test(`${width}×${height}: la partida no se ensancha y la navegación ${estrecho ? "baja a una segunda línea" : "sigue en una fila"}`, async () => {
      await page.call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: true });
      await freshStart(page, `nav-${width}`);
      await page.eval(`document.querySelector('#ajustes [type=submit]').click()`);
      await page.waitFor(`!document.getElementById('pantalla-partida').hidden`, { what: "partida" });
      const m = await page.eval(medidas);
      assert.ok(m.ancho <= m.ventana, `la página mide ${m.ancho} px en una ventana de ${m.ventana}`);
      assert.ok(m.navR <= m.hr + 0.5, `la navegación acaba en ${m.navR} y la cabecera en ${m.hr}`);
      const estadoTop = await page.eval(`document.querySelector('.partida__estado').getBoundingClientRect().top`);
      assert.ok(m.hb <= estadoTop + 0.5, `la cabecera acaba en ${m.hb} y el estado empieza en ${estadoTop}`);
      if (estrecho) {
        assert.ok(m.navT >= m.h1B - 1, `la navegación va debajo del nombre: ${JSON.stringify(m)}`);
        assert.ok(Math.abs(m.jugarL - m.h1L) < 1, `«Jugar» se alinea con el logo: ${JSON.stringify(m)}`);
      } else {
        assert.ok(m.navT < m.h1B, `la navegación va en la misma fila que el nombre: ${JSON.stringify(m)}`);
      }
    });
  }

  test("la lección también cabe a 720×450, sin pisar el título", async () => {
    await page.call("Emulation.setDeviceMetricsOverride", { width: 720, height: 450, deviceScaleFactor: 1, mobile: true });
    await page.goto(base + "/?v=nav-leccion#/lecciones/el-tablero");
    await page.waitFor(`!document.getElementById('pantalla-leccion').hidden`, { what: "lección" });
    const m = await page.eval(medidas);
    assert.ok(m.ancho <= m.ventana, `la página mide ${m.ancho} px en una ventana de ${m.ventana}`);
    const titulo = await page.eval(`document.querySelector('#pantalla-leccion .lecc-encabezado').getBoundingClientRect().top`);
    assert.ok(m.hb <= titulo + 0.5, `la cabecera acaba en ${m.hb} y el encabezado empieza en ${titulo}`);
  });

  // CAL-407: los botones no se cortan (su texto cabe en su caja) en la partida y en el repaso.
  const cortados = `[...document.querySelectorAll('button, a.boton')].filter((b) => b.checkVisibility() && b.getBoundingClientRect().width > 0 && b.scrollWidth > b.clientWidth + 0.5).map((b) => b.textContent.trim())`;
  for (const [width, height] of ESTRECHOS) {
    test(`${width}×${height}: ningún botón de la partida ni del repaso se corta`, async () => {
      await page.call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: true });
      await freshStart(page, `botones-${width}`);
      await page.eval(`document.querySelector('#ajustes [type=submit]').click()`);
      await page.waitFor(`!document.getElementById('pantalla-partida').hidden && document.getElementById('cargar-pgn').checkVisibility()`, { what: "partida" });
      assert.deepEqual(await page.eval(cortados), [], "botones cortados en la partida");
      await page.eval(`document.getElementById('cargar-pgn').click()`);
      await page.eval(`(() => { document.getElementById('pgn-campo').value = "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6"; document.getElementById('pgn-cargar').click(); })()`);
      await page.waitFor(`!document.getElementById('pantalla-repaso').hidden`, { what: "pantalla de repaso" });
      assert.deepEqual(await page.eval(cortados), [], "botones cortados en el repaso");
    });
  }

  test("el repaso cabe a 720×450, sin pisar su título", async () => {
    await page.call("Emulation.setDeviceMetricsOverride", { width: 720, height: 450, deviceScaleFactor: 1, mobile: true });
    await freshStart(page, "nav-repaso");
    await page.eval(`document.querySelector('#ajustes [type=submit]').click()`);
    await page.waitFor(`!document.getElementById('pantalla-partida').hidden && document.getElementById('cargar-pgn').checkVisibility()`, { what: "botón Cargar PGN a la vista" });
    await page.eval(`document.getElementById('cargar-pgn').click()`);
    await page.eval(`(() => { document.getElementById('pgn-campo').value = "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6"; document.getElementById('pgn-cargar').click(); })()`);
    await page.waitFor(`!document.getElementById('pantalla-repaso').hidden`, { what: "pantalla de repaso" });
    const m = await page.eval(medidas);
    assert.ok(m.ancho <= m.ventana, `la página mide ${m.ancho} px en una ventana de ${m.ventana}`);
    const titulo = await page.eval(`document.querySelector('.repaso__cab').getBoundingClientRect().top`);
    assert.ok(m.hb <= titulo + 0.5, `la cabecera acaba en ${m.hb} y el título del repaso empieza en ${titulo}`);
  });

  test("el inicio cabe a 720×450", async () => {
    await page.call("Emulation.setDeviceMetricsOverride", { width: 720, height: 450, deviceScaleFactor: 1, mobile: true });
    await freshStart(page, "nav-inicio");
    const m = await page.eval(medidas);
    assert.ok(m.ancho <= m.ventana, `la página mide ${m.ancho} px en una ventana de ${m.ventana}`);
    assert.ok(m.navR <= m.hr + 0.5, `la navegación acaba en ${m.navR} y la cabecera en ${m.hr}`);
  });
});
