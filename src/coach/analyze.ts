// Coach: explica una jugada ya hecha.
//
// 1. Alfil Beta valora la posición antes de la jugada (con su mejor jugada) y
//    la jugada hecha, a la misma profundidad. La diferencia se pasa a «puntos
//    esperados» (de 0 a 1) con una curva logística, como hacen los analizadores
//    habituales: perder un peón en una posición igualada pesa mucho más que
//    perderlo ganando por una torre. Esa caída da el veredicto.
// 2. Tres detectores buscan errores concretos y los explican:
//    - mate en 1 que se escapó (se prueban todas las jugadas),
//    - pieza que queda colgando (intercambio estático en cada casilla propia),
//    - captura que ganaba material y no se vio (intercambio estático de cada
//      captura, confirmado por el motor).
//    Los dos últimos solo se dan si el motor también ve que la jugada pierde
//    material: así no se señala un sacrificio bueno ni un cambio igualado.
//
// No depende de la interfaz: devuelve datos y textos en español, con la forma
// del panel del coach aprobado en docs/design (veredicto, mejor jugada,
// evaluación antes y después, y avisos con casillas para marcar). Sirve igual
// para partidas contra la máquina y a dos: habla de tú a quien ha movido y de
// «las blancas» y «las negras» en la evaluación.
import { Position, moveToUci } from "../core/index.js";
import type { Color, Move, PieceType, Square } from "../core/index.js";
import { MATE_SCORE, PIECE_VALUES, TranspositionTable, search } from "../engine/index.js";
import type { SearchLimits, SearchOptions } from "../engine/index.js";
import { capturedValue, cheapestCapture, exchangeGain, moveBalance } from "./exchange.js";
import {
  agree,
  joinPhrases,
  ofPiece,
  pawns,
  pieceName,
  pieceOn,
  pronoun,
  side,
  spanishSan,
  withArticle,
} from "./text.js";

/** Calificación de la jugada, de mejor a peor. */
export type Verdict = "mejor" | "buena" | "imprecision" | "error" | "error-grave";

/**
 * Evaluación de una posición, vista por las blancas (como la barra del panel).
 */
export interface Evaluation {
  /** Centipeones a favor de las blancas (negativo: a favor de las negras). Un mate cuenta como ±10 000. */
  readonly cp: number;
  /** Mate forzado: quién lo da y en cuántas jugadas suyas (0 = la partida ya acabó en mate). `null` si no hay. */
  readonly mate: { readonly winner: Color; readonly moves: number } | null;
  /** «+0,3 a favor de las blancas», «−5,8 a favor de las negras», «Mate en 1 para las blancas», «0,0, igualdad». */
  readonly text: string;
}

/** Jugada en UCI y en SAN inglesa (como la da el núcleo; la interfaz la pasa a letras españolas). */
export interface MoveInfo {
  readonly uci: string;
  readonly san: string;
}

/** Marca para «Ver en el tablero»: mismos nombres que las marcas del tablero. */
export interface SquareMark {
  /** Casilla, como «h5». */
  readonly square: string;
  readonly mark: "selected" | "capture";
}

interface FindingBase {
  /** Título del aviso: «Pieza colgando». */
  readonly title: string;
  /** Una o dos frases que lo explican. */
  readonly message: string;
  /** Para el `aria-label` del botón: «Ver en el tablero: » + label («dama colgando en h5»). */
  readonly label: string;
  /** Casillas que marca «Ver en el tablero». */
  readonly marks: readonly SquareMark[];
}

