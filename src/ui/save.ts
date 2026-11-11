// Guardado de la partida en el dispositivo (localStorage), sin DOM ni dependencias.
// Lo que se lee del almacenamiento no es de confianza: otra pestaña, una versión
// vieja o el propio usuario pueden haberlo cambiado. Por eso no se acepta nada
// que no se pueda volver a jugar de verdad con las reglas del núcleo.
import type { Color, PromotionPiece } from "../core/index.js";
import { Game } from "./game.js";

export const STORAGE_KEY = "escaque:partida";
const VERSION = 1;
/** Tope de jugadas y de tamaño: una partida real queda muy por debajo. */
const MAX_MOVES = 5000;
const MAX_RAW_LENGTH = 100_000;
const MAX_FEN_LENGTH = 100;
const MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

/** Lo mínimo que necesitamos de `localStorage`; así se prueba sin navegador. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface RestoredGame {
  readonly game: Game;
  readonly orientation: Color;
}

/** Texto JSON de la partida: FEN inicial, jugadas («e2e4», «e7e8q»), índice actual y orientación. */
export function serializeGame(game: Game, orientation: Color): string {
  return JSON.stringify({
    v: VERSION,
    fen: game.startFen,
    moves: game.allMoves.map((m) => `${m.from}${m.to}${m.promotion ?? ""}`),
    ply: game.ply,
    orientation,
  });
}

/** Reconstruye la partida, o `null` si el texto no es una partida guardada válida. */
export function restoreGame(raw: unknown): RestoredGame | null {
  if (typeof raw !== "string" || raw.length > MAX_RAW_LENGTH) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const { v, fen, moves, ply, orientation } = data as Record<string, unknown>;
  if (v !== VERSION) return null;
  if (typeof fen !== "string" || fen.length > MAX_FEN_LENGTH) return null;
  if (!Array.isArray(moves) || moves.length > MAX_MOVES) return null;
  if (typeof ply !== "number" || !Number.isInteger(ply) || ply < 0 || ply > moves.length) return null;
  if (orientation !== "w" && orientation !== "b") return null;

  let game: Game;
  try {
    game = new Game(fen);
  } catch {
    return null;
  }
  for (const move of moves) {
    if (typeof move !== "string" || !MOVE.test(move)) return null;
    const promotion = move.length === 5 ? (move[4] as PromotionPiece) : undefined;
    if (game.play(move.slice(0, 2), move.slice(2, 4), promotion) === null) return null;
  }
  try {
    game.goTo(ply);
  } catch {
    return null;
  }
  return { game, orientation };
}

/** Guarda la partida; si no hay almacenamiento o falla (cuota, modo privado), no pasa nada. */
export function saveToStorage(store: KeyValueStore | null, game: Game, orientation: Color): void {
  if (store === null) return;
  try {
    store.setItem(STORAGE_KEY, serializeGame(game, orientation));
  } catch {
    // La partida sigue en memoria; solo se pierde la recuperación.
  }
}

/** Guardado que evita reescribir lo mismo: `render()` se llama también al girar o seleccionar, sin cambios en la partida. */
export function createAutosave(store: KeyValueStore | null): (game: Game, orientation: Color) => void {
  let last: string | null = null;
  return (game, orientation) => {
    if (store === null) return;
    const text = serializeGame(game, orientation);
    if (text === last) return;
    last = text;
    saveToStorage(store, game, orientation);
  };
}

/** Lee la partida guardada. Una entrada corrupta se borra para no tropezar con ella cada vez. */
export function loadFromStorage(store: KeyValueStore | null): RestoredGame | null {
  if (store === null) return null;
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const restored = restoreGame(raw);
    if (restored === null) store.removeItem(STORAGE_KEY);
    return restored;
  } catch {
    return null;
  }
}

/** `localStorage` si el navegador deja usarlo (puede lanzar al acceder en modo privado o con datos bloqueados). */
export function browserStore(): KeyValueStore | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
