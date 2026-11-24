// Prueba de extremo a extremo del cierre de la revisión visual 2 (CAL-404): la navegación de la cabecera queda siempre a la
// derecha, el aviso del inicio mide lo mismo que el tablero de muestra y «Resumen por bando» lleva el escaque. Chrome real (tools/cdp.mjs).
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



const PGN = "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6";
// Hueco entre el final de la navegación y el borde derecho del contenido de la cabecera: 0 si va pegada a la derecha.
// (No se mide contra la ventana: en una página larga la barra de desplazamiento recentra la cabecera 7,5 px.)
const navRight = `(() => { const h = document.querySelector('.pagina__cabecera'); const r = h.getBoundingClientRect().right - parseFloat(getComputedStyle(h).paddingRight); return Math.round(r - document.querySelector('.pagina__cabecera .lecc-nav').getBoundingClientRect().right); })()`;

/** Inicio limpio: sin partida guardada, «#/jugar» abre los ajustes. */
async function freshStart(page, tag) {
  await page.goto(base + `/?v=${tag}#/jugar`);
  await page.eval(`localStorage.clear()`);
  await page.goto(base + `/?v=${tag}-limpio#/jugar`);
  await page.waitFor(`!document.getElementById('pantalla-ajustes').hidden`, { what: "ajustes" });
}

describe("cierre de la revisión visual 2", () => {
  let page;
  before(async () => {
    page = await browser.newPage();
  });

  after(async () => {
    await page.goto("about:blank"); // corta el análisis del repaso antes de cerrar Chrome
  });

  for (const [nombre, width, height, mobile] of [["escritorio", 1440, 900, false], ["tablet", 820, 1180, true], ["móvil", 390, 844, true], ["móvil estrecho", 320, 568, true]]) {
    test(`${nombre}: la navegación está en el mismo sitio en el inicio y en la partida, y el subtítulo va debajo`, async () => {
      await page.call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
      await freshStart(page, `cab-${width}`);
      const inicio = await page.eval(navRight);
      await page.eval(`document.querySelector('#ajustes [type=submit]').click()`);
      await page.waitFor(`!document.getElementById('pantalla-partida').hidden`, { what: "partida" });
      const partida = await page.eval(navRight);
      assert.ok(inicio === 0 && partida === 0, `${nombre}: la navegación acaba a ${inicio} px y a ${partida} px del borde`);
      const pos = await page.eval(`({ sub: document.getElementById('cabecera-sub').getBoundingClientRect().top, nav: document.querySelector('.pagina__cabecera .lecc-nav').getBoundingClientRect().bottom, h1: document.querySelector('.pagina__cabecera h1').getBoundingClientRect().left, subLeft: document.getElementById('cabecera-sub').getBoundingClientRect().left })`);
      assert.ok(pos.sub >= pos.nav - 1, `el subtítulo va en la línea de debajo: ${JSON.stringify(pos)}`);
      assert.ok(Math.abs(pos.h1 - pos.subLeft) < 1, `el subtítulo se alinea con el nombre: ${JSON.stringify(pos)}`);
    });
  }

  test("inicio en escritorio: el aviso de principiante mide lo mismo que el tablero de muestra", async () => {
    for (const [width, height] of [[1440, 900], [1280, 720], [1024, 768]]) {
      await page.call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
      await freshStart(page, `aviso-${width}`);
      await page.eval(`(() => { const a = document.getElementById('aviso-novato'); a.hidden = false; })()`);
      const box = await page.eval(`(() => { const v = document.querySelector('.ajustes-pantalla__vista').getBoundingClientRect(); const a = document.getElementById('aviso-novato').getBoundingClientRect(); return { vl: v.left, vr: v.right, al: a.left, ar: a.right }; })()`);
      assert.ok(Math.abs(box.vl - box.al) < 1 && Math.abs(box.vr - box.ar) < 1, `${width}×${height}: mismos bordes ${JSON.stringify(box)}`);
    }
  });

  test("repaso: «Resumen por bando» lleva el escaque y la tinta de marca, y sigue siendo el título de la tabla", async () => {
    await page.call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await freshStart(page, "resumen");
    await page.eval(`document.querySelector('#ajustes [type=submit]').click()`);
    await page.waitFor(`!document.getElementById('pantalla-partida').hidden && document.getElementById('cargar-pgn').checkVisibility()`, { what: "botón Cargar PGN a la vista" });
    await page.eval(`document.getElementById('cargar-pgn').click()`);
    await page.eval(`(() => { document.getElementById('pgn-campo').value = ${JSON.stringify(PGN)}; document.getElementById('pgn-cargar').click(); })()`);
    await page.waitFor(`!document.getElementById('pantalla-repaso').hidden`, { what: "pantalla de repaso" });
    const caption = await page.eval(`(() => { const c = document.querySelector('.resumen caption'); const b = getComputedStyle(c, '::before'); const marca = getComputedStyle(document.documentElement).getPropertyValue('--marca').trim(); const probe = document.createElement('span'); probe.style.color = marca; document.body.append(probe); const marcaRgb = getComputedStyle(probe).color; probe.remove(); return { display: getComputedStyle(c).display, color: getComputedStyle(c).color, marcaRgb, before: b.content, ancho: b.width }; })()`);
    assert.equal(caption.display, "table-caption");
    assert.equal(caption.before, '""');
    assert.equal(caption.ancho, "10px");
    assert.equal(caption.color, caption.marcaRgb);
  });
});
