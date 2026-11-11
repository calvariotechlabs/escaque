// La jugada de la máquina: pide la mejor jugada al motor y la comprueba contra
// las reglas antes de darla por buena. Sin DOM: se prueba con un motor falso.
import type { PromotionPiece } from "../core/index.js";
import type { Level } from "../engine/levels.js";
import { EngineCancelledError, type ThinkRequest } from "../worker/client.js";
import type { Game } from "./game.js";

/** Lo que se necesita del cliente del motor; en los tests se usa uno falso. */
export interface EngineLike {
  think(request: ThinkRequest): Promise<{ readonly best: string | null }>;
  cancel(): void;
}

export interface MachineMove {
  readonly from: string;
  readonly to: string;
  readonly promotion?: PromotionPiece;
}

const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

/** Jugadas hechas hasta la posición actual, en UCI. */
export function historyUci(game: Game): string[] {
  return game.history.map((m) => `${m.from}${m.to}${m.promotion ?? ""}`);
}

/** Pasa «e7e8q» a sus partes, o `null` si no es una jugada UCI. */
export function parseUci(text: unknown): MachineMove | null {
  if (typeof text !== "string" || !UCI.test(text)) return null;
  const from = text.slice(0, 2);
  const to = text.slice(2, 4);
  return text.length === 5 ? { from, to, promotion: text[4] as PromotionPiece } : { from, to };
}

async function askOnce(engine: EngineLike, game: Game, level: Level): Promise<MachineMove | null> {
  const result = await engine.think({ fen: game.startFen, moves: historyUci(game), level });
  if (result.best === null) return null;
  const move = parseUci(result.best);
  // Lo que llega del Worker no es de confianza: solo se acepta una jugada legal de esta posición.
  if (move === null || !game.targets(move.from).includes(move.to)) throw new Error("El motor devolvió una jugada no válida");
  if (game.isPromotion(move.from, move.to) !== (move.promotion !== undefined)) throw new Error("El motor devolvió una coronación no válida");
  return move;
}

/**
 * Pide la jugada de la máquina. Si el motor falla, reintenta una vez; si vuelve
 * a fallar, lanza el error. Una cancelación se propaga sin reintentar.
 * Devuelve `null` si no hay jugada (partida terminada).
 */
export async function requestMachineMove(engine: EngineLike, game: Game, level: Level): Promise<MachineMove | null> {
  try {
    return await askOnce(engine, game, level);
  } catch (error) {
    if (error instanceof EngineCancelledError) throw error;
    return askOnce(engine, game, level);
  }
}

/** ¿Hasta qué jugada se puede deshacer? La primera en la que le toca a la persona (0 si empieza ella, 1 si empieza la máquina). */
export function minPly(game: Game, player: "w" | "b"): number {
  return game.firstMover === player ? 0 : 1;
}

/** Jugada a la que lleva «Deshacer»: la de la máquina y la tuya, sin parar en un turno de la máquina. */
export function undoTarget(game: Game, player: "w" | "b"): number | null {
  const floor = minPly(game, player);
  if (game.ply <= floor) return null;
  const target = game.turn === player ? game.ply - 2 : game.ply - 1;
  return Math.max(floor, target);
}

/** Jugada a la que lleva «Rehacer»: la tuya y la respuesta de la máquina, si ya estaba hecha. */
export function redoTarget(game: Game, player: "w" | "b"): number | null {
  if (!game.canRedo) return null;
  const target = game.turn === player ? game.ply + 2 : game.ply + 1;
  return Math.min(target, game.totalPlies);
}

/** Tras ir a una jugada cualquiera (restaurar, rehacer), ajusta para no dejar el tablero en turno de la máquina si se puede. */
export function normalizePly(game: Game, player: "w" | "b"): void {
  if (game.turn !== player && game.ply > minPly(game, player) && game.canRedo) game.goTo(game.ply + 1);
}
