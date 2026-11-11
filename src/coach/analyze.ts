// Coach: explica una jugada ya hecha.
//
// 1. Alfil Beta valora la posición antes de la jugada (con su mejor jugada) y
//    la jugada hecha, a la misma profundidad. La diferencia se pasa a «puntos
//    esperados» (de 0 a 1) con una curva logística, como hacen los analizadores
//    habituales: perder un peón en una posición igualada pesa mucho más que
//    perderlo ganando por una torre. Esa caída da el veredicto.
// 2. Tres detectores buscan errores concretos y los explican:
//    - mate en 1 que se escapó (búsqueda exhaustiva de una jugada),
//    - pieza que queda colgando (intercambio estático en cada casilla propia),
//    - captura que ganaba material y no se vio (intercambio estático de cada
//      captura, confirmado por el motor).
//    Los dos últimos solo se dan si el motor también ve que la jugada pierde
//    material: así no se señala un sacrificio bueno ni un cambio igualado.
//
// No depende de la interfaz: devuelve datos y textos en español.
import { Position, moveToUci } from "../core/index.js";
import type { Color, Move, PieceType, Square } from "../core/index.js";
import { MATE_SCORE, PIECE_VALUES, TranspositionTable, search } from "../engine/index.js";
import type { SearchLimits } from "../engine/index.js";
import { capturedValue, cheapestCapture, exchangeGain, moveBalance } from "./exchange.js";
import { defended, pieceName, spanishSan, withArticle } from "./text.js";

/** Calificación de la jugada, de mejor a peor. */
export type Verdict = "mejor" | "buena" | "imprecision" | "error" | "error-grave";

/**
 * Valoración desde el punto de vista de quien hizo la jugada.
 * - `{ kind: "cp", value }`: centipeones (100 = un peón de ventaja).
 * - `{ kind: "mate", moves }`: mate en `moves` jugadas propias; negativo si es
 *   el rival quien da mate.
 */
export type Evaluation = { readonly kind: "cp"; readonly value: number } | { readonly kind: "mate"; readonly moves: number };

/** Jugada en UCI (para la interfaz) y en SAN inglesa, como la da el núcleo. */
export interface MoveInfo {
  readonly uci: string;
  readonly san: string;
}

/** Error concreto que ha encontrado un detector. */
export type Finding =
  | {
      /** Había un mate en una jugada y no se dio. */
      readonly kind: "mate-en-1";
      /** Una de las jugadas que daban mate. */
      readonly move: MoveInfo;
      readonly message: string;
    }
  | {
      /** Tras la jugada, el rival gana material capturando una pieza propia. */
      readonly kind: "pieza-colgando";
      readonly piece: PieceType;
      /** Casilla de la pieza («e5»). */
      readonly square: string;
      /** Captura con la que el rival empieza a ganar material. */
      readonly capture: MoveInfo;
      /** Material que gana el rival, en centipeones, contando las recapturas. */
      readonly gain: number;
      readonly message: string;
    }
  | {
      /** Antes de la jugada había una captura que ganaba material. */
      readonly kind: "captura-gratis";
      readonly piece: PieceType;
      readonly square: string;
      readonly capture: MoveInfo;
      /** Material que ganaba, en centipeones, contando las recapturas. */
      readonly gain: number;
      /** ¿La pieza estaba sin defender (se ganaba entera)? */
      readonly free: boolean;
      readonly message: string;
    };

export interface CoachReport {
  /** Bando que hizo la jugada. */
  readonly color: Color;
  readonly move: MoveInfo;
  /** Mejor jugada según Alfil Beta (puede ser la misma que `move`). */
  readonly best: MoveInfo;
  /** Valoración antes de la jugada, suponiendo que se juega la mejor. */
  readonly before: Evaluation;
  /** Valoración con la jugada hecha. */
  readonly after: Evaluation;
  /** Centipeones perdidos respecto a la mejor jugada (0 o más; un mate cuenta como 10 000). */
  readonly loss: number;
  readonly verdict: Verdict;
  /** Nombre del veredicto para mostrar: «Error grave». */
  readonly title: string;
  /** Una o dos frases que resumen la jugada. */
  readonly summary: string;
  /** Errores concretos, del más importante al menos. Vacío si no hay ninguno. */
  readonly findings: readonly Finding[];
  /** Profundidad de la búsqueda usada. */
  readonly depth: number;
}

