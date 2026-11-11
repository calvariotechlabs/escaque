// Modelo de interacción del tablero, sin DOM: qué pasa con cada clic, arrastre
// o tecla, y qué casillas se marcan. La capa DOM solo traduce eventos a estas llamadas y pinta el
// resultado; así toda la lógica se prueba en Node.
import type { Color, PromotionPiece } from "../core/index.js";
import type { Game, MoveRecord } from "./game.js";

/** Marcas que el tablero sabe pintar en una casilla. */
export type Mark = "selected" | "target" | "capture" | "last-move" | "check";

/** Resultado de una acción, para que la capa DOM sepa qué actualizar o anunciar. */
export type Outcome =
  | { readonly kind: "none" }
  | { readonly kind: "focus"; readonly square: string }
  | { readonly kind: "selected"; readonly square: string }
  | { readonly kind: "deselected" }
  | { readonly kind: "promotion"; readonly from: string; readonly to: string }
  | { readonly kind: "moved"; readonly record: MoveRecord }
  | { readonly kind: "undone"; readonly record: MoveRecord }
  | { readonly kind: "redone"; readonly record: MoveRecord }
  | { readonly kind: "jumped"; readonly ply: number };

const NONE: Outcome = { kind: "none" };
const DESELECTED: Outcome = { kind: "deselected" };
const FILES = "abcdefgh";

/**
 * Casilla a la que va el foco con una tecla, o `null` si la tecla no mueve el
 * foco. Las direcciones son las de la pantalla: con las negras abajo, «arriba»
 * baja de fila. Inicio/Fin van a los extremos de la fila y Re Pág/Av Pág a los
 * de la columna, como en el patrón de rejilla de WAI-ARIA.
 */
export function nextFocus(square: string, key: string, orientation: Color): string | null {
  let file = FILES.indexOf(square[0]!);
  let rank = Number(square[1]) - 1;
  const flip = orientation === "w" ? 1 : -1;
  switch (key) {
    case "ArrowUp":
      rank += flip;
      break;
    case "ArrowDown":
      rank -= flip;
      break;
    case "ArrowRight":
      file += flip;
      break;
    case "ArrowLeft":
      file -= flip;
      break;
    case "Home":
      file = orientation === "w" ? 0 : 7;
      break;
    case "End":
      file = orientation === "w" ? 7 : 0;
      break;
    case "PageUp":
      rank = orientation === "w" ? 7 : 0;
      break;
    case "PageDown":
      rank = orientation === "w" ? 0 : 7;
      break;
    default:
      return null;
  }
  file = Math.min(7, Math.max(0, file));
  rank = Math.min(7, Math.max(0, rank));
  return `${FILES[file]!}${rank + 1}`;
}

export class Interaction {
  /** Pieza seleccionada, o `null`. */
  selected: string | null = null;
  /** Casilla con el foco del teclado (tabindex itinerante). */
  focus: string;
  /** Coronación esperando a que se elija pieza, o `null`. */
  pendingPromotion: { readonly from: string; readonly to: string } | null = null;
  /** Bando que se ve abajo. */
  orientation: Color = "w";

  constructor(private readonly game: Game) {
    this.focus = this.kingSquare();
  }

  /** Clic (o Intro/Espacio) en una casilla. */
  click(square: string): Outcome {
    if (this.pendingPromotion !== null) return NONE;
    if (this.selected !== null) {
      if (square === this.selected) return this.deselect();
      if (this.game.targets(this.selected).includes(square)) return this.moveTo(this.selected, square);
    }
    if (this.canSelect(square)) return this.select(square);
    return this.selected !== null ? this.deselect() : NONE;
  }

  /** Empieza a arrastrar desde `square`. Devuelve si la pieza se puede arrastrar. */
  dragStart(square: string): boolean {
    if (this.pendingPromotion !== null || !this.canSelect(square)) return false;
    this.select(square);
    return true;
  }

