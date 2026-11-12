// Parte de la app instalable que vive en la página: registra el service worker, escucha
// instalación, conexión y versiones nuevas, y pinta un único aviso (ver notices.ts).
// Todo el texto va con textContent: nunca se construye HTML.
import { INITIAL_STATE, iosInstallDevice, pickNotice, type NoticeAction, type NoticeKind, type PwaState } from "./notices.js";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ readonly outcome: "accepted" | "dismissed" }>;
}

const INSTALL_DISMISSED_KEY = "escaque.instalar.descartado";

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false; // almacenamiento bloqueado: el aviso vuelve a salir, sin romper nada
  }
}

function writeFlag(key: string): void {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // sin almacenamiento, el descarte dura lo que dure la página
  }
}

function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches;
}

/** Arranca la parte instalable. `container` es la región viva donde se pinta el aviso. */
export function startPwa(container: HTMLElement): void {
  let state: PwaState = {
    ...INITIAL_STATE,
    offline: !navigator.onLine,
    standalone: isStandalone(),
    iosDevice: iosInstallDevice(navigator.userAgent, navigator.maxTouchPoints, isStandalone()),
    installDismissed: readFlag(INSTALL_DISMISSED_KEY),
  };
  let installEvent: InstallPromptEvent | null = null;
  let registration: ServiceWorkerRegistration | null = null;

  function update(change: Partial<PwaState>): void {
    state = { ...state, ...change };
    render();
  }

  function focusBoard(): void {
    document.querySelector<HTMLElement>("[data-square][tabindex='0']")?.focus();
  }

  function act(action: NoticeAction, kind: NoticeKind): void {
    switch (action) {
      case "actualizar":
        if (registration?.waiting != null) registration.waiting.postMessage({ type: "SKIP_WAITING" });
        else window.location.reload(); // ya no hay versión a la espera: recargar toma la vigente
        break;
      case "mas-tarde":
        update({ updateDismissed: true });
        break;
      case "entendido":
        if (kind === "sin-conexion") update({ offlineDismissed: true });
        else {
          writeFlag(INSTALL_DISMISSED_KEY);
          update({ installDismissed: true });
        }
        break;
      case "ahora-no":
        writeFlag(INSTALL_DISMISSED_KEY);
        update({ installDismissed: true });
        break;
      case "instalar": {
        const event = installEvent;
        installEvent = null;
        update({ canInstall: false });
        if (event !== null) void event.prompt();
        break;
      }
    }
    focusBoard();
  }

  function render(): void {
    container.replaceChildren();
    const notice = pickNotice(state);
    if (notice === null) return;
    const box = document.createElement("div");
    box.className = `aviso aviso--${notice.kind === "instalar-ios" ? "instalar" : notice.kind}`;
    const title = document.createElement("p");
    title.className = "aviso__titulo";
    title.textContent = notice.title;
    const text = document.createElement("p");
    text.className = "aviso__texto";
    text.textContent = notice.text;
    const actions = document.createElement("div");
    actions.className = "aviso__acciones";
    for (const spec of notice.buttons) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = spec.primary ? "boton boton--principal" : "boton";
      button.textContent = spec.label;
      button.addEventListener("click", () => act(spec.action, notice.kind));
      actions.append(button);
    }
    box.append(title, text, actions);
    container.append(box);
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installEvent = event as InstallPromptEvent;
    update({ canInstall: true });
  });
  window.addEventListener("appinstalled", () => {
    installEvent = null;
    update({ canInstall: false, standalone: true });
  });
  window.addEventListener("offline", () => update({ offline: true, offlineDismissed: false }));
  window.addEventListener("online", () => update({ offline: false }));

  render();

  if (!("serviceWorker" in navigator)) return;
  const workers = navigator.serviceWorker;
  // Solo se recarga al cambiar de versión, no la primera vez que el worker toma el control.
  let hadController = workers.controller !== null;
  let reloading = false;
  workers.addEventListener("controllerchange", () => {
    if (!hadController) {
      hadController = true; // primera toma de control: las siguientes sí recargan
      return;
    }
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
  window.addEventListener("load", () => {
    workers
      .register("./sw.js")
      .then((reg) => {
        registration = reg;
        if (reg.waiting !== null && workers.controller !== null) update({ updateReady: true });
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          installing?.addEventListener("statechange", () => {
            // Con `controller` nulo es la primera instalación: no hay nada que actualizar.
            if (installing.state === "installed" && workers.controller !== null) {
              update({ updateReady: true, updateDismissed: false });
            }
          });
        });
        // Una app instalada puede llevar días abierta: se busca versión nueva al volver a verla.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") void reg.update().catch(() => undefined);
        });
      })
      .catch(() => {
        // Sin service worker la web sigue funcionando; solo se pierde el modo sin conexión.
      });
  });
}
