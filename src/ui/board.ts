// Tablero estático: pinta una posición (colocación de la FEN) con coordenadas.
// No gestiona jugadas ni eventos: la interacción se monta encima de `BoardView`.
import { FenError } from "../core/index.js";
import type { Color, PieceType } from "../core/index.js";
import { installPieceDefs, pieceMarkup, pieceName } from "./pieces.js";

export interface PlacedPiece {
  readonly color: Color;
  readonly type: PieceType;
}

/** Una casilla del tablero, en el orden en que se dibuja. */
export interface SquareModel {
  /** Nombre algebraico: «e4». */
  readonly name: string;
  /** Columna 0 (a) a 7 (h). */
  readonly file: number;
  /** Fila 0 (la 1) a 7 (la 8). */
  readonly rank: number;
  readonly light: boolean;
  readonly piece: PlacedPiece | null;
  /** Texto accesible: «e4, peón blanco» o «e4, vacía». */
  readonly label: string;
}

/** `meta`: casilla objetivo de un ejercicio de primeros pasos (anillo discontinuo). */
export type Mark = "selected" | "target" | "capture" | "last-move" | "check" | "meta";

const MARK_TEXT: Readonly<Record<Mark, string>> = {
  selected: "seleccionada",
  target: "destino",
  capture: "captura posible",
  "last-move": "última jugada",
  check: "rey en jaque",
  meta: "casilla objetivo",
};

export interface BoardOptions {
  /** Bando que se ve abajo; por defecto las blancas. */
  readonly orientation?: Color;
}

export interface BoardView {
  /** Raíz del tablero (contiene la rejilla y las coordenadas). */
  readonly element: HTMLElement;
  /** Pinta la colocación de la FEN (solo el primer campo). Lanza `FenError` si está mal formada. */
  setPosition(fen: string): void;
  setOrientation(color: Color): void;
  /**
   * Casilla por nombre algebraico («e4»). Lanza si el nombre no es válido.
   * El elemento sirve hasta el siguiente `setPosition` o `setOrientation` que cambie algo, que
   * reconstruyen el tablero: vuelve a pedirlo después en lugar de guardarlo.
   */
  squareElement(square: string): HTMLElement;
  /**
   * Sustituye todas las marcas anteriores. Cada casilla recibe `data-marks` y su `aria-label`
   * añade la marca en español («e4, vacía, destino»). Si una casilla tiene captura y destino a la vez, se pinta la captura.
   */
  setMarks(marks: ReadonlyMap<string, readonly Mark[]>): void;
}

const FILES = "abcdefgh";
const PIECE_LETTERS = "pnbrqk";

export const squareName = (file: number, rank: number): string => FILES[file]! + String(rank + 1);

/**
 * Lee el primer campo de una FEN (o la colocación sola) y devuelve las 64
 * casillas indexadas por `8 * rank + file` (a1 = 0, h8 = 63).
 * Solo valida la forma de la colocación; la legalidad es cosa de `core`.
 */
export function parsePlacement(fen: string): Array<PlacedPiece | null> {
  const placement = fen.trim().split(/\s+/)[0] ?? "";
  const rows = placement.split("/");
  if (rows.length !== 8) throw new FenError(`La colocación debe tener 8 filas y tiene ${rows.length}`);
  const out: Array<PlacedPiece | null> = new Array(64).fill(null);
  rows.forEach((row, i) => {
    const rank = 7 - i;
    let file = 0;
    for (const ch of row) {
      if (ch >= "1" && ch <= "8") {
        file += Number(ch);
      } else {
        const lower = ch.toLowerCase();
        // Solo letras ASCII de pieza: toLowerCase() convierte algún símbolo no ASCII en «k».
        if (!/^[A-Za-z]$/.test(ch) || !PIECE_LETTERS.includes(lower)) {
          throw new FenError(`Pieza no válida «${ch}» en la fila ${rank + 1}`);
        }
        if (file > 7) throw new FenError(`La fila ${rank + 1} tiene más de 8 casillas`);
        out[8 * rank + file] = { color: ch === lower ? "b" : "w", type: lower as PieceType };
        file += 1;
      }
      if (file > 8) throw new FenError(`La fila ${rank + 1} tiene más de 8 casillas`);
    }
    if (file !== 8) throw new FenError(`La fila ${rank + 1} no suma 8 casillas`);
  });
  return out;
}

