// Cliente mínimo del protocolo de Chrome (CDP) para pruebas de extremo a extremo, sin dependencias.
// Usa solo lo que trae Node 22 (WebSocket global, fetch, child_process) y el Chrome ya instalado.
// Teclado real: las teclas entran por Input.dispatchKeyEvent, como si las pulsara una persona.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Primer Chrome que exista: variable CHROME_PATH, o los nombres habituales (en Ubuntu de GitHub: google-chrome). */
export function chromeBinary() {
  return process.env.CHROME_PATH ?? "google-chrome";
}

const KEYS = {
  Tab: { code: "Tab", vk: 9 },
  Enter: { code: "Enter", vk: 13, text: "\r" },
  " ": { code: "Space", vk: 32, text: " " },
  Escape: { code: "Escape", vk: 27 },
  ArrowLeft: { code: "ArrowLeft", vk: 37 },
  ArrowUp: { code: "ArrowUp", vk: 38 },
  ArrowRight: { code: "ArrowRight", vk: 39 },
  ArrowDown: { code: "ArrowDown", vk: 40 },
  Home: { code: "Home", vk: 36 },
  End: { code: "End", vk: 35 },
};

/** Lanza Chrome sin interfaz y devuelve el navegador. `close()` lo cierra y borra su perfil temporal. */
export async function launchBrowser({ width = 1280, height = 800 } = {}) {
  const profile = mkdtempSync(join(tmpdir(), "escaque-e2e-"));
  const child = spawn(
    chromeBinary(),
    ["--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run", "--remote-debugging-port=0", `--user-data-dir=${profile}`, `--window-size=${width},${height}`, "about:blank"],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  const wsUrl = await new Promise((resolve, reject) => {
    let log = "";
    const timer = setTimeout(() => reject(new Error(`Chrome no arrancó a tiempo:\n${log}`)), 20000);
    child.stderr.on("data", (chunk) => {
      log += chunk;
      const m = /DevTools listening on (ws:\/\/\S+)/.exec(log);
      if (m) {
        clearTimeout(timer);
        resolve(m[1]);
      }
    });
    child.on("exit", (code) => reject(new Error(`Chrome salió con código ${code}:\n${log}`)));
  });

  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", () => reject(new Error("No se pudo conectar con Chrome")), { once: true });
  });
  let nextId = 1;
  const pending = new Map();
  const listeners = new Set();
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(String(event.data));
    if (msg.id !== undefined) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (p) msg.error ? p.reject(new Error(`${p.method}: ${msg.error.message}`)) : p.resolve(msg.result);
    } else for (const l of listeners) l(msg);
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject, method });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });

  async function newPage() {
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const call = (method, params) => send(method, params, sessionId);
    const errors = [];
    listeners.add((msg) => {
      if (msg.sessionId !== sessionId) return;
      if (msg.method === "Runtime.exceptionThrown") errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
      if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") errors.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
    });
    await call("Page.enable");
    await call("Runtime.enable");
    await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });

    const page = {
      errors,
      call,
      async goto(url) {
        const loaded = new Promise((resolve) => {
          const l = (msg) => {
            if (msg.sessionId === sessionId && msg.method === "Page.loadEventFired") {
              listeners.delete(l);
              resolve();
            }
          };
          listeners.add(l);
        });
        await call("Page.navigate", { url });
        await loaded;
      },
      /** Evalúa una expresión en la página y devuelve su valor (admite promesas). */
      async eval(expression) {
        const r = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
        return r.result.value;
      },
      /** Pulsa y suelta una tecla con el teclado real del navegador. */
      async press(key) {
        const k = KEYS[key];
        if (!k) throw new Error(`Tecla sin definir: ${key}`);
        const base = { key, code: k.code, windowsVirtualKeyCode: k.vk, nativeVirtualKeyCode: k.vk };
        await call("Input.dispatchKeyEvent", { type: k.text ? "keyDown" : "rawKeyDown", ...base, text: k.text });
        await call("Input.dispatchKeyEvent", { type: "keyUp", ...base });
      },
      /** Espera a que la condición (expresión JS) sea verdadera. */
      async waitFor(expression, { timeout = 15000, what = expression } = {}) {
        const end = Date.now() + timeout;
        for (;;) {
          if (await page.eval(`Boolean(${expression})`)) return;
          if (Date.now() > end) throw new Error(`Tiempo agotado esperando: ${what}`);
          await new Promise((r) => setTimeout(r, 50));
        }
      },
    };
    return page;
  }

  return {
    newPage,
    async close() {
      try {
        ws.close();
      } catch {}
      child.kill("SIGKILL");
      child.stderr.destroy(); // los procesos hijos de Chrome heredan la tubería: sin esto un `| grep` no termina
      rmSync(profile, { recursive: true, force: true });
    },
  };
}
