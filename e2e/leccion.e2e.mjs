// Prueba de extremo a extremo de la lección «El tablero» (CAL-403, revisión visual 2): el tablero entero, con la fila 1
// y las letras a-h, se ve sin desplazar la pantalla en escritorio, tablet y móvil; el objetivo está a la vista con él
// y «Cómo se mueve» sigue en la página. Chrome real (tools/cdp.mjs).
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { launchBrowser } from "../tools/cdp.mjs";

let server;
let browser;
let base;

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
    server?.kill();
  }
});

const VIEWPORTS = [
  ["escritorio 1280×720", 1280, 720, false],
  ["escritorio 1440×900", 1440, 900, false],
  ["tablet horizontal 1180×820", 1180, 820, false],
  ["tablet vertical 820×1180", 820, 1180, true],
  ["móvil 390×664", 390, 664, true],
  ["móvil estrecho 360×640", 360, 640, true],
];

describe("lección «El tablero»", () => {
  let page;
  before(async () => {
    page = await browser.newPage();
  });

  for (const [name, width, height, mobile] of VIEWPORTS) {
    test(`se ven el objetivo y el tablero entero sin desplazar: ${name}`, async () => {
      await page.call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
      await page.goto(base + "/?limpiar#/jugar");
      await page.eval(`localStorage.clear()`);
      await page.goto(base + `/?leccion=${width}x${height}#/lecciones/el-tablero`);
      await page.waitFor(`!document.getElementById('pantalla-leccion').hidden && document.querySelector('#leccion-tablero .tablero__columnas')`, { what: "la lección" });
      const m = await page.eval(`(() => {
        const r = (s) => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right }; };
        return { scrollY: window.scrollY, h: window.innerHeight, w: window.innerWidth, columnas: r('#leccion-tablero .tablero__columnas'), objetivo: r('.objetivo'), tablero: r('#leccion-tablero .tablero__rejilla'), como: r('#leccion-como'), turno: document.getElementById('leccion-estado-texto').textContent, turnoEnObjetivo: Boolean(document.querySelector('.objetivo #leccion-estado-texto')), scrollW: document.documentElement.scrollWidth };
      })()`);
      assert.equal(m.scrollY, 0);
      assert.ok(m.columnas.bottom <= m.h, `las letras a-h (hasta ${Math.round(m.columnas.bottom)}) caben en ${m.h} px de alto`);
      assert.ok(m.objetivo.top >= 0 && m.objetivo.bottom <= m.h, "el objetivo se ve sin desplazar");
      assert.equal(m.turnoEnObjetivo, true, "el turno va dentro de la tarjeta del objetivo");
      assert.match(m.turno, /blancas/i);
      assert.ok(m.tablero.right - m.tablero.left >= 280, `el tablero mide al menos 280 px (${Math.round(m.tablero.right - m.tablero.left)})`);
      assert.ok(m.como.bottom > m.como.top, "«Cómo se mueve» sigue visible en la página");
      assert.ok(m.scrollW <= m.w, "sin desplazamiento horizontal");
      if (width >= 860) assert.ok(m.objetivo.left >= m.tablero.right, "en pantallas anchas el objetivo va a la derecha del tablero");
      else assert.ok(m.objetivo.bottom <= m.tablero.top + 1, "en pantallas estrechas el objetivo va sobre el tablero");
    });
  }

  test("en escritorio el tablero se queda a la vista al bajar por la columna derecha", async () => {
    await page.call("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await page.eval(`window.scrollTo(0, document.body.scrollHeight)`);
    const b = await page.eval(`(() => { const t = document.querySelector('#leccion-tablero .tablero__rejilla').getBoundingClientRect(); return { top: t.top, bottom: t.bottom, h: window.innerHeight, scrollable: document.documentElement.scrollHeight > window.innerHeight }; })()`);
    if (b.scrollable) assert.ok(b.top >= 0 && b.bottom <= b.h, "el tablero sigue entero en pantalla");
  });
});
