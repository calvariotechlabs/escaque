// Partidas automáticas entre jugadores, sin interfaz: sirven para medir los
// niveles del motor (npm run match) y en los tests.
import { Position, START_FEN, moveToUci } from "../src/core/index.js";
import { chooseMove, TranspositionTable } from "../src/engine/index.js";
import type { Level } from "../src/engine/index.js";

/** Un jugador recibe la partida y devuelve su jugada en UCI. No debe dejar la posición cambiada. */
export type Player = (position: Position) => string;

export interface GameRecord {
  readonly result: "1-0" | "0-1" | "1/2-1/2";
  /** `kind` del estado final, o «max-plies» si se cortó por larga. */
  readonly reason: string;
  readonly plies: number;
  readonly moves: readonly string[];
}

/** Juega al azar entre las jugadas legales. */
export function randomPlayer(random: () => number): Player {
  return (position) => {
    const moves = position.legalMoves();
    return moveToUci(moves[random() % moves.length]!);
  };
}

/** Juega con Alfil Beta al nivel dado, con su propia tabla de transposición. */
export function enginePlayer(level: Level, random?: () => number): Player {
  const table = new TranspositionTable();
  return (position) => {
    const { best } = chooseMove(position, level, random === undefined ? { table } : { table, random });
    if (best === null) throw new Error("El motor no tiene jugada en una partida en curso");
    return best;
  };
}

export function playGame(white: Player, black: Player, options: { maxPlies?: number; fen?: string } = {}): GameRecord {
  const { maxPlies = 300, fen = START_FEN } = options;
  const position = Position.fromFen(fen);
  const moves: string[] = [];
  while (moves.length < maxPlies) {
    const status = position.status();
    if (status.kind !== "ongoing") {
      const result = status.kind === "checkmate" ? (status.winner === "w" ? "1-0" : "0-1") : "1/2-1/2";
      return { result, reason: status.kind, plies: moves.length, moves };
    }
    const uci = (position.turn === "w" ? white : black)(position);
    const move = position.moveFromUci(uci);
    if (move === null) throw new Error(`Jugada ilegal ${uci} en ${position.toFen()}`);
    position.makeMove(move);
    moves.push(uci);
  }
  const status = position.status();
  if (status.kind === "checkmate") {
    return { result: status.winner === "w" ? "1-0" : "0-1", reason: "checkmate", plies: moves.length, moves };
  }
  return { result: "1/2-1/2", reason: status.kind === "ongoing" ? "max-plies" : status.kind, plies: moves.length, moves };
}
