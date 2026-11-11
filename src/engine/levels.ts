// Niveles de dificultad de Alfil Beta.
//
// - Fácil: mira una jugada (más la quietud) y elige al azar entre las que
//   quedan a menos de `marginCp` de la mejor. Nunca deja escapar un mate en 1.
// - Medio: profundidad 3, como mucho 0,5 s.
// - Difícil: profundización iterativa durante 0,9 s.
import { createRandom } from "../core/index.js";
import type { Position } from "../core/index.js";
import { MATE_SCORE, scoreMoves, search } from "./search.js";
import type { SearchOptions, SearchResult } from "./search.js";

export type Level = "facil" | "medio" | "dificil";

export interface LevelSettings {
  readonly maxDepth: number;
  readonly timeMs: number;
  /** Margen del azar controlado en centipeones; 0 = siempre la mejor jugada. */
  readonly marginCp: number;
}

export const LEVELS: Readonly<Record<Level, LevelSettings>> = Object.freeze({
  facil: Object.freeze({ maxDepth: 1, timeMs: 1000, marginCp: 150 }),
  medio: Object.freeze({ maxDepth: 3, timeMs: 500, marginCp: 0 }),
  dificil: Object.freeze({ maxDepth: 64, timeMs: 900, marginCp: 0 }),
});

/** ¿Es un nombre de nivel? Seguro con cualquier valor (no mira el prototipo). */
export function isLevel(value: unknown): value is Level {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LEVELS, value);
}

export interface ChooseOptions extends SearchOptions {
  /** Generador de enteros de 32 bits para el azar del nivel fácil. Por defecto, con semilla aleatoria. */
  readonly random?: () => number;
}

/** Elige la jugada de la máquina en `position` según el nivel. Misma advertencia que `search` sobre `position`. */
export function chooseMove(position: Position, level: Level, options: ChooseOptions = {}): SearchResult {
  if (!isLevel(level)) throw new RangeError(`Nivel desconocido: ${String(level)}`);
  const settings = LEVELS[level];
  if (settings.marginCp === 0) return search(position, settings, options);

  const scored = scoreMoves(position, settings.maxDepth, options);
  if (scored.length === 0) return search(position, settings, options); // sin jugadas: null y la puntuación
  const best = Math.max(...scored.map((m) => m.score));
  // Un mate se juega siempre; si no, cualquiera de las jugadas cercanas a la mejor.
  const candidates =
    best > MATE_SCORE - 1_000
      ? scored.filter((m) => m.score === best)
      : scored.filter((m) => m.score >= best - settings.marginCp);
  const random = options.random ?? createRandom(crypto.getRandomValues(new Uint32Array(1))[0]!);
  const chosen = candidates[random() % candidates.length]!;
  // Los nodos de este modo no se cuentan: son pocos y no dicen nada del nivel.
  return { best: chosen.uci, score: chosen.score, depth: settings.maxDepth, nodes: 0, pv: [chosen.uci] };
}
