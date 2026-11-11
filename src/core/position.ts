// Posición de ajedrez: interfaz pública del núcleo de reglas.
//
// Hito 1, bloque 1: solo están las firmas y su contrato, para que los tests
// puedan escribirse antes que el código. Cada método lanza NotImplementedError
// hasta que el bloque 2 (tablero, FEN, generador) y el bloque 3 (fin de
// partida) los implementen. Los tests de tests/ son la especificación.

import { NotImplementedError } from "./errors.js";
import type { PerftTarget } from "./perft.js";
import type { Color, GameStatus, Move } from "./types.js";

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export class Position implements PerftTarget<Move> {
  private constructor() {}

  /**
   * Carga una posición en notación FEN.
   * Acepta FEN de 6 campos y también de 4 (sin relojes: se toman «0 1»).
   * Lanza `FenError` si la FEN está mal formada.
   */
  static fromFen(fen: string): Position {
    void fen;
    throw new NotImplementedError("Position.fromFen");
  }

  /**
   * FEN de 6 campos de la posición actual. La casilla al paso se escribe
   * siempre tras un avance doble de peón, haya o no captura posible (como
   * en la especificación de FEN), y «-» en el resto de casos.
   */
  toFen(): string {
    throw new NotImplementedError("Position.toFen");
  }

  /** Bando al que le toca mover. */
  get turn(): Color {
    throw new NotImplementedError("Position.turn");
  }

  /** Todas las jugadas legales del bando que mueve (incluye enroques, al paso y las 4 coronaciones). */
  legalMoves(): Move[] {
    throw new NotImplementedError("Position.legalMoves");
  }

  /**
   * Busca entre las jugadas legales la que corresponde a una jugada UCI
   * («e2e4», «e7e8q», «e1g1»). Devuelve `null` si no es legal aquí.
   */
  moveFromUci(uci: string): Move | null {
    void uci;
    throw new NotImplementedError("Position.moveFromUci");
  }

  /** Aplica una jugada obtenida de `legalMoves()` de esta misma posición. */
  makeMove(move: Move): void {
    void move;
    throw new NotImplementedError("Position.makeMove");
  }

  /** Deshace la última jugada aplicada y deja la posición exactamente como estaba. */
  unmakeMove(): void {
    throw new NotImplementedError("Position.unmakeMove");
  }

  /** ¿Está en jaque el rey del bando que mueve? */
  isCheck(): boolean {
    throw new NotImplementedError("Position.isCheck");
  }

  /**
   * Material insuficiente: ningún bando puede dar mate con ninguna serie de
   * jugadas legales. Casos: rey contra rey; rey y alfil contra rey; rey y
   * caballo contra rey; y reyes con cualquier número de alfiles, todos en
   * casillas del mismo color. Cualquier peón, torre o dama lo descarta, y
   * también rey y alfil contra rey y caballo, o dos caballos (hay mates posibles).
   */
  isInsufficientMaterial(): boolean {
    throw new NotImplementedError("Position.isInsufficientMaterial");
  }

  /** Estado de la partida (mate, ahogado, tablas o en juego). Bloque 3. */
  status(): GameStatus {
    throw new NotImplementedError("Position.status");
  }
}

/** Jugada en notación UCI: casilla de origen, destino y pieza de coronación («e2e4», «e7e8q», «e1g1»). */
export function moveToUci(move: Move): string {
  void move;
  throw new NotImplementedError("moveToUci");
}