export interface AnalyzeOptions {
  /** Límites de cada búsqueda. Por defecto, `COACH_LIMITS`. Sin `timeMs`, el análisis es determinista. */
  readonly limits?: SearchLimits;
  /** Reloj en milisegundos para las búsquedas. Por defecto, `performance.now`. */
  readonly now?: () => number;
}

/** Partida a analizar: posición inicial y jugadas hechas desde ella en UCI. */
export interface CoachGame {
  readonly fen: string;
  readonly moves?: readonly string[];
}

/** Jugada o partida que no se puede analizar (ilegal, partida terminada…). */
export class CoachError extends Error {
  override name = "CoachError";
}

/** Profundidad 4, y como mucho 0,6 s por búsqueda (se hacen dos o tres). */
export const COACH_LIMITS: Readonly<Required<SearchLimits>> = Object.freeze({ maxDepth: 4, timeMs: 600 });

/** Puntuaciones por encima (en valor absoluto) son mates. Igual que en el motor. */
const MATE_BOUND = MATE_SCORE - 1_000;
/** Un mate cuenta como esta ventaja al calcular la pérdida. */
const MATE_CP = 10_000;
/** Material mínimo (en centipeones) para hablar de pieza colgando o captura que gana. */
const MIN_GAIN = PIECE_VALUES.p;
/** Pérdida mínima que el motor tiene que confirmar para dar esos dos avisos. */
const MIN_LOSS = 80;
/** Pendiente de la curva logística (la que usan los analizadores habituales). */
const SLOPE = 0.00368208;
/** Caídas de puntos esperados que marcan cada veredicto. */
const THRESHOLDS: readonly (readonly [number, Verdict])[] = [
  [0.15, "error-grave"],
  [0.1, "error"],
  [0.05, "imprecision"],
];

const TITLES: Readonly<Record<Verdict, string>> = {
  mejor: "Mejor jugada",
  buena: "Buena jugada",
  imprecision: "Imprecisión",
  error: "Error",
  "error-grave": "Error grave",
};

const squareName = (square: Square): string => "abcdefgh"[square & 7]! + String((square >> 4) + 1);

/** Puntuación del motor → valoración legible (mate en jugadas propias, no en medias jugadas). */
export function toEvaluation(score: number): Evaluation {
  if (score > MATE_BOUND) return { kind: "mate", moves: Math.ceil((MATE_SCORE - score) / 2) };
  if (score < -MATE_BOUND) return { kind: "mate", moves: -Math.ceil((MATE_SCORE + score) / 2) };
  return { kind: "cp", value: score };
}

/** Puntuación del motor → centipeones, con los mates como ±MATE_CP. */
const toCp = (score: number): number => (score > MATE_BOUND ? MATE_CP : score < -MATE_BOUND ? -MATE_CP : score);

/** Puntos esperados (0 = pierde, 1 = gana) para una ventaja en centipeones. */
const expected = (cp: number): number => 1 / (1 + Math.exp(-SLOPE * cp));

/** Puntuación del rival (tras la jugada) vista desde quien la hizo: cambia el signo y suma una media jugada a los mates. */
const fromReply = (score: number): number =>
  score > MATE_BOUND ? -(score - 1) : score < -MATE_BOUND ? -(score + 1) : score === 0 ? 0 : -score;

/**
 * Analiza la jugada `move` (UCI) hecha tras la partida `game`.
 *
 * Lanza `FenError` si la FEN no es válida y `CoachError` si alguna jugada no
 * es legal o la partida ya había terminado antes de `move`.
 */
