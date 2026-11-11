// Prueba el service worker compilado en un entorno simulado: instala, guarda, responde desde la
// caché, limpia versiones viejas y solo salta la espera cuando la página lo pide.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const source = readFileSync(resolve(fileURLToPath(new URL("..", import.meta.url)), "dist/src/pwa/sw.js"), "utf8");

class FakeResponse {
  constructor(body, ok = true) { this.body = body; this.ok = ok; this.status = ok ? 200 : 404; }
  static error() { const r = new FakeResponse("error", false); r.status = 0; r.type = "error"; return r; }
}

function setup({ version = "v1", precache = ["./", "./index.html", "./app.js"], network = {}, caches: stored = {} } = {}) {
  const listeners = {};
  const stores = new Map(Object.entries(stored).map(([name, files]) => [name, new Map(Object.entries(files))]));
  const log = { skipWaiting: 0, claim: 0, fetched: [] };
  // Como el navegador: las claves son direcciones absolutas respecto al worker.
  const norm = (url) => new URL(typeof url === "string" ? url : url.url, "https://escaque.test/").href;
  const fakeCaches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async put(url, response) { store.set(norm(url), response); },
        async match(request, options) {
          const key = new URL(norm(request));
          if (options?.ignoreSearch) key.search = "";
          return store.get(key.href);
        },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  const scope = {
    location: { origin: "https://escaque.test" },
    clients: { claim: async () => { log.claim++; } },
    skipWaiting: async () => { log.skipWaiting++; },
    addEventListener(type, listener) { listeners[type] = listener; },
  };
  const context = {
    self: scope,
    caches: fakeCaches,
    Request: class { constructor(url, init) { this.url = url; this.init = init; } },
    Response: FakeResponse,
    URL,
    fetch: async (request) => {
      const url = typeof request === "string" ? request : request.url;
      log.fetched.push(url);
      if (!(url in network)) throw new Error("sin red");
      return new FakeResponse(network[url]);
    },
  };
  vm.runInNewContext(`const __VERSION__ = ${JSON.stringify(version)}; const __PRECACHE__ = ${JSON.stringify(precache)};\n${source}`, context);
  const wait = async (type, event = {}) => {
    let pending = Promise.resolve();
    listeners[type]({ ...event, waitUntil: (p) => { pending = p; } });
    await pending;
  };
  const fetchEvent = async (request) => {
    let answered;
    listeners.fetch({ request, respondWith: (r) => { answered = r; } });
    return answered === undefined ? undefined : await answered;
  };
  return { listeners, stores, log, wait, fetchEvent };
}

const files = { "./": "inicio", "./index.html": "inicio", "./app.js": "js" };

test("al instalar guarda todo en una caché con la versión y sin usar la caché HTTP", async () => {
  const sw = setup({ network: files });
  await sw.wait("install");
  assert.deepEqual([...sw.stores.keys()], ["escaque-v1"]);
  assert.deepEqual([...sw.stores.get("escaque-v1").keys()].sort(), ["https://escaque.test/", "https://escaque.test/app.js", "https://escaque.test/index.html"]);
  assert.equal(sw.log.skipWaiting, 0, "no se activa sola: la página decide");
});

test("si un fichero falla, la instalación falla y no queda una versión a medias activa", async () => {
  const sw = setup({ network: { "./": "inicio", "./index.html": "inicio" } });
  await assert.rejects(sw.wait("install"));
});

test("al activar borra las cachés viejas de Escaque y respeta las ajenas", async () => {
  const sw = setup({ version: "v2", caches: { "escaque-v1": {}, "escaque-v2": {}, "otra-app": {} } });
  await sw.wait("activate");
  assert.deepEqual([...sw.stores.keys()].sort(), ["escaque-v2", "otra-app"]);
  assert.equal(sw.log.claim, 1);
});

test("responde desde la caché sin tocar la red", async () => {
  const sw = setup({ network: files });
  await sw.wait("install");
  sw.log.fetched.length = 0;
  const res = await sw.fetchEvent({ method: "GET", url: "https://escaque.test/app.js?x=1", mode: "no-cors" });
  assert.equal(res.body, "js");
  assert.deepEqual(sw.log.fetched, []);
});

test("una navegación a una dirección desconocida abre la partida, también sin conexión", async () => {
  const sw = setup({ network: files });
  await sw.wait("install");
  const res = await sw.fetchEvent({ method: "GET", url: "https://escaque.test/lo-que-sea", mode: "navigate" });
  assert.equal(res.body, "inicio");
});

test("lo que no está guardado y no hay red da error de red, sin romper", async () => {
  const sw = setup({ network: files });
  await sw.wait("install");
  const res = await sw.fetchEvent({ method: "GET", url: "https://escaque.test/otro.png", mode: "no-cors" });
  assert.equal(res.ok, false);
});

test("no toca peticiones que no son GET ni de otro origen", async () => {
  const sw = setup({ network: files });
  await sw.wait("install");
  assert.equal(await sw.fetchEvent({ method: "POST", url: "https://escaque.test/app.js", mode: "cors" }), undefined);
  assert.equal(await sw.fetchEvent({ method: "GET", url: "https://otro.test/app.js", mode: "cors" }), undefined);
});

test("solo salta la espera si la página lo pide con SKIP_WAITING", async () => {
  const sw = setup();
  sw.listeners.message({ data: { type: "otra-cosa" } });
  sw.listeners.message({ data: null });
  sw.listeners.message({ data: "SKIP_WAITING" });
  assert.equal(sw.log.skipWaiting, 0);
  sw.listeners.message({ data: { type: "SKIP_WAITING" } });
  assert.equal(sw.log.skipWaiting, 1);
});
