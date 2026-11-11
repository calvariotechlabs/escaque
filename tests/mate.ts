// Comprobador de mates por fuerza bruta, independiente del motor: sirve para
// validar las posiciones de prueba y las jugadas que elige Alfil Beta.
import type { Position } from "../src/core/index.js";

/** ¿Puede el bando que mueve dar mate en `moves` jugadas suyas como mucho, haga lo que haga el rival? */
export function canMateIn(position: Position, moves: number): boolean {
  if (moves <= 0) return false;
  for (const move of position.legalMoves()) {
    position.makeMove(move);
    const wins = defenderLoses(position, moves - 1);
    position.unmakeMove();
    if (wins) return true;
  }
  return false;
}

/** El bando que mueve está en mate ya, o recibe mate en `moves` jugadas más sea cual sea su respuesta. */
function defenderLoses(position: Position, moves: number): boolean {
  const replies = position.legalMoves();
  if (replies.length === 0) return position.isCheck();
  if (moves <= 0) return false;
  for (const reply of replies) {
    position.makeMove(reply);
    const mated = canMateIn(position, moves);
    position.unmakeMove();
    if (!mated) return false;
  }
  return true;
}
