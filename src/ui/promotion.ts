// Diálogo de coronación: lo comparten la partida y las lecciones.
// Solo se encarga del diálogo; qué pasa al elegir pieza (o al cancelar) lo decide quien lo abre.
import type { Color, PromotionPiece } from "../core/index.js";
import { pieceSvg } from "./pieces.js";

const PROMOTIONS: ReadonlyArray<readonly [PromotionPiece, string]> = [
  ["q", "Dama"],
  ["r", "Torre"],
  ["b", "Alfil"],
  ["n", "Caballo"],
];

export interface PromotionHandlers {
  choose(piece: PromotionPiece): void;
  /** Escape: cancela la jugada. */
  cancel(): void;
}

export interface PromotionDialog {
  readonly isOpen: boolean;
  open(color: Color, handlers: PromotionHandlers): void;
  close(): void;
}

export function createPromotionDialog(dialog: HTMLDialogElement, options: HTMLElement): PromotionDialog {
  let handlers: PromotionHandlers | null = null;

  options.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("[data-piece]");
    if (button === null || handlers === null) return;
    handlers.choose(button.dataset["piece"] as PromotionPiece);
  });

  // Escape cierra el diálogo y cancela la jugada.
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    handlers?.cancel();
  });

  return {
    get isOpen() {
      return dialog.open;
    },
    open(color, next) {
      handlers = next;
      const buttons = PROMOTIONS.map(([piece, name]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "coronacion__opcion";
        button.dataset["piece"] = piece;
        const svg = pieceSvg(color, piece);
        svg.setAttribute("aria-hidden", "true");
        const label = document.createElement("span");
        label.textContent = name;
        button.append(svg, label);
        return button;
      });
      options.replaceChildren(...buttons);
      dialog.showModal();
      buttons[0]!.focus();
    },
    close() {
      handlers = null;
      if (dialog.open) dialog.close();
    },
  };
}