/** Las 64 casillas en orden de dibujo: de arriba a abajo y de izquierda a derecha. */
export function boardModel(fen: string, orientation: Color = "w"): SquareModel[] {
  const pieces = parsePlacement(fen);
  const squares: SquareModel[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const rank = orientation === "w" ? 7 - row : row;
      const file = orientation === "w" ? col : 7 - col;
      const piece = pieces[8 * rank + file] ?? null;
      const name = squareName(file, rank);
      squares.push({
        name,
        file,
        rank,
        light: (file + rank) % 2 === 1,
        piece,
        label: `${name}, ${piece ? pieceName(piece.color, piece.type) : "vacía"}`,
      });
    }
  }
  return squares;
}

const ROW_ORDER = (orientation: Color): number[] => (orientation === "w" ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7]);
const COL_ORDER = (orientation: Color): number[] => (orientation === "w" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0]);

/**
 * Marcado del tablero. Todo el contenido sale de constantes y de enumeraciones
 * validadas (nombres de casilla, letras de pieza): ningún texto del usuario
 * llega aquí, así que no hay nada que escapar.
 */
function boardHtml(fen: string, orientation: Color): string {
  const squares = boardModel(fen, orientation);
  let rows = "";
  for (let r = 0; r < 8; r++) {
    let cells = "";
    for (let c = 0; c < 8; c++) {
      const sq = squares[8 * r + c]!;
      const tone = sq.light ? "clara" : "oscura";
      const svg = sq.piece ? pieceMarkup(sq.piece.color, sq.piece.type) : "";
      cells += `<div class="casilla casilla--${tone}" role="gridcell" data-square="${sq.name}" aria-label="${sq.label}">${svg}</div>`;
    }
    rows += `<div class="tablero__fila" role="row">${cells}</div>`;
  }
  const ranks = ROW_ORDER(orientation).map((r) => `<span>${r + 1}</span>`).join("");
  const files = COL_ORDER(orientation).map((f) => `<span>${FILES[f]}</span>`).join("");
  const side = orientation === "w" ? "blancas" : "negras";
  return (
    `<div class="tablero__rejilla" role="grid" aria-label="Tablero de ajedrez, visto desde las ${side}">${rows}</div>` +
    `<div class="tablero__rangos" aria-hidden="true">${ranks}</div>` +
    `<div class="tablero__columnas" aria-hidden="true">${files}</div>`
  );
}

/** Crea un tablero dentro de `container` y devuelve su vista. Empieza vacío hasta `setPosition`. */
export function createBoard(container: HTMLElement, options: BoardOptions = {}): BoardView {
  const doc = container.ownerDocument;
  installPieceDefs(doc);
  let orientation: Color = options.orientation ?? "w";
  let fen = "8/8/8/8/8/8/8/8";
  let marks: ReadonlyMap<string, readonly Mark[]> = new Map();
  let cells = new Map<string, HTMLElement>();
  let baseLabels = new Map<string, string>();

  const element = doc.createElement("div");
  element.className = "tablero";
  container.replaceChildren(element);

  const applyMarks = (): void => {
    for (const [square, el] of cells) {
      const list = marks.get(square) ?? [];
      const base = baseLabels.get(square) ?? square;
      if (list.length > 0) {
        el.setAttribute("data-marks", list.join(" "));
        el.setAttribute("aria-label", `${base}, ${list.map((m) => MARK_TEXT[m]).join(", ")}`);
      } else {
        el.removeAttribute("data-marks");
        el.setAttribute("aria-label", base);
      }
    }
  };

  const draw = (): void => {
    element.dataset["orientation"] = orientation;
    element.innerHTML = boardHtml(fen, orientation);
    cells = new Map();
    baseLabels = new Map();
    for (const el of element.querySelectorAll<HTMLElement>("[data-square]")) {
      const name = el.dataset["square"]!;
      cells.set(name, el);
      baseLabels.set(name, el.getAttribute("aria-label") ?? name);
    }
    applyMarks();
  };
  draw();

  return {
    element,
    setPosition(next: string): void {
      parsePlacement(next); // falla antes de tocar el DOM
      if (next === fen) return;
      fen = next;
      draw();
    },
    setOrientation(color: Color): void {
      if (color === orientation) return;
      orientation = color;
      draw();
    },
    squareElement(square: string): HTMLElement {
      const el = cells.get(square);
      if (!el) throw new RangeError(`Casilla no válida: ${square}`);
      return el;
    },
    setMarks(next: ReadonlyMap<string, readonly Mark[]>): void {
      marks = next;
      applyMarks();
    },
  };
}
