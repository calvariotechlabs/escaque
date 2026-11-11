// Mensajes entre la interfaz y el Worker del motor.
//
// Petición:  { type: "search", id, fen, moves, level }
//   - fen: posición inicial de la partida; moves: jugadas hechas desde ella en
//     UCI. Se manda la partida entera (y no solo la posición actual) para que
//     el motor vea las repeticiones.
// Respuesta: { type: "result", id, best, score, depth, nodes, pv }
//         o  { type: "error", id, message }
//
// El Worker valida cada mensaje: tipos, longitudes, nivel y legalidad de las
// jugadas. Nunca lanza: un mensaje mal formado recibe una respuesta de error,
// y los errores no repiten textos largos recibidos.
import { Position } from "../core/index.js";
import { chooseMove, isLevel } from "../engine/index.js";
import type { ChooseOptions, Level } from "../engine/index.js";

/** Una FEN válida no pasa de ~90 caracteres. */
const MAX_FEN_LENGTH = 100;
/** Ninguna partida real llega a 1000 medias jugadas. */
export const MAX_MOVES = 1000;
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

export interface SearchRequest {
  readonly type: "search";
  readonly id: number;
  readonly fen: string;
  readonly moves: readonly string[];
  readonly level: Level;
}

export type EngineResponse =
  | {
      readonly type: "result";
      readonly id: number;
      readonly best: string | null;
      readonly score: number;
      readonly depth: number;
      readonly nodes: number;
      readonly pv: readonly string[];
    }
  | { readonly type: "error"; readonly id: number | null; readonly message: string };

class ProtocolError extends Error {}

const isId = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

/** Valida una petición. Lanza `ProtocolError` con un mensaje corto si algo no cuadra. */
function parseRequest(data: unknown): SearchRequest {
  if (typeof data !== "object" || data === null || Array.isArray(data)) throw new ProtocolError("La petición debe ser un objeto");
  const { type, id, fen, moves, level } = data as Record<string, unknown>;
  if (type !== "search") throw new ProtocolError("Se desconoce el tipo de petición");
  if (!isId(id)) throw new ProtocolError("El id debe ser un entero no negativo");
  if (typeof fen !== "string" || fen.length > MAX_FEN_LENGTH) throw new ProtocolError("FEN no válida");
  if (
    !Array.isArray(moves) ||
    moves.length > MAX_MOVES ||
    !moves.every((move): move is string => typeof move === "string" && UCI.test(move))
  ) {
    throw new ProtocolError("Lista de jugadas no válida");
  }
  if (!isLevel(level)) throw new ProtocolError("Se desconoce el nivel");
  return { type, id, fen, moves, level };
}

/** Reconstruye la partida: posición inicial más las jugadas, comprobando que todas son legales. */
function replay(fen: string, moves: readonly string[]): Position {
  let position: Position;
  try {
    position = Position.fromFen(fen);
  } catch (error) {
    throw new ProtocolError(`FEN no válida: ${error instanceof Error ? error.message : "error desconocido"}`);
  }
  moves.forEach((uci, index) => {
    const move = position.moveFromUci(uci);
    if (move === null) throw new ProtocolError(`La jugada ${index + 1} (${uci}) no es legal`);
    position.makeMove(move);
  });
  return position;
}

/** Atiende una petición del Worker. Nunca lanza. */
export function handleRequest(data: unknown, options: ChooseOptions = {}): EngineResponse {
  const rawId = typeof data === "object" && data !== null ? (data as { id?: unknown }).id : undefined;
  const id = isId(rawId) ? rawId : null;
  try {
    const request = parseRequest(data);
    const result = chooseMove(replay(request.fen, request.moves), request.level, options);
    return { type: "result", id: request.id, ...result };
  } catch (error) {
    const message = error instanceof ProtocolError ? error.message : "Error interno del motor";
    return { type: "error", id, message };
  }
}
