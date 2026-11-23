// Qué hay que animar al pasar de una posición a otra (lienzo «Piezas que se mueven», CAL-391).
// Solo cuentas, sin DOM: board.ts decide cómo se dibuja. Si el cambio no es una sola jugada
// (o deshacer una), no hay plan y el tablero cambia de golpe.
import { parsePlacement, squareName } from "./board.js";
import type { PlacedPiece } from "./board.js";

/** Una pieza que se desliza de `from` a `to`. */
export interface Slide {
  readonly from: string;
  readonly to: string;
  readonly piece: PlacedPiece;
}

/** Una pieza que está en `square` y se desvanece (capturada) o aparece (deshacer una captura). */
export interface SquarePiece {
  readonly square: string;
  readonly piece: PlacedPiece;
}

export interface MovePlan {
  readonly slides: readonly Slide[];
  /** Capturadas: se quedan debajo y se desvanecen mientras llega la atacante. */
  readonly fades: readonly SquarePiece[];
  /** Al deshacer una captura: la capturada reaparece en su casilla. */
  readonly appears: readonly SquarePiece[];
  /** Coronación: el peón que se desliza se convierte en esta pieza al llegar. */
  readonly promotion: SquarePiece | null;
}

const same = (a: PlacedPiece | null, b: PlacedPiece | null): boolean =>
  a === b || (a !== null && b !== null && a.color === b.color && a.type === b.type);

const sqName = (index: number): string => squareName(index % 8, Math.floor(index / 8));
const rankOf = (index: number): number => Math.floor(index / 8);

interface Item {
  readonly index: number;
  readonly piece: PlacedPiece;
}

/** Quita de `list` el único elemento que cumple `test`; `undefined` si no hay exactamente uno. */
function takeOnly(list: Item[], test: (item: Item) => boolean): Item | undefined {
  const found = list.filter(test);
  if (found.length !== 1) return undefined;
  list.splice(list.indexOf(found[0]!), 1);
  return found[0];
}

/**
 * Plan de animación entre dos posiciones (FEN completas o solo la colocación). Devuelve `null` si no
 * cambia nada o si el cambio no es una sola jugada: dos jugadas de golpe, nueva partida, cargar un PGN.
 */
export function planMoveAnimation(before: string, after: string): MovePlan | null {
  const a = parsePlacement(before);
  const b = parsePlacement(after);
  const gone: Item[] = [];
  const came: Item[] = [];
  for (let i = 0; i < 64; i++) {
    if (same(a[i] ?? null, b[i] ?? null)) continue;
    if (a[i]) gone.push({ index: i, piece: a[i]! });
    if (b[i]) came.push({ index: i, piece: b[i]! });
  }

  const slides: Slide[] = [];
  let promotion: SquarePiece | null = null;
  // Primero las piezas que siguen siendo las mismas: van de donde estaban a donde están.
  for (const arrival of [...came]) {
    const departure = takeOnly(gone, (g) => same(g.piece, arrival.piece));
    if (!departure) continue;
    if (!takeOnly(came, (c) => c === arrival)) return null;
    slides.push({ from: sqName(departure.index), to: sqName(arrival.index), piece: arrival.piece });
  }
  // Coronación: un peón se va de la penúltima fila y aparece otra pieza suya en la última.
  if (slides.length === 0) {
    const promoted = takeOnly(came, (c) => c.piece.type !== "p" && rankOf(c.index) === (c.piece.color === "w" ? 7 : 0));
    if (promoted) {
      const pawn = takeOnly(gone, (g) => g.piece.type === "p" && g.piece.color === promoted.piece.color && rankOf(g.index) === (promoted.piece.color === "w" ? 6 : 1));
      if (!pawn) return null;
      const pawnPiece: PlacedPiece = { color: promoted.piece.color, type: "p" };
      slides.push({ from: sqName(pawn.index), to: sqName(promoted.index), piece: pawnPiece });
      promotion = { square: sqName(promoted.index), piece: promoted.piece };
    } else {
      // Deshacer una coronación: el peón vuelve a la penúltima fila desde la casilla donde coronó.
      const pawn = takeOnly(came, (c) => c.piece.type === "p" && rankOf(c.index) === (c.piece.color === "w" ? 6 : 1));
      if (pawn) {
        const queen = takeOnly(gone, (g) => g.piece.type !== "p" && g.piece.color === pawn.piece.color && rankOf(g.index) === (pawn.piece.color === "w" ? 7 : 0));
        if (!queen) return null;
        slides.push({ from: sqName(queen.index), to: sqName(pawn.index), piece: pawn.piece });
      }
    }
  }

  const fades = gone.map((g) => ({ square: sqName(g.index), piece: g.piece }));
  const appears = came.map((c) => ({ square: sqName(c.index), piece: c.piece }));
  const plan: MovePlan = { slides, fades, appears, promotion };
  return isOneMove(plan) ? plan : null;
}

/** Una jugada (o deshacerla): una pieza que se desliza con a lo sumo una capturada, o un enroque. */
function isOneMove(plan: MovePlan): boolean {
  const { slides, fades, appears } = plan;
  if (slides.length === 1) return fades.length + appears.length <= 1 && [...fades, ...appears].every((x) => x.piece.color !== slides[0]!.piece.color);
  if (slides.length === 2 && fades.length === 0 && appears.length === 0) {
    const [x, y] = slides as [Slide, Slide];
    const types = [x.piece.type, y.piece.type].sort().join("");
    return x.piece.color === y.piece.color && types === "kr";
  }
  return false;
}