/** Error concreto que ha encontrado un detector. */
export type Finding =
  | (FindingBase & {
      /** Había un mate en una jugada y no se dio. */
      readonly kind: "mate-en-1";
      /** Una de las jugadas que daban mate. */
      readonly move: MoveInfo;
    })
  | (FindingBase & {
      /** Tras la jugada, el rival gana material capturando una pieza propia. */
      readonly kind: "pieza-colgando";
      readonly piece: PieceType;
      /** Casilla de la pieza («h5»). */
      readonly square: string;
      /** Pieza del rival que la ataca (la de menos valor). */
      readonly attacker: { readonly piece: PieceType; readonly square: string };
      /** Captura con la que el rival empieza a ganar material. */
      readonly capture: MoveInfo;
      /** ¿La defiende alguna pieza propia? */
      readonly defended: boolean;
      /** Material que gana el rival, en centipeones, contando las recapturas. */
      readonly gain: number;
    })
  | (FindingBase & {
      /** Antes de la jugada había una captura que ganaba material. */
      readonly kind: "captura-gratis";
      /** Pieza que se podía capturar y su casilla. */
      readonly piece: PieceType;
      readonly square: string;
      /** Pieza propia que capturaba. */
      readonly attacker: PieceType;
      readonly capture: MoveInfo;
      /** ¿Nadie podía recuperar la pieza que capturaba? */
      readonly free: boolean;
      /** Material que ganaba, en centipeones, contando las recapturas. */
      readonly gain: number;
    });

export interface CoachReport {
  /** Bando que hizo la jugada. */
  readonly color: Color;
  readonly move: MoveInfo;
  /** Mejor jugada según Alfil Beta. Si es la misma que `move`, el panel no la muestra. */
  readonly best: MoveInfo;
  /** Evaluación antes de la jugada, suponiendo que se juega la mejor. */
  readonly before: Evaluation;
  /** Evaluación después de la jugada hecha. */
  readonly after: Evaluation;
  /** Centipeones que pierde quien movió respecto a la mejor jugada (0 o más; un mate cuenta como 10 000). */
  readonly loss: number;
  readonly verdict: Verdict;
  /** Nombre del veredicto, sin punto: «Error grave». El panel muestra «Error grave.» y luego `summary`. */
  readonly title: string;
  /** Frase corta con punto final: «Cf3 deja escapar el mate y deja la dama sin protección.» */
  readonly summary: string;
  /** Avisos, del más importante al menos. Vacío si no hay ninguno. */
  readonly findings: readonly Finding[];
  /** Profundidad de la búsqueda usada. */
  readonly depth: number;
}

