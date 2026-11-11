// Cuentas de material del coach: qué se gana capturando en una casilla.
//
// Es un intercambio estático (SEE, «static exchange evaluation»): en la
// casilla capturan los dos bandos por turnos, siempre con la pieza de menos
// valor, y cada uno puede dejar de capturar cuando ya no le conviene. Se hace
// con jugadas legales (no con un mapa de ataques), así que respeta clavadas y
// jaques; es más lento que un SEE de motor, pero el coach analiza una jugada
// cada vez y la claridad importa más.
import { PIECE_VALUES } from "../engine/index.js";
import type { Move, Position, Square } from "../core/index.js";

/** Columna de una casilla 0x88. */
const fileOf = (square: Square): number => square & 7;

/** Valor de una pieza como atacante: el rey captura el último. */
const attackerValue = (position: Position, move: Move): number => {
  const piece = position.pieceAt(move.from)!;
  return piece.type === "k" ? 100_000 : PIECE_VALUES[piece.type];
};

/** Lo que gana de más una coronación (la dama vale 900, el peón 100: gana 800). */
const promotionBonus = (move: Move): number =>
  move.promotion === null ? 0 : PIECE_VALUES[move.promotion] - PIECE_VALUES.p;

/** Valor de lo que captura la jugada (también al paso), o 0 si no captura. */
export function capturedValue(position: Position, move: Move): number {
  const target = position.pieceAt(move.to);
  if (target !== null) return PIECE_VALUES[target.type];
  const mover = position.pieceAt(move.from);
  // Al paso: un peón que cambia de columna hacia una casilla vacía.
  return mover !== null && mover.type === "p" && fileOf(move.from) !== fileOf(move.to) ? PIECE_VALUES.p : 0;
}

/**
 * Captura legal en `square` con la pieza de menos valor (y, si es un peón que
 * corona, coronando a dama), o `null` si no hay ninguna.
 */
export function cheapestCapture(position: Position, square: Square): Move | null {
  let best: Move | null = null;
  let bestKey = Infinity;
  for (const move of position.legalMoves()) {
    if (move.to !== square) continue;
    if (move.promotion !== null && move.promotion !== "q") continue;
    const key = attackerValue(position, move);
    if (key < bestKey) {
      best = move;
      bestKey = key;
    }
  }
  return best;
}

/**
 * Lo que gana el bando que mueve si empieza a capturar en `square`, contando
 * las recapturas. 0 si no hay nada que capturar ahí o si no le conviene.
 * Deja `position` como estaba.
 */
export function exchangeGain(position: Position, square: Square): number {
  const target = position.pieceAt(square);
  // Solo se capturan piezas del rival del bando que mueve.
  if (target === null || target.color === position.turn) return 0;
  const capture = cheapestCapture(position, square);
  if (capture === null) return 0;
  const won = PIECE_VALUES[target.type] + promotionBonus(capture);
  position.makeMove(capture);
  const lost = exchangeGain(position, square);
  position.unmakeMove();
  return Math.max(0, won - lost);
}

/**
 * Balance de material de hacer `move` (una jugada de `position.legalMoves()`)
 * contando las recapturas del rival en la casilla de destino: lo capturado
 * más lo ganado coronando, menos lo que el rival recupera. Puede ser negativo
 * (por ejemplo, un caballo que captura un peón defendido). Deja `position`
 * como estaba.
 */
export function moveBalance(position: Position, move: Move): number {
  const won = capturedValue(position, move) + promotionBonus(move);
  position.makeMove(move);
  const lost = exchangeGain(position, move.to);
  position.unmakeMove();
  return won - lost;
}
