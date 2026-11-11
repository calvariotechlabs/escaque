// Service worker de Escaque, escrito a mano y sin librerías.
//
// Es un script clásico (no un módulo ES): el navegador lo registra sin `type: "module"`.
// `tools/build-site.mjs` lo copia a la raíz del sitio y le antepone dos constantes:
//   __VERSION__   huella de todos los ficheros guardados; cambia con cualquier cambio.
//   __PRECACHE__  lista de ficheros que se guardan al instalar.
// Estrategia: se guarda todo al instalar y se responde primero desde la caché, así que la app
// abre al instante y sin conexión. Una versión nueva se instala aparte y queda a la espera:
// la página decide cuándo activarla (mensaje SKIP_WAITING), porque activarla recarga la partida.

declare const __VERSION__: string;
declare const __PRECACHE__: readonly string[];

(() => {
  interface WorkerEvent {
    waitUntil(promise: Promise<unknown>): void;
  }
  interface FetchWorkerEvent extends WorkerEvent {
    readonly request: Request;
    respondWith(response: Promise<Response> | Response): void;
  }
  interface MessageWorkerEvent {
    readonly data: unknown;
  }
  interface WorkerScope {
    readonly location: { readonly origin: string };
    readonly clients: { claim(): Promise<void> };
    skipWaiting(): Promise<void>;
    addEventListener(type: "install" | "activate", listener: (event: WorkerEvent) => void): void;
    addEventListener(type: "fetch", listener: (event: FetchWorkerEvent) => void): void;
    addEventListener(type: "message", listener: (event: MessageWorkerEvent) => void): void;
  }

  const scope = self as unknown as WorkerScope;
  const PREFIX = "escaque-";
  const CACHE = PREFIX + __VERSION__;

  async function precache(): Promise<void> {
    const cache = await caches.open(CACHE);
    await Promise.all(
      __PRECACHE__.map(async (url) => {
        // «reload»: salta la caché HTTP para no guardar una copia vieja de la versión nueva.
        const response = await fetch(new Request(url, { cache: "reload" }));
        if (!response.ok) throw new Error(`No se pudo guardar ${url} (${response.status})`);
        await cache.put(url, response);
      }),
    );
  }

  async function removeOldCaches(): Promise<void> {
    for (const name of await caches.keys()) {
      if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
    }
    await scope.clients.claim();
  }

  async function answer(request: Request): Promise<Response> {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit !== undefined) return hit;
    // Una navegación a una dirección que no guardamos abre la partida igualmente.
    if (request.mode === "navigate") {
      const home = await cache.match("./");
      if (home !== undefined) return home;
    }
    try {
      return await fetch(request);
    } catch {
      return Response.error();
    }
  }

  scope.addEventListener("install", (event) => event.waitUntil(precache()));
  scope.addEventListener("activate", (event) => event.waitUntil(removeOldCaches()));
  scope.addEventListener("fetch", (event) => {
    const { request } = event;
    if (request.method !== "GET") return;
    if (new URL(request.url).origin !== scope.location.origin) return;
    event.respondWith(answer(request));
  });
  scope.addEventListener("message", (event) => {
    const data = event.data;
    if (typeof data === "object" && data !== null && (data as { type?: unknown }).type === "SKIP_WAITING") {
      void scope.skipWaiting();
    }
  });
})();
