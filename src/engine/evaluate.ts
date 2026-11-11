// Evaluación de Alfil Beta: material más tablas de valor por casilla.
//
// Devuelve centipeones desde el punto de vista del bando que mueve (positivo =
// le va bien a quien mueve), que es lo que necesita negamax. Es simétrica: la
// misma posición con los colores cambiados vale lo mismo para quien mueve.
import type { PieceType, Position } from "../core/index.js";

/** Valor de cada pieza en centipeones. El rey no se cuenta: nunca sale del tablero. */
export const PIECE_VALUES: Readonly<Record<PieceType, number>> = Object.freeze({
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
});

// Tablas de valor por casilla, vistas por las blancas: la primera fila es la
// 8.ª (a8…h8) y la última la 1.ª (a1…h1). Para las negras se refleja la fila.
// prettier-ignore
const PAWN = [
    0,   0,   0,   0,   0,   0,   0,   0,
   60,  60,  60,  60,  60,  60,  60,  60,
   15,  15,  25,  35,  35,  25,  15,  15,
    5,   5,  10,  25,  25,  10,   5,   5,
    0,   0,   5,  20,  20,   5,   0,   0,
    5,  -5,  -5,   5,   5,  -5,  -5,   5,
    5,  10,  10, -20, -20,  10,  10,   5,
    0,   0,   0,   0,   0,   0,   0,   0,
];
// prettier-ignore
const KNIGHT = [
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20,   0,   5,   5,   0, -20, -40,
  -30,   5,  10,  15,  15,  10,   5, -30,
  -30,   0,  15,  20,  20,  15,   0, -30,
  -30,   5,  15,  20,  20,  15,   5, -30,
  -30,   0,  10,  15,  15,  10,   0, -30,
  -40, -20,   0,   5,   5,   0, -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50,
];
// prettier-ignore
const BISHOP = [
  -20, -10, -10, -10, -10, -10, -10, -20,
  -10,   0,   0,   0,   0,   0,   0, -10,
  -10,   0,   5,  10,  10,   5,   0, -10,
  -10,   5,   5,  10,  10,   5,   5, -10,
  -10,   0,  10,  10,  10,  10,   0, -10,
  -10,  10,  10,  10,  10,  10,  10, -10,
  -10,   5,   0,   0,   0,   0,   5, -10,
  -20, -10, -10, -10, -10, -10, -10, -20,
];
// prettier-ignore
const ROOK = [
    0,   0,   0,   0,   0,   0,   0,   0,
    5,  10,  10,  10,  10,  10,  10,   5,
   -5,   0,   0,   0,   0,   0,   0,  -5,
   -5,   0,   0,   0,   0,   0,   0,  -5,
   -5,   0,   0,   0,   0,   0,   0,  -5,
   -5,   0,   0,   0,   0,   0,   0,  -5,
   -5,   0,   0,   0,   0,   0,   0,  -5,
    0,   0,   0,   5,   5,   0,   0,   0,
];
// prettier-ignore
const QUEEN = [
  -20, -10, -10,  -5,  -5, -10, -10, -20,
  -10,   0,   0,   0,   0,   0,   0, -10,
  -10,   0,   5,   5,   5,   5,   0, -10,
   -5,   0,   5,   5,   5,   5,   0,  -5,
    0,   0,   5,   5,   5,   5,   0,  -5,
  -10,   5,   5,   5,   5,   5,   0, -10,
  -10,   0,   5,   0,   0,   0,   0, -10,
  -20, -10, -10,  -5,  -5, -10, -10, -20,
];
// Rey en el medio juego: detrás de sus peones, mejor enrocado.
// prettier-ignore
const KING_MIDDLE = [
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -20, -30, -30, -40, -40, -30, -30, -20,
  -10, -20, -20, -20, -20, -20, -20, -10,
   20,  20,   0,   0,   0,   0,  20,  20,
   20,  30,  10,   0,   0,  10,  30,  20,
];
// Rey en el final: una pieza más, cuanto más al centro mejor.
// prettier-ignore
const KING_END = [
  -50, -40, -30, -20, -20, -30, -40, -50,
  -30, -20, -10,   0,   0, -10, -20, -30,
  -30, -10,  20,  30,  30,  20, -10, -30,
  -30, -10,  30,  40,  40,  30, -10, -30,
  -30, -10,  30,  40,  40,  30, -10, -30,
  -30, -10,  20,  30,  30,  20, -10, -30,
  -30, -30,   0,   0,   0,   0, -30, -30,
  -50, -30, -30, -30, -30, -30, -30, -50,
];

const TABLES: Readonly<Record<Exclude<PieceType, "k">, readonly number[]>> = {
  p: PAWN,
  n: KNIGHT,
  b: BISHOP,
  r: ROOK,
  q: QUEEN,
};

/** Peso de cada pieza en la fase de la partida: 24 con todas las piezas, 0 sin ninguna. */
const PHASE_WEIGHT: Readonly<Record<PieceType, number>> = { p: 0, n: 1, b: 1, r: 2, q: 4, k: 0 };
const FULL_PHASE = 24;

/** Valoración estática de la posición en centipeones, para el bando que mueve. */
export function evaluate(position: Position): number {
  let white = 0;
  let black = 0;
  let phase = 0;
  let whiteKing = -1;
  let blackKing = -1;

  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = position.pieceAt(rank * 16 + file);
      if (piece === null) continue;
      // Índice de la tabla: blancas leen la fila reflejada (la tabla empieza en la 8.ª).
      const index = piece.color === "w" ? (7 - rank) * 8 + file : rank * 8 + file;
      phase += PHASE_WEIGHT[piece.type];
      if (piece.type === "k") {
        if (piece.color === "w") whiteKing = index;
        else blackKing = index;
        continue;
      }
      const value = PIECE_VALUES[piece.type] + TABLES[piece.type][index]!;
      if (piece.color === "w") white += value;
      else black += value;
    }
  }

  // El rey pasa de la tabla del medio juego a la del final según el material que queda.
  const middle = Math.min(phase, FULL_PHASE);
  const king = (index: number): number =>
    Math.trunc((KING_MIDDLE[index]! * middle + KING_END[index]! * (FULL_PHASE - middle)) / FULL_PHASE);
  white += king(whiteKing);
  black += king(blackKing);

  const score = white - black;
  return position.turn === "w" ? score : 0 - score; // «0 - x» evita devolver -0
}