export interface AnalyzeOptions {
  /**
   * Límites de la búsqueda de la posición de antes. Por defecto, `COACH_LIMITS`.
   * Las búsquedas de la jugada hecha van luego a la profundidad alcanzada, sin
   * reloj, para comparar a la misma distancia. Sin `timeMs`, el análisis es determinista.
   */
  readonly limits?: SearchLimits;
  /** Reloj en milisegundos para la búsqueda. Por defecto, `performance.now`. */
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

/** Profundidad 4, y como mucho 0,6 s en la búsqueda de la posición de antes. */
export const COACH_LIMITS: Readonly<Required<SearchLimits>> = Object.freeze({ maxDepth: 4, timeMs: 600 });

/** Puntuaciones por encima (en valor absoluto) son mates. Igual que en el motor. */
const MATE_BOUND = MATE_SCORE - 1_000;
/** Un mate cuenta como esta ventaja al calcular la pérdida. */
const MATE_CP = 10_000;
/** Material mínimo (en centipeones) para hablar de pieza colgando o captura que gana. */
const MIN_GAIN = PIECE_VALUES.p;
/** Pérdida mínima que el motor tiene que confirmar para dar esos dos avisos. */
const MIN_LOSS = 80;
/** Cuántas capturas candidatas se comprueban con el motor, como mucho. */
const MAX_CAPTURE_CHECKS = 2;
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

const SUMMARIES: Readonly<Record<Verdict, string>> = {
  mejor: "Es la jugada que elige Alfil Beta.",
  buena: "La diferencia con la mejor jugada es pequeña.",
  imprecision: "Hay una jugada mejor y pierdes un poco de ventaja.",
  error: "Hay una jugada bastante mejor y pierdes ventaja.",
  "error-grave": "Hay una jugada mucho mejor y la partida cambia de rumbo.",
};

const FINDING_TITLES = {
  "mate-en-1": "Mate en 1 que se escapó",
  "pieza-colgando": "Pieza colgando",
  "captura-gratis": "Captura gratis no vista",
} as const;

const squareName = (square: Square): string => "abcdefgh"[square & 7]! + String((square >> 4) + 1);
const opposite = (color: Color): Color => (color === "w" ? "b" : "w");

/** Puntuación del motor → centipeones, con los mates como ±MATE_CP. */
const toCp = (score: number): number => (score > MATE_BOUND ? MATE_CP : score < -MATE_BOUND ? -MATE_CP : score);

/** Puntos esperados (0 = pierde, 1 = gana) para una ventaja en centipeones. */
const expected = (cp: number): number => 1 / (1 + Math.exp(-SLOPE * cp));

/** Puntuación del rival (tras la jugada) vista desde quien la hizo: cambia el signo y suma una media jugada a los mates. */
const fromReply = (score: number): number =>
  score > MATE_BOUND ? -(score - 1) : score < -MATE_BOUND ? -(score + 1) : score === 0 ? 0 : -score;

/**
 * Puntuación del motor (para `mover`, medida `plyOffset` medias jugadas antes
 * de la posición que se describe) → evaluación vista por las blancas.
 * La de antes de la jugada usa 0; la de después, 1.
 */
export function toEvaluation(score: number, mover: Color, plyOffset = 0): Evaluation {
  const white = mover === "w" ? 1 : -1;
  if (Math.abs(score) > MATE_BOUND) {
    const winner = score > 0 ? mover : opposite(mover);
    const moves = Math.ceil(Math.max(0, MATE_SCORE - Math.abs(score) - plyOffset) / 2);
    const text = moves === 0 ? `Jaque mate: ganan ${side(winner)}` : `Mate en ${moves} para ${side(winner)}`;
    return { cp: (winner === "w" ? 1 : -1) * MATE_CP, mate: { winner, moves }, text };
  }
  const cp = score * white === 0 ? 0 : score * white;
  const value = pawns(cp);
  const text = value === "0,0" ? "0,0, igualdad" : `${cp > 0 ? "+" : "−"}${value} a favor de ${side(cp > 0 ? "w" : "b")}`;
  return { cp, mate: null, text };
}

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
  const searchOptions: SearchOptions = { table: new TranspositionTable(), ...(options.now ? { now: options.now } : {}) };

  // Detectores sobre la posición de antes, que necesitan sus jugadas legales:
  // van antes de buscar, porque la búsqueda invalida las listas. Las jugadas
  // se comparan por UCI: cada `legalMoves()` crea objetos nuevos.
  const mates = mateInOne(position);
  const playedMates = mates.includes(moveInfo.uci);
  const captures = winningCaptures(position);
  const playedBalance = moveBalance(position, position.moveFromUci(moveInfo.uci)!);

  // Antes: la mejor jugada y su puntuación.
  const beforeSearch = search(position, options.limits ?? COACH_LIMITS, searchOptions);
  const bestUci = beforeSearch.best!;
  const beforeScore = beforeSearch.score;
  // La jugada hecha (y las capturas a comprobar) se miran una media jugada menos,
  // sin reloj: así todas llegan igual de lejos que la búsqueda de antes.
  const replyLimits: SearchLimits = { maxDepth: Math.max(1, beforeSearch.depth - 1) };

  // Después: la puntuación de la jugada hecha.
  const isBest = bestUci === moveInfo.uci;
  const playedScore = isBest ? beforeScore : scoreMove(position, moveInfo.uci, replyLimits, searchOptions);
  const loss = Math.max(0, toCp(beforeScore) - toCp(playedScore));
  const drop = isBest ? 0 : expected(toCp(beforeScore)) - expected(toCp(playedScore));
  let verdict: Verdict = isBest || loss === 0 ? "mejor" : (THRESHOLDS.find(([limit]) => drop >= limit)?.[1] ?? "buena");

