// Prueba de extremo a extremo de la pantalla de inicio (CAL-396): «Empezar partida» se ve sin desplazar la pantalla
// en escritorio, tablet vertical, móvil pequeño y móvil apaisado, con los avisos de principiante y de instalar
// presentes; y la descripción de cada opción sigue enlazada con su botón de opción. Chrome real (tools/cdp.mjs).
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


const offerInstall = (page) =>
  page.eval(`(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = () => Promise.resolve(); e.userChoice = Promise.resolve({ outcome: 'dismissed' }); window.dispatchEvent(e); })()`);

const VIEWPORTS = [
  ["escritorio 1280×720", 1280, 720, false],
  ["tablet vertical 820×1180", 820, 1180, true],
  ["móvil pequeño 390×664", 390, 664, true],
  ["móvil apaisado 844×390", 844, 390, false],
  ["móvil estrecho 320×568", 320, 568, true],
  ["móvil ancho 580×700 (justo bajo 600 px)", 580, 700, true],
  ["móvil ancho y bajo 580×500", 580, 500, true],
  ["móvil apaisado grande 932×430", 932, 430, false],
  ["móvil apaisado bajo 640×360", 640, 360, false],
  ["ventana baja 600×501", 600, 501, false],
  ["ventana baja 1024×560", 1024, 560, false],
];

describe("pantalla de inicio compacta", () => {
  let page;
  before(async () => {
    page = await browser.newPage();
  });

  for (const [name, width, height, mobile] of VIEWPORTS) {
    test(`«Empezar partida» se ve sin desplazar: ${name}`, async () => {
      await page.call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
      await page.goto(base + "/?limpiar#/jugar");
      await page.eval(`localStorage.clear()`);
      await page.goto(base + `/?v=${width}x${height}#/jugar`);
      await page.waitFor(`!document.getElementById('pantalla-ajustes').hidden`, { what: "pantalla de ajustes" });
      await offerInstall(page);
      await page.waitFor(`document.querySelector('#aviso-instalar .aviso')`, { what: "aviso de instalar" });
      assert.equal(await page.eval(`document.getElementById('aviso-novato').hidden`), false, "el aviso de principiante está presente");
      const box = await page.eval(`(() => { const r = document.querySelector('#ajustes [type=submit]').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, scrollY: window.scrollY, h: window.innerHeight, w: r.width }; })()`);
      assert.equal(box.scrollY, 0);
      assert.ok(box.top >= 0 && box.bottom <= box.h, `el botón (${Math.round(box.top)}–${Math.round(box.bottom)}) cabe en ${box.h} px de alto`);
      assert.ok(box.w > 0);
      // Ningún nombre de opción se sale de su tarjeta (con 320 px caben tres columnas justas).
      assert.equal(await page.eval(`[...document.querySelectorAll('#ajustes .opcion__tarjeta')].every((t) => { const n = t.querySelector('.opcion__nombre'); const a = t.getBoundingClientRect(); const b = n.getBoundingClientRect(); return b.left >= a.left - 0.5 && b.right <= a.right + 0.5 && n.scrollWidth <= n.clientWidth + 1; })`), true, "los nombres caben en sus tarjetas");
      assert.equal(await page.eval(`document.documentElement.scrollWidth <= window.innerWidth`), true, "sin desplazamiento horizontal");
    });
  }

  test("el botón sigue a la vista tras bajar hasta el final de la página (barra pegada)", async () => {
    await page.call("Emulation.setDeviceMetricsOverride", { width: 390, height: 664, deviceScaleFactor: 1, mobile: true });
    await page.eval(`window.scrollTo(0, document.body.scrollHeight)`);
    const box = await page.eval(`(() => { const r = document.querySelector('#ajustes [type=submit]').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: window.innerHeight }; })()`);
    assert.ok(box.top >= 0 && box.bottom <= box.h, "el botón no sale de la pantalla");
  });

  test("580×900: sin barra flotando (fondo y línea solo cuando está pegada); 390×500: pegada abajo con su línea", async () => {
    const sep = `getComputedStyle(document.querySelector('.ajustes__acciones'), '::before').opacity`;
    await page.call("Emulation.setDeviceMetricsOverride", { width: 580, height: 900, deviceScaleFactor: 1, mobile: true });
    await page.goto(base + "/?v=580x900b#/jugar");
    if (!(await page.eval(`CSS.supports('container-type', 'scroll-state')`))) return; // sin consultas de estado de desplazamiento la barra se ve siempre (alternativa a propósito)
    await page.waitFor(`!document.getElementById('pantalla-ajustes').hidden`, { what: "pantalla de ajustes" });
    assert.equal(await page.eval(sep), "0", "en reposo la barra no pinta fondo ni línea");
    await page.call("Emulation.setDeviceMetricsOverride", { width: 390, height: 500, deviceScaleFactor: 1, mobile: true });
    await page.goto(base + "/?v=390x500#/jugar");
    await page.waitFor(`!document.getElementById('pantalla-ajustes').hidden`, { what: "pantalla de ajustes" });
    await page.waitFor(`${sep} === '1'`, { what: "línea de la barra pegada" });
    const r = await page.eval(`(() => { const b = document.querySelector('#ajustes [type=submit]').getBoundingClientRect(); return { bottom: b.bottom, h: window.innerHeight }; })()`);
    assert.ok(r.bottom <= r.h && r.h - r.bottom < 24, `el botón queda pegado abajo (${Math.round(r.bottom)} de ${r.h})`);
  });

  test("cada opción enlaza su descripción y solo se ve la de la elegida", async () => {
    await page.call("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    const info = await page.eval(`[...document.querySelectorAll('#ajustes input[type=radio]')].map((i) => { const d = document.getElementById(i.getAttribute('aria-describedby')); return { id: i.id, ok: Boolean(d && d.textContent.trim()), visible: d ? d.getBoundingClientRect().width > 2 : false, checked: i.checked }; })`);
    assert.equal(info.length, 8);
    for (const o of info) {
      assert.equal(o.ok, true, `${o.id} tiene descripción enlazada`);
      assert.equal(o.visible, o.checked, `${o.id}: solo se ve la descripción de la opción elegida`);
    }
    await page.eval(`document.getElementById('nivel-dificil').click()`);
    assert.equal(await page.eval(`document.getElementById('nivel-dificil-d').getBoundingClientRect().width > 2`), true);
    assert.equal(await page.eval(`document.getElementById('nivel-medio-d').getBoundingClientRect().width > 2`), false);
  });

  test("con el teclado: las flechas cambian de opción dentro del grupo y Tab pasa al siguiente", async () => {
    await page.eval(`document.getElementById('nivel-facil').click(); document.getElementById('nivel-facil').focus()`);
    assert.equal(await page.eval(`document.getElementById('nivel-facil').checked`), true);
    await page.press("ArrowRight");
    assert.equal(await page.eval(`document.activeElement.id`), "nivel-medio");
    await page.press("ArrowRight");
    assert.equal(await page.eval(`document.activeElement.id`), "nivel-dificil");
    assert.equal(await page.eval(`document.getElementById('nivel-dificil').checked`), true);
  });
});