  /** Suelta lo que se arrastraba en `square`, o fuera del tablero (`null`). */
  drop(square: string | null): Outcome {
    const from = this.selected;
    if (from === null || this.pendingPromotion !== null) return NONE;
    if (square === from) return this.select(from);
    if (square !== null && this.game.targets(from).includes(square)) return this.moveTo(from, square);
    return this.deselect();
  }

  /** Elige la pieza de la coronación pendiente. */
  choosePromotion(piece: PromotionPiece): Outcome {
    const pending = this.pendingPromotion;
    if (pending === null) return NONE;
    this.pendingPromotion = null;
    this.selected = null;
    const record = this.game.play(pending.from, pending.to, piece);
    return record === null ? DESELECTED : { kind: "moved", record };
  }

  /** Escape: cierra la coronación pendiente o quita la selección. */
  cancel(): Outcome {
    if (this.pendingPromotion === null && this.selected === null) return NONE;
    this.pendingPromotion = null;
    return this.deselect();
  }

  /** Tecla pulsada sobre el tablero. */
  key(key: string): Outcome {
    if (key === "Escape") return this.cancel();
    if (key === "Enter" || key === " ") return this.click(this.focus);
    const next = nextFocus(this.focus, key, this.orientation);
    if (next === null) return NONE;
    this.focus = next;
    return { kind: "focus", square: next };
  }

  /** Deshace la última jugada y limpia la selección. */
  undo(): Outcome {
    const record = this.game.undo();
    if (record === null) return NONE;
    this.clear();
    return { kind: "undone", record };
  }

  /** Rehace la última jugada deshecha y limpia la selección. */
  redo(): Outcome {
    const record = this.game.redo();
    if (record === null) return NONE;
    this.clear();
    return { kind: "redone", record };
  }

  /** Salta a la posición tras `ply` medias jugadas (lista de jugadas) y limpia la selección. */
  goTo(ply: number): Outcome {
    this.game.goTo(ply);
    this.clear();
    return { kind: "jumped", ply: this.game.ply };
  }

  /** Marcas de todas las casillas que tienen alguna. */
  marks(): Map<string, Mark[]> {
    const marks = new Map<string, Mark[]>();
    const add = (square: string, mark: Mark): void => {
      const list = marks.get(square);
      if (list === undefined) marks.set(square, [mark]);
      else list.push(mark);
    };
    const last = this.game.lastMove;
    if (last !== null) {
      add(last.from, "last-move");
      add(last.to, "last-move");
    }
    const check = this.game.checkSquare;
    if (check !== null) add(check, "check");
    if (this.selected !== null) {
      add(this.selected, "selected");
      for (const target of this.game.targets(this.selected)) {
        add(target, this.isCapture(this.selected, target) ? "capture" : "target");
      }
    }
    return marks;
  }

  private clear(): void {
    this.selected = null;
    this.pendingPromotion = null;
  }

  private canSelect(square: string): boolean {
    const piece = this.game.pieceAt(square);
    return piece !== null && piece.color === this.game.turn && this.game.targets(square).length > 0;
  }

  private select(square: string): Outcome {
    this.selected = square;
    return { kind: "selected", square };
  }

  private deselect(): Outcome {
    this.selected = null;
    return DESELECTED;
  }

  private moveTo(from: string, to: string): Outcome {
    if (this.game.isPromotion(from, to)) {
      this.pendingPromotion = { from, to };
      return { kind: "promotion", from, to };
    }
    this.selected = null;
    const record = this.game.play(from, to);
    return record === null ? DESELECTED : { kind: "moved", record };
  }

  /** Captura normal o al paso (peón que cambia de columna). */
  private isCapture(from: string, to: string): boolean {
    if (this.game.pieceAt(to) !== null) return true;
    return this.game.pieceAt(from)?.type === "p" && from[0] !== to[0];
  }

  private kingSquare(): string {
    for (const file of FILES) {
      for (let rank = 1; rank <= 8; rank++) {
        const piece = this.game.pieceAt(`${file}${rank}`);
        if (piece?.type === "k" && piece.color === this.game.turn) return `${file}${rank}`;
      }
    }
    return "e1";
  }
}