  const findings: Finding[] = [];
  if (mates.length > 0 && !playedMates) {
    findings.push(missedMate(position, mates[0]!, moveInfo, color));
    // Aunque quede un mate más largo, dejar escapar el mate en 1 nunca es la mejor jugada.
    if (verdict === "mejor" || verdict === "buena") verdict = "imprecision";
  }

  if (loss >= MIN_LOSS && !playedMates) {
    const hanging = hangingPiece(position, moveInfo.uci, color, playedBalance);
    if (hanging !== null) findings.push(hanging);

    // Captura que ganaba más que la jugada hecha y que el motor confirma.
    if (mates.length === 0) {
      const candidates = captures.filter((c) => c.capture.uci !== moveInfo.uci && c.gain > playedBalance);
      for (const capture of candidates.slice(0, MAX_CAPTURE_CHECKS)) {
        const score = scoreMove(position, capture.capture.uci, replyLimits, searchOptions);
        if (toCp(score) - toCp(playedScore) < MIN_LOSS) continue;
        findings.push(capture);
        break; // con la de más ganancia basta
      }
    }
  }

  return {
    color,
    move: moveInfo,
    best: info(position, bestUci),
    before: toEvaluation(beforeScore, color, 0),
    after: toEvaluation(playedScore, color, 1),
    loss,
    verdict,
    title: TITLES[verdict],
    summary: summarize(verdict, moveInfo, playedMates, findings),
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

/** UCI y SAN de una jugada legal en `position` (objeto de jugada o UCI). */
function info(position: Position, move: Move | string): MoveInfo {
  const legal = typeof move === "string" ? position.moveFromUci(move) : move;
  if (legal === null) throw new CoachError(`Jugada no legal: ${String(move).slice(0, 10)}`);
  return { uci: moveToUci(legal), san: position.moveToSan(legal) };
}

/** Puntuación (para quien mueve en `position`) de hacer `uci`. Deja `position` como estaba. */
function scoreMove(position: Position, uci: string, limits: SearchLimits, options: SearchOptions): number {
  position.makeMove(position.moveFromUci(uci)!);
  try {
    const status = position.status();
    if (status.kind === "checkmate") return MATE_SCORE - 1;
    if (status.kind !== "ongoing") return 0; // tablas
    return fromReply(search(position, limits, options).score);
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

function missedMate(position: Position, uci: string, played: MoveInfo, color: Color): Finding {
  const mate = info(position, uci);
  const san = spanishSan(mate.san);
  return {
    kind: "mate-en-1",
    move: mate,
    title: FINDING_TITLES["mate-en-1"],
    message: `Con ${san} ganabas la partida en el acto. Con ${spanishSan(played.san)} el rey ${color === "w" ? "negro" : "blanco"} sigue vivo.`,
    label: `mate en 1 con ${san}`,
    marks: [
      { square: uci.slice(0, 2), mark: "selected" },
      { square: uci.slice(2, 4), mark: "capture" },
    ],
  };
}

/** ¿Puede el bando que mueve recapturar en `square` tras hacer `move`? Deja `position` como estaba. */
function canRecapture(position: Position, move: Move, square: Square): boolean {
  position.makeMove(move);
  const recapture = cheapestCapture(position, square);
  position.unmakeMove();
  return recapture !== null;
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
    const attacker = position.pieceAt(move.from)!.type;
    const free = !canRecapture(position, move, move.to);
    const capture = info(position, move);
    const square = squareName(victimSquare);
    const target = `${withArticle(piece)} de ${square} con ${withArticle(attacker)}`;
    const message = free
      ? `Podías capturar ${target} y nadie ${pronoun(piece)} recuperaba. No lo has visto.`
      : `Podías capturar ${target}: aunque el rival responda capturando, ganabas material. No lo has visto.`;
    found.push({
      kind: "captura-gratis",
      piece,
      square,
      attacker,
      capture,
      free,
      gain,
      title: FINDING_TITLES["captura-gratis"],
      message,
      label: `captura gratis en ${square}`,
      marks: [
        { square: squareName(move.from), mark: "selected" },
        { square, mark: "capture" },
      ],
    });
  }
  return found.sort((a, b) => b.gain - a.gain);
}

/**
 * Tras jugar `uci`, ¿qué pieza propia puede ganar el rival? La de más
 * ganancia; a igual ganancia, la que se acaba de mover. Para la pieza que se
 * acaba de mover cuenta el balance de la jugada (`playedBalance`): si capturó
 * algo, un cambio igualado no es una pieza colgando. Deja `position` como estaba.
 */
function hangingPiece(position: Position, uci: string, color: Color, playedBalance: number): Finding | null {
  const move = position.moveFromUci(uci)!;
  position.makeMove(move);
  try {
    if (position.status().kind !== "ongoing") return null;
    let best: { square: Square; gain: number } | null = null;
    for (let square = 0; square < 120; square++) {
      if (square & 0x88) continue;
      const piece = position.pieceAt(square);
      if (piece === null || piece.color !== color || piece.type === "k") continue;
      const gain = square === move.to ? Math.min(exchangeGain(position, square), -playedBalance) : exchangeGain(position, square);
      if (gain < MIN_GAIN) continue;
      if (best === null || gain > best.gain || (gain === best.gain && square === move.to)) best = { square, gain };
    }
    if (best === null) return null;

    const piece = position.pieceAt(best.square)!.type;
    const captureMove = cheapestCapture(position, best.square)!; // existe: hay ganancia
    const attacker = position.pieceAt(captureMove.from)!.type;
    const defended = canRecapture(position, captureMove, best.square);
    const capture = info(position, captureMove);
    const square = squareName(best.square);
    const attackerSquare = squareName(captureMove.from);
    const head = `Tu ${pieceName(piece)} de ${square} está ${agree("atacad", piece)} por ${pieceOn(attacker, opposite(color), attackerSquare)}`;
    const message = !defended
      ? `${head} y no ${pronoun(piece)} defiende ninguna pieza.`
      : PIECE_VALUES[attacker] < PIECE_VALUES[piece]
        ? `${head}, que vale menos: defender${pronoun(piece)} no basta.`
        : `${head} y no está bien ${agree("defendid", piece)}: hay más piezas atacándo${pronoun(piece)} que defendiéndo${pronoun(piece)}.`;
    return {
      kind: "pieza-colgando",
      piece,
      square,
      attacker: { piece: attacker, square: attackerSquare },
      capture,
      defended,
      gain: best.gain,
      title: FINDING_TITLES["pieza-colgando"],
      message,
      label: `${pieceName(piece)} colgando en ${square}`,
      marks: [
        { square: attackerSquare, mark: "selected" },
        { square, mark: "capture" },
      ],
    };
  } finally {
    position.unmakeMove();
  }
}

/** Frase del veredicto: con avisos, dice qué hace mal la jugada; si no, una frase según el veredicto. */
function summarize(verdict: Verdict, move: MoveInfo, mates: boolean, findings: readonly Finding[]): string {
  if (mates) return "Da jaque mate.";
  if (findings.length === 0) return SUMMARIES[verdict];
  const parts = findings.map((finding) => {
    switch (finding.kind) {
      case "mate-en-1":
        return "deja escapar el mate";
      case "pieza-colgando":
        return `deja ${withArticle(finding.piece)} ${finding.defended ? "en peligro" : "sin protección"}`;
      case "captura-gratis":
        return `no aprovecha la captura ${ofPiece(finding.piece)} de ${finding.square}`;
    }
  });
  return `${spanishSan(move.san)} ${joinPhrases(parts)}.`;
}
