// Qué aviso de la app instalable se muestra y con qué texto. Lógica pura, sin DOM:
// se prueba en Node. Los textos son los del componente «Notice» del Design System.

export type IosDevice = "iphone" | "ipad";

export type NoticeKind = "nueva" | "sin-conexion" | "instalar" | "instalar-ios";
export type NoticeAction = "actualizar" | "mas-tarde" | "entendido" | "instalar" | "ahora-no";

export interface PwaState {
  /** Hay una versión nueva descargada y a la espera. */
  readonly updateReady: boolean;
  readonly updateDismissed: boolean;
  readonly offline: boolean;
  readonly offlineDismissed: boolean;
  /** El navegador ofreció instalar (evento beforeinstallprompt). */
  readonly canInstall: boolean;
  /** iPhone o iPad en Safari, sin botón de instalar: hay que explicar el gesto. Null en cualquier otro caso. */
  readonly iosDevice: IosDevice | null;
  readonly installDismissed: boolean;
  /** Ya se ejecuta como app instalada. */
  readonly standalone: boolean;
}

export interface NoticeButton {
  readonly action: NoticeAction;
  readonly label: string;
  readonly primary: boolean;
}

export interface Notice {
  readonly kind: NoticeKind;
  readonly title: string;
  readonly text: string;
  readonly buttons: readonly NoticeButton[];
}

export const INITIAL_STATE: PwaState = {
  updateReady: false,
  updateDismissed: false,
  offline: false,
  offlineDismissed: false,
  canInstall: false,
  iosDevice: null,
  installDismissed: false,
  standalone: false,
};

const NOTICES: Readonly<Record<NoticeKind, Notice>> = {
  nueva: {
    kind: "nueva",
    title: "Hay una versión nueva.",
    text: "Al actualizar se reinicia la partida en curso.",
    buttons: [
      { action: "actualizar", label: "Actualizar ahora", primary: true },
      { action: "mas-tarde", label: "Más tarde", primary: false },
    ],
  },
  "sin-conexion": {
    kind: "sin-conexion",
    title: "Sin conexión.",
    text: "Puedes seguir jugando: Escaque funciona sin internet.",
    buttons: [{ action: "entendido", label: "Entendido", primary: false }],
  },
  instalar: {
    kind: "instalar",
    title: "Instala Escaque.",
    text: "Ábrelo desde tu pantalla de inicio, a pantalla completa y sin conexión.",
    buttons: [
      { action: "instalar", label: "Instalar", primary: true },
      { action: "ahora-no", label: "Ahora no", primary: false },
    ],
  },
  "instalar-ios": iosNotice("iPhone"),
};

/** El aviso de iOS nombra el aparato, para que en un iPad no hable de «tu iPhone». */
function iosNotice(deviceName: "iPhone" | "iPad"): Notice {
  return {
    kind: "instalar-ios",
    title: `Instala Escaque en tu ${deviceName}.`,
    text: "Toca Compartir y elige «Añadir a pantalla de inicio».",
    buttons: [{ action: "entendido", label: "Entendido", primary: false }],
  };
}

/** El aviso más urgente, o null. Solo se muestra uno a la vez: nueva versión, sin conexión, instalar. */
export function pickNotice(state: PwaState): Notice | null {
  if (state.updateReady && !state.updateDismissed) return NOTICES.nueva;
  if (state.offline && !state.offlineDismissed) return NOTICES["sin-conexion"];
  if (state.standalone || state.installDismissed) return null;
  if (state.canInstall) return NOTICES.instalar;
  if (state.iosDevice) return iosNotice(state.iosDevice === "ipad" ? "iPad" : "iPhone");
  return null;
}

/** Navegadores de iOS que no son Safari: el gesto de «Añadir a pantalla de inicio» no es el mismo. */
const NOT_SAFARI = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|DuckDuckGo|GSA\/|FBAN|FBAV|Instagram/;

/**
 * ¿Hay que explicar el gesto de instalar en iOS, y en qué aparato? Solo en Safari (en otros navegadores
 * de iOS el gesto cambia) y si no está ya en modo app. iPadOS se anuncia como Macintosh pero con pantalla táctil.
 */
export function iosInstallDevice(userAgent: string, maxTouchPoints: number, standalone: boolean): IosDevice | null {
  if (standalone || NOT_SAFARI.test(userAgent) || !/Safari\//.test(userAgent)) return null;
  if (/iPhone|iPod/.test(userAgent)) return "iphone";
  if (/iPad/.test(userAgent)) return "ipad";
  if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) return "ipad";
  return null;
}
