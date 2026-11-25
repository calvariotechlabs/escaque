// Prueba de extremo a extremo de la firma «by Calvario TechLabs» (B7): firma de la cabecera (solo desde 720×500), pie en todas las pantallas,
// pantalla «Acerca de» (#/acerca), enlaces externos seguros, aria-current, foco y pie dentro de la región con scroll en móvil apaisado. Chrome real.
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

const viewport = (page, width, height, mobile = true) => page.call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });

const firmaVisible = `(() => { const f = document.querySelector('.cab-izq .firma'); return getComputedStyle(f).display !== 'none' && f.getBoundingClientRect().width > 0; })()`;
const pie = `(() => {
  const f = document.getElementById('pie');
  const r = f.getBoundingClientRect();
  const a = [...f.querySelectorAll('a')].map((x) => ({ href: x.getAttribute('href'), target: x.target, rel: x.rel, h: x.getBoundingClientRect().height, texto: x.textContent.trim() }));
  return { visible: r.width > 0 && r.height > 0, texto: f.querySelector('.pie__legal').textContent, a, ancho: document.documentElement.scrollWidth, ventana: innerWidth, padre: f.parentElement.id || f.parentElement.tagName };
})()`;

describe("firma de Calvario TechLabs y «Acerca de» (B7)", () => {
  let page;
  before(async () => {
    page = await browser.newPage();
  });
  after(async () => {
    await page.goto("about:blank");
  });

  test("la cabecera lleva la firma solo desde 720×500, como texto (no enlace) junto al nombre", async () => {
    await viewport(page, 1280, 800, false);
    await freshStart(page, "firma-esc");
    assert.equal(await page.eval(firmaVisible), true);
    assert.equal(await page.eval(`document.querySelector('.cab-izq .firma').textContent.replace(/\\s+/g, ' ').trim()`), "by Calvario TechLabs");
    assert.equal(await page.eval(`document.querySelectorAll('.cab-izq a').length`), 0, "la firma de la cabecera no es un enlace");
    assert.equal(await page.eval(`document.querySelector('.cab-izq .firma [lang=en]').textContent`), "by");
    assert.equal(await page.eval(`document.querySelector('.cab-izq h1').textContent.trim()`), "Escaque", "el h1 sigue siendo solo «Escaque»");
    for (const [w, h, esperado] of [[720, 500, true], [719, 800, false], [1280, 499, false], [844, 390, false], [390, 844, false]]) {
      await viewport(page, w, h, w < 1000);
      assert.equal(await page.eval(firmaVisible), esperado, `${w}×${h}`);
    }
  });

  test("el pie está en ajustes, partida, lecciones y lección, con el enlace a Calvario TechLabs bien marcado", async () => {
    await viewport(page, 1280, 800, false);
    await freshStart(page, "firma-pie");
    const comprobar = async (donde) => {
      const p = await page.eval(pie);
      assert.ok(p.visible, `${donde}: el pie no se ve`);
      assert.equal(p.texto, "© 2026 Calvario TechLabs", donde);
      assert.ok(p.ancho <= p.ventana, `${donde}: la página se ensancha`);
      const firma = p.a.find((x) => x.href === "https://calvariotechlabs.com/");
      assert.ok(firma, `${donde}: falta el enlace a calvariotechlabs.com`);
      assert.equal(firma.target, "_blank");
      assert.match(firma.rel, /noopener/);
      assert.match(firma.rel, /noreferrer/);
      assert.match(firma.texto, /\(se abre en una pestaña nueva\)/);
      for (const x of p.a) assert.ok(x.h >= 44, `${donde}: el enlace «${x.texto}» mide ${x.h} px de alto`);
      assert.deepEqual(p.a.map((x) => x.href), ["https://calvariotechlabs.com/", "#/acerca"]);
    };
    assert.equal(await page.eval(`getComputedStyle(document.getElementById('pantalla-acerca')).display`), "none", "«Acerca de» no se ve fuera de su ruta");
    await comprobar("ajustes");
    await page.eval(`document.querySelector('#ajustes [type=submit]').click()`);
    await page.waitFor(`!document.getElementById('pantalla-partida').hidden`, { what: "partida" });
    await comprobar("partida");
    await page.goto(base + "/?v=firma-pie#/lecciones");
    await page.waitFor(`!document.getElementById('pantalla-lecciones').hidden`, { what: "lecciones" });
    await comprobar("lecciones");
    await page.goto(base + "/?v=firma-pie-leccion#/lecciones/el-tablero");
    await page.waitFor(`!document.getElementById('pantalla-leccion').hidden`, { what: "lección" });
    await comprobar("lección");
  });

  test("«Acerca de» se abre desde el pie, no marca ningún enlace de la cabecera, pone el título y el foco, y vuelve a jugar", async () => {
    await viewport(page, 1280, 800, false);
    await freshStart(page, "firma-acerca");
    await page.eval(`document.getElementById('enlace-acerca').click()`);
    await page.waitFor(`!document.getElementById('pantalla-acerca').hidden`, { what: "acerca" });
    assert.equal(await page.eval(`location.hash`), "#/acerca");
    assert.equal(await page.eval(`document.title`), "Acerca de · Escaque");
    assert.equal(await page.eval(`document.getElementById('pantalla-ajustes').hidden`), true);
    assert.equal(await page.eval(`document.querySelectorAll('.pagina__cabecera [aria-current]').length`), 0, "ni «Jugar» ni «Lecciones» están marcados");
    assert.equal(await page.eval(`document.getElementById('enlace-acerca').getAttribute('aria-current')`), "page");
    assert.equal(await page.eval(`document.querySelectorAll('main:not([hidden])').length`), 1, "una sola pantalla a la vez");
    assert.equal(await page.eval(`[...document.querySelectorAll('main')].filter((m) => getComputedStyle(m).display !== 'none').length`), 1, "y solo una se ve");
    assert.equal(await page.eval(`document.activeElement.id`), "titulo-acerca", "el foco pasa al título");
    assert.equal(await page.eval(`document.querySelectorAll('h1').length`), 1);
    const enlaces = await page.eval(`[...document.querySelectorAll('#pantalla-acerca a[target=_blank]')].map((a) => ({ href: a.href, rel: a.rel, oculto: !!a.querySelector('.oculto') }))`);
    assert.deepEqual(enlaces.map((e) => e.href), ["https://github.com/calvariotechlabs/escaque", "https://calvariotechlabs.com/"]);
    for (const e of enlaces) {
      assert.match(e.rel, /noopener/);
      assert.match(e.rel, /noreferrer/);
      assert.ok(e.oculto, "avisa de que se abre en una pestaña nueva");
    }
    await page.eval(`document.querySelector('#pantalla-acerca .acerca__acciones a').click()`);
    await page.waitFor(`!document.getElementById('pantalla-ajustes').hidden && document.getElementById('pantalla-acerca').hidden`, { what: "vuelta a jugar" });
    assert.equal(await page.eval(`document.getElementById('enlace-jugar').getAttribute('aria-current')`), "page");
    assert.equal(await page.eval(`document.getElementById('enlace-acerca').hasAttribute('aria-current')`), false);
  });

  test("«Acerca de» no se ensancha en móvil, tablet y apaisado", async () => {
    for (const [w, h] of [[390, 844], [768, 1024], [844, 390], [1280, 800]]) {
      await viewport(page, w, h, w < 1000);
      await page.goto(base + `/?v=firma-ancho-${w}#/acerca`);
      await page.waitFor(`!document.getElementById('pantalla-acerca').hidden`, { what: "acerca" });
      const m = await page.eval(`({ ancho: document.documentElement.scrollWidth, ventana: innerWidth })`);
      assert.ok(m.ancho <= m.ventana, `${w}×${h}: la página mide ${m.ancho} px en ${m.ventana}`);
    }
  });

  test("en móvil apaisado el pie va al final del panel con scroll y vuelve a la página al girar", async () => {
    await viewport(page, 844, 390);
    await freshStart(page, "firma-land");
    await page.eval(`document.querySelector('#ajustes [type=submit]').click()`);
    await page.waitFor(`!document.getElementById('pantalla-partida').hidden`, { what: "partida" });
    assert.equal((await page.eval(pie)).padre, "partida-panel");
    assert.equal(await page.eval(`document.getElementById('pie').classList.contains('pie--region')`), true);
    assert.equal((await page.eval(pie)).ancho <= 844, true);
    await viewport(page, 390, 844);
    await page.waitFor(`document.getElementById('pie').parentElement === document.body`, { what: "pie de vuelta en la página" });
    assert.equal(await page.eval(`document.getElementById('pie').classList.contains('pie--region')`), false);
    await page.eval(`document.getElementById('enlace-lecciones').click()`);
    await page.waitFor(`!document.getElementById('pantalla-lecciones').hidden`, { what: "lecciones" });
    assert.equal((await page.eval(pie)).padre, "BODY");
  });
});