export function analyzeMove(game: CoachGame, move: string, options: AnalyzeOptions = {}): CoachReport {
  const position = replay(game);
  if (position.status().kind !== "ongoing") throw new CoachError("La partida ya había terminado");
  if (typeof move !== "string") throw new CoachError("La jugada debe ser texto UCI");
  const played = position.moveFromUci(move);
  if (played === null) throw new CoachError(`Jugada no legal: ${move.slice(0, 10)}`);

  const color = position.turn;
  const moveInfo = info(position, played);
  const limits = options.limits ?? COACH_LIMITS;
  const searchOptions = { table: new TranspositionTable(), ...(options.now ? { now: options.now } : {}) };

  // Detectores sobre la posición de antes, que necesitan sus jugadas legales:
  // van antes de buscar, porque la búsqueda invalida las listas.
  // Se comparan por UCI: cada `legalMoves()` crea jugadas nuevas.
  const mates = mateInOne(position);
  const playedMates = mates.includes(moveInfo.uci);
  const captures = winningCaptures(position);
  const playedBalance = moveBalance(position, position.moveFromUci(moveInfo.uci)!);

  // Antes: la mejor jugada y su puntuación.
  const beforeSearch = search(position, limits, searchOptions);
  const bestUci = beforeSearch.best!;
  const beforeScore = beforeSearch.score;
  const replyLimits = replyLimitsFor(limits, beforeSearch.depth);

  // Después: la puntuación de la jugada hecha a la misma profundidad.
  const playedScore = bestUci === moveInfo.uci ? beforeScore : scoreMove(position, moveInfo.uci, replyLimits, searchOptions);
  const loss = Math.max(0, toCp(beforeScore) - toCp(playedScore));
  const drop = bestUci === moveInfo.uci ? 0 : expected(toCp(beforeScore)) - expected(toCp(playedScore));
  const verdict: Verdict =
    bestUci === moveInfo.uci || loss === 0 ? "mejor" : (THRESHOLDS.find(([limit]) => drop >= limit)?.[1] ?? "buena");

  const findings: Finding[] = [];
  if (mates.length > 0 && !playedMates) {
    const mate = info(position, mates[0]!);
    findings.push({ kind: "mate-en-1", move: mate, message: `Tenías mate en 1 con ${spanishSan(mate.san)}.` });
  }

  if (loss >= MIN_LOSS && !playedMates) {
    const hanging = hangingPiece(position, moveInfo.uci, color);
    if (hanging !== null) findings.push(hanging);

    // Captura que ganaba más que la jugada hecha y que el motor confirma.
    if (findings.every((f) => f.kind !== "mate-en-1")) {
      for (const capture of captures) {
        if (capture.capture.uci === moveInfo.uci || capture.gain <= playedBalance) continue;
        const score = scoreMove(position, capture.capture.uci, replyLimits, searchOptions);
        if (toCp(score) - toCp(playedScore) < MIN_LOSS) continue;
        findings.push(capture);
        break; // la de más ganancia basta
      }
    }
  }

  const best = info(position, bestUci);
  return {
    color,
    move: moveInfo,
    best,
    before: toEvaluation(beforeScore),
    after: toEvaluation(playedScore),
    loss,
    verdict,
    title: TITLES[verdict],
    summary: summarize(verdict, moveInfo, best, playedMates),
    findings,
    depth: beforeSearch.depth,
  };
}

/** Carga la partida y aplica sus jugadas. */
function replay(game: CoachGame): Position {
  if (typeof game !== "object" || game === null || typeof game.fen !== "string") {
    throw new CoachError("La partida necesita una FEN");
  }
  const moves = game.moves ?? [];
  if (!Array.isArray(moves)) throw new CoachError("Las jugadas deben ser una lista");
  const position = Position.fromFen(game.fen);
  for (const uci of moves) {
    const move = typeof uci === "string" ? position.moveFromUci(uci) : null;
    if (move === null) throw new CoachError(`Jugada no legal en la partida: ${String(uci).slice(0, 10)}`);
    position.makeMove(move);
  }
  return position;
}

/** UCI y SAN de una jugada legal en `position`. */
function info(position: Position, move: Move | string): MoveInfo {
  const legal = typeof move === "string" ? position.moveFromUci(move) : move;
  if (legal === null) throw new CoachError(`Jugada no legal: ${String(move)}`);
  return { uci: moveToUci(legal), san: position.moveToSan(legal) };
}

/** Las búsquedas de la jugada hecha van una media jugada menos: así miran igual de lejos. */
function replyLimitsFor(limits: SearchLimits, depth: number): SearchLimits {
  const maxDepth = Math.max(1, depth - 1);
  return limits.timeMs === undefined ? { maxDepth } : { maxDepth, timeMs: limits.timeMs };
}

