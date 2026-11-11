// Mensajes entre la interfaz y el Worker del coach.
//
// Petición:  { type: "analyze", id, fen, moves, move }
//   - fen y moves: la partida ANTES de la jugada (posición inicial y jugadas en UCI);
//     move: la jugada que se revisa, en UCI.
// Respuesta: { type: "report", id, report } o { type: "error", id, message }
//
// Igual que el del motor, el Worker valida cada mensaje y nunca lanza: un
// mensaje mal formado recibe un error corto que no repite lo recibido.
import { FenError } from "../core/index.js";
import { analyzeMove, CoachError } from "../coach/index.js";
import type { AnalyzeOptions, CoachReport } from "../coach/index.js";
import { MAX_MOVES } from "./protocol.js";

const MAX_FEN_LENGTH = 100;
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

export interface AnalyzeRequest {
  readonly type: "analyze";
  readonly id: number;
  readonly fen: string;
  readonly moves: readonly string[];
  readonly move: string;
}

export type CoachResponse =
  | { readonly type: "report"; readonly id: number; readonly report: CoachReport }
  | { readonly type: "error"; readonly id: number | null; readonly message: string };

class ProtocolError extends Error {}

const isId = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

function parseRequest(data: unknown): AnalyzeRequest {
  if (typeof data !== "object" || data === null || Array.isArray(data)) throw new ProtocolError("La petición debe ser un objeto");
  const { type, id, fen, moves, move } = data as Record<string, unknown>;
  if (type !== "analyze") throw new ProtocolError("Se desconoce el tipo de petición");
  if (!isId(id)) throw new ProtocolError("El id debe ser un entero no negativo");
  if (typeof fen !== "string" || fen.length > MAX_FEN_LENGTH) throw new ProtocolError("FEN no válida");
  if (
    !Array.isArray(moves) ||
    moves.length > MAX_MOVES ||
    !moves.every((m): m is string => typeof m === "string" && UCI.test(m))
  ) {
    throw new ProtocolError("Lista de jugadas no válida");
  }
  if (typeof move !== "string" || !UCI.test(move)) throw new ProtocolError("Jugada no válida");
  return { type, id, fen, moves, move };
}

/** Atiende una petición del coach. Nunca lanza. */
export function handleAnalyze(data: unknown, options: AnalyzeOptions = {}): CoachResponse {
  const rawId = typeof data === "object" && data !== null ? (data as { id?: unknown }).id : undefined;
  const id = isId(rawId) ? rawId : null;
  try {
    const request = parseRequest(data);
    const report = analyzeMove({ fen: request.fen, moves: request.moves }, request.move, options);
    return { type: "report", id: request.id, report };
  } catch (error) {
    const message =
      error instanceof ProtocolError
        ? error.message
        : error instanceof CoachError || error instanceof FenError
          ? "No se puede analizar esa jugada"
          : "Error interno del coach";
    return { type: "error", id, message };
  }
}
