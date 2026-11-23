// Tablero estático: pinta una posición (colocación de la FEN) con coordenadas.
// No gestiona jugadas ni eventos: la interacción se monta encima de `BoardView`.
import { FenError } from "../core/index.js";
import type { Color, PieceType } from "../core/index.js";
import { FADE_MS, MOVE_EASING, MOVE_MS, captureFrames, planMoveAnimation, promotionFrames, revealFrames, slideFrames } from "./move-animation.js";
import type { MovePlan } from "./move-animation.js";
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
export type Mark = "selected" | "target" | "capture" | "last-move-from" | "last-move-to" | "check" | "meta";

const MARK_TEXT: Readonly<Record<Mark, string>> = {
  selected: "seleccionada",
  target: "destino",
  capture: "captura posible",
  "last-move-from": "origen de la última jugada",
  "last-move-to": "destino de la última jugada",
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
  /**
   * Pinta la colocación de la FEN (solo el primer campo). Lanza `FenError` si está mal formada.
   * Si el cambio es una sola jugada (o deshacerla), se anima (lienzo «Piezas que se mueven»); si no, cambia de golpe.
   */
  setPosition(fen: string): void;
  /**
   * Ejecuta `run` sin animar los `setPosition` que haga: la pieza se ha soltado arrastrando y ya está donde va.
   */
  withoutAnimation(run: () => void): void;
  /** Termina de golpe la animación en curso (por ejemplo, al empezar a arrastrar una pieza que aún se desliza). */
  settle(): void;
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
  let skipNext = false; // dentro de `withoutAnimation`
  let running: Animation[] = [];

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

  /** Termina de golpe lo que se esté animando y quita las copias de las capturadas. */
  const settle = (): void => {
    for (const animation of running) animation.finish();
    running = [];
    // El evento «finish» llega después: lo que limpia se hace ya, para que quien siga (un arrastre) no lo encuentre.
    for (const copy of element.querySelectorAll(".pieza--copia")) copy.remove();
    for (const cell of element.querySelectorAll(".casilla--anima")) cell.classList.remove("casilla--anima");
  };

  const track = (animation: Animation, done?: () => void): void => {
    running.push(animation);
    animation.addEventListener("finish", () => {
      running = running.filter((a) => a !== animation);
      done?.();
    });
  };

  /** Pieza (SVG) de una casilla ya dibujada. */
  const pieceIn = (square: string): SVGElement | null => cells.get(square)?.querySelector<SVGElement>(".pieza:not(.pieza--copia)") ?? null;

  /** Copia de una pieza que ya no está en la posición nueva, encima de su casilla mientras se anima. */
  const addCopy = (square: string, color: Color, type: PieceType, cls: string): SVGElement | null => {
    const cell = cells.get(square);
    if (!cell) return null;
    cell.insertAdjacentHTML("afterbegin", pieceMarkup(color, type));
    const copy = cell.firstElementChild as SVGElement;
    copy.classList.add("pieza--copia", cls);
    return copy;
  };

  /** Una casilla con una pieza que viaja queda por encima del resto mientras dura el recorrido. */
  const lift = (square: string, animation: Animation): void => {
    const cell = cells.get(square);
    if (!cell) return;
    cell.classList.add("casilla--anima");
    track(animation, () => cell.classList.remove("casilla--anima"));
  };

  const animate = (plan: MovePlan): void => {
    const reduced = doc.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduced) {
      // Sin desplazamiento: la pieza aparece en su destino (y la capturada al deshacer) con un fundido.
      const shown = [...plan.slides.map((s) => s.to), ...plan.appears.map((a) => a.square)];
      for (const square of shown) {
        const piece = pieceIn(square);
        if (piece) track(piece.animate(revealFrames(), { duration: FADE_MS, easing: "ease-out" }));
      }
      return;
    }
    for (const slide of plan.slides) {
      const from = cells.get(slide.from)?.getBoundingClientRect();
      const to = cells.get(slide.to)?.getBoundingClientRect();
      if (!from || !to) continue;
      const frames = slideFrames(from.left - to.left, from.top - to.top);
      if (plan.promotion !== null && plan.promotion.square === slide.to) {
        // Coronación: viaja una copia del peón y, al llegar, se cruza con la pieza elegida.
        const pawn = addCopy(slide.to, slide.piece.color, "p", "pieza--corona");
        const piece = pieceIn(slide.to);
        const { pawn: pawnFade, piece: pieceFade, duration } = promotionFrames();
        if (pawn) {
          lift(slide.to, pawn.animate(frames, { duration: MOVE_MS, easing: MOVE_EASING }));
          track(pawn.animate(pawnFade, { duration }), () => pawn.remove());
        }
        if (piece) track(piece.animate(pieceFade, { duration }));
        continue;
      }
      const piece = pieceIn(slide.to);
      if (piece) lift(slide.to, piece.animate(frames, { duration: MOVE_MS, easing: MOVE_EASING }));
    }
    // La capturada se queda debajo y se desvanece en los últimos 120 ms del recorrido.
    for (const gone of plan.fades) {
      const copy = addCopy(gone.square, gone.piece.color, gone.piece.type, "pieza--capturada");
      if (copy) track(copy.animate(captureFrames(), { duration: MOVE_MS, fill: "forwards" }), () => copy.remove());
    }
    // Al deshacer una captura, la capturada reaparece mientras la otra pieza se va.
    for (const back of plan.appears) {
      const piece = pieceIn(back.square);
      if (piece) track(piece.animate(revealFrames(), { duration: MOVE_MS }));
    }
  };

  return {
    element,
    setPosition(next: string): void {
      parsePlacement(next); // falla antes de tocar el DOM
      if (next === fen) return;
      settle();
      const plan = skipNext ? null : planMoveAnimation(fen, next);
      fen = next;
      draw();
      if (plan !== null && typeof element.animate === "function") animate(plan);
    },
    withoutAnimation(run: () => void): void {
      const outer = skipNext; // se puede anidar: soltar arrastrando y, dentro, una partida nueva
      skipNext = true;
      try {
        run();
      } finally {
        skipNext = outer;
      }
    },
    settle,
    setOrientation(color: Color): void {
      if (color === orientation) return;
      settle();
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