/** Puntuación (para quien mueve en `position`) de hacer `uci`. Deja `position` como estaba. */
function scoreMove(position: Position, uci: string, limits: SearchLimits, options: Parameters<typeof search>[2]): number {
  const move = position.moveFromUci(uci)!;
  position.makeMove(move);
  try {
    const status = position.status();
    switch (status.kind) {
      case "checkmate":
        return MATE_SCORE - 1;
      case "ongoing":
        return fromReply(search(position, limits, options).score);
      default:
        return 0; // tablas
    }
  } finally {
    position.unmakeMove();
  }
}

/** Jugadas (UCI) que dan mate ya. */
function mateInOne(position: Position): string[] {
  const mates: string[] = [];
  for (const move of position.legalMoves()) {
    position.makeMove(move);
    if (position.isCheck() && position.status().kind === "checkmate") mates.push(moveToUci(move));
    position.unmakeMove();
  }
  return mates;
}

type CaptureFinding = Extract<Finding, { kind: "captura-gratis" }>;

/** Capturas que ganan al menos MIN_GAIN contando las recapturas, de más a menos ganancia. */
function winningCaptures(position: Position): CaptureFinding[] {
  const found: CaptureFinding[] = [];
  for (const move of position.legalMoves()) {
    const value = capturedValue(position, move);
    if (value === 0 || (move.promotion !== null && move.promotion !== "q")) continue;
    const gain = moveBalance(position, move);
    if (gain < MIN_GAIN) continue;
    const enPassant = position.pieceAt(move.to) === null;
    const victimSquare = enPassant ? move.to + (position.turn === "w" ? -16 : 16) : move.to;
    const piece = position.pieceAt(victimSquare)!.type;
    const capture = info(position, move);
    const free = gain >= value;
    const san = spanishSan(capture.san);
    const square = squareName(victimSquare);
    const message = free
      ? `Podías capturar gratis ${withArticle(piece)} de ${square} con ${san}: no estaba ${defended(piece)}.`
      : `Con ${san} ganabas material: capturabas ${withArticle(piece)} de ${square} y el rival no podía recuperarlo todo.`;
    found.push({ kind: "captura-gratis", piece, square, capture, gain, free, message });
  }
  return found.sort((a, b) => b.gain - a.gain);
}

/**
 * Tras jugar `uci`, ¿qué pieza propia puede ganar el rival? La de más
 * ganancia; a igual ganancia, la que se acaba de mover. Deja `position` como estaba.
 */
function hangingPiece(position: Position, uci: string, color: Color): Finding | null {
  const move = position.moveFromUci(uci)!;
  position.makeMove(move);
  try {
    if (position.status().kind !== "ongoing") return null;
    let best: { square: Square; gain: number } | null = null;
    for (let square = 0; square < 120; square++) {
      if (square & 0x88) continue;
      const piece = position.pieceAt(square);
      if (piece === null || piece.color !== color || piece.type === "k") continue;
      const gain = exchangeGain(position, square);
      if (gain < MIN_GAIN) continue;
      if (best === null || gain > best.gain || (gain === best.gain && square === move.to)) best = { square, gain };
    }
    if (best === null) return null;

    const piece = position.pieceAt(best.square)!.type;
    const capture = info(position, cheapestCapture(position, best.square)!); // existe: hay ganancia
    const square = squareName(best.square);
    const san = spanishSan(capture.san);
    const message =
      best.square === move.to
        ? `Tu ${pieceName(piece)} en ${square} queda colgando: el rival puede jugar ${san} y ganar material.`
        : `Tras tu jugada, tu ${pieceName(piece)} de ${square} queda colgando: el rival puede jugar ${san} y ganar material.`;
    return { kind: "pieza-colgando", piece, square, capture, gain: best.gain, message };
  } finally {
    position.unmakeMove();
  }
}

function summarize(verdict: Verdict, move: MoveInfo, best: MoveInfo, mates: boolean): string {
  const bestSan = spanishSan(best.san);
  if (mates) return "¡Jaque mate!";
  switch (verdict) {
    case "mejor":
      return `${spanishSan(move.san)} es la mejor jugada.`;
    case "buena":
      return `Buena jugada. Alfil Beta prefería ${bestSan}, pero la diferencia es pequeña.`;
    case "imprecision":
      return `Imprecisión: pierdes algo de ventaja. Era mejor ${bestSan}.`;
    case "error":
      return `Error: ${bestSan} era bastante mejor.`;
    case "error-grave":
      return `Error grave: cambia el rumbo de la partida. Había que jugar ${bestSan}.`;
  }
}
