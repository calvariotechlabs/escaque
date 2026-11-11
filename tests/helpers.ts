// Utilidades de test construidas solo con la interfaz pública del núcleo.
import { Position, moveToUci } from "../src/core/index.js";

/** Jugadas legales en UCI, ordenadas. */
export function legalUci(position: Position): string[] {
  return position.legalMoves().map(moveToUci).sort();
}

/** Aplica jugadas en UCI; falla con un mensaje claro si alguna no es legal. */
export function play(position: Position, ...moves: string[]): Position {
  for (const uci of moves) {
    const move = position.moveFromUci(uci);
    if (move === null) {
      throw new Error(`${uci} no es legal en ${position.toFen()}; legales: ${legalUci(position).join(" ")}`);
    }
    position.makeMove(move);
  }
  return position;
}

/** Posición tras jugar desde una FEN. */
export function after(fen: string, ...moves: string[]): Position {
  return play(Position.fromFen(fen), ...moves);
}

