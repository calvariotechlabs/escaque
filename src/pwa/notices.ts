// Qué aviso de la app instalable se muestra y con qué texto. Lógica pura, sin DOM:
// se prueba en Node. Los textos son los del componente «Notice» del Design System.

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
  /** iPhone o iPad en Safari, sin botón de instalar: hay que explicar el gesto. */
  readonly iosHint: boolean;
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
  iosHint: false,
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
  "instalar-ios": {
    kind: "instalar-ios",
    title: "Instala Escaque en tu iPhone.",
    text: "Toca Compartir y elige «Añadir a pantalla de inicio».",
    buttons: [{ action: "entendido", label: "Entendido", primary: false }],
  },
};

/** El aviso más urgente, o null. Solo se muestra uno a la vez: nueva versión, sin conexión, instalar. */
export function pickNotice(state: PwaState): Notice | null {
  if (state.updateReady && !state.updateDismissed) return NOTICES.nueva;
  if (state.offline && !state.offlineDismissed) return NOTICES["sin-conexion"];
  if (state.standalone || state.installDismissed) return null;
  if (state.canInstall) return NOTICES.instalar;
  if (state.iosHint) return NOTICES["instalar-ios"];
  return null;
}

/**
 * ¿Hay que explicar el gesto de instalar en iOS? iPhone y iPad (también iPadOS, que se anuncia
 * como Macintosh pero con pantalla táctil) que no están ya en modo app.
 */
export function needsIosInstallHint(userAgent: string, maxTouchPoints: number, standalone: boolean): boolean {
  if (standalone) return false;
  const isIosDevice = /iPhone|iPad|iPod/.test(userAgent);
  const isIpadOs = /Macintosh/.test(userAgent) && maxTouchPoints > 1;
  return isIosDevice || isIpadOs;
}
