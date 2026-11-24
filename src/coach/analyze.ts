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
// 3. Una sola decisión (`decide`, RC-01 de la Release Candidate) fija el
//    veredicto, la categoría (mate, táctica, material, posicional o sin
//    evidencia), si se enseña otra jugada, la frase y el «por qué». Los mates se
//    comparan por distancia; dos jugadas a 10 centipeones o menos son
//    equivalentes; lo que permite la jugada hecha (la respuesta del rival) se
//    explica si la línea lo prueba, y si no hay un hecho que lo respalde el
//    texto dice lo que el coach no sabe. `checkInvariants` (invariants.ts)
//    comprueba que el resultado no se contradiga.
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
import { explainMove, hintForPosition, lineCaptures, lineGain, lineText, refutationOf } from "./explain.js";
import type { Hint, Motive } from "./explain.js";
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
 * De qué trata el informe (RC-01), por orden de importancia:
 * - `mate`: hay un mate forzado en juego (se da, se permite, se escapa o ya no se evita);
 * - `tactica`: un ataque doble o una clavada comprobados en la línea del motor;
 * - `material`: se gana o se pierde material comprobado (línea o aviso del motor);
 * - `posicional`: la diferencia es de evaluación y en las líneas nadie gana material;
 * - `sin-evidencia`: el motor ve una diferencia que el coach no sabe explicar;
 * - `correcta`: la jugada es la mejor o equivalente a ella.
 */
export type Category = "correcta" | "mate" | "tactica" | "material" | "posicional" | "sin-evidencia";

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
  /** Primera opción de Alfil Beta (puede ser la jugada hecha). */
  readonly best: MoveInfo;
  /**
   * Jugada que el panel enseña como «Mejor jugada»: `null` si la hecha es la
   * mejor o vale lo mismo (veredicto «mejor»). Nunca es la jugada hecha.
   */
  readonly alternative: MoveInfo | null;
  /** Evaluación antes de la jugada, suponiendo que se juega la mejor. */
  readonly before: Evaluation;
  /** Evaluación después de la jugada hecha. */
  readonly after: Evaluation;
  /** Centipeones que pierde quien movió respecto a la mejor jugada (0 o más; un mate cuenta como 10 000). */
  readonly loss: number;
  readonly verdict: Verdict;
  readonly category: Category;
  /** Nombre del veredicto, sin punto: «Error grave». El panel muestra «Error grave.» y luego `summary`. */
  readonly title: string;
  /** Frase corta con punto final: «Cf3 deja escapar el mate y deja la dama sin protección.» */
  readonly summary: string;
  /** Avisos, del más importante al menos. Vacío si no hay ninguno. */
  readonly findings: readonly Finding[];
  /**
   * Por qué es mejor `alternative` (CAL-394), o qué permite la jugada hecha
   * (RC-02): «Cxe5 gana un peón…», «Tras g4, las negras dan mate en 1: 2… Dh4#.».
   * Vacío si no hay alternativa.
   */
  readonly why: string;
  /**
   * Línea de Alfil Beta desde la posición de antes, en SAN española: «5. Cxe5 dxe5 6. Dxg4 Cf6».
   * Empieza por `alternative` si la hay; si no, por la jugada hecha.
   */
  readonly line: string;
  /** Líneas del motor en UCI desde la posición de antes: la de su primera opción y la de la jugada hecha. */
  readonly lines: { readonly best: readonly string[]; readonly played: readonly string[] };
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

/**
 * Profundidad 4, y como mucho 3 s en la búsqueda de la posición de antes.
 *
 * La profundidad es lo que fija el veredicto; el reloj es solo una red de seguridad para
 * dispositivos lentísimos. Con un tope ajustado (antes 0,6 s) el mismo análisis dependía de
 * la máquina: un ejecutor de CI cargado se quedaba en profundidad 2-3, no veía Cxe5 en la
 * trampa de Légal y no daba alternativa. El análisis corre en un Worker, así que esperar no
 * bloquea la interfaz; en un equipo normal tarda unos 0,3 s.
 */
export const COACH_LIMITS: Readonly<Required<SearchLimits>> = Object.freeze({ maxDepth: 4, timeMs: 3000 });

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

const SUMMARIES = { mejor: "Es la jugada que elige Alfil Beta." } as const;

/** Principio de la frase de los veredictos con pérdida; sigue «: la valoración baja 0,6 peones.». */
const LOSS_HEAD: Readonly<Record<Verdict, string>> = {
  mejor: "",
  buena: "",
  imprecision: "Había una jugada mejor",
  error: "Había una jugada bastante mejor",
  "error-grave": "Había una jugada mucho mejor",
};

/**
 * Dos jugadas que puntúan a 10 centipeones o menos son equivalentes (H-02): a
 * la profundidad del coach esa diferencia es ruido, y decir «Mejor jugada:
 * otra» debajo de «Mejor jugada» se contradice.
 */
const EQUIVALENT_CP = 10;
/** Por encima de esta pérdida, sin material en las líneas, el coach no se atreve a llamarlo posicional. */
const POSITIONAL_MAX_CP = 150;
/** Medias jugadas que se completan en cada línea para buscar en ellas el motivo. */
const EVIDENCE_PLIES = 6;
/** Medias jugadas de más que se permiten para que una línea no acabe en mitad de un cambio. */
const EXTRA_CAPTURE_PLIES = 4;

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
  const playedLine = isBest ? { score: beforeScore, line: beforeSearch.pv, replyScore: null } : scoreLine(position, moveInfo.uci, replyLimits, searchOptions);
  const playedScore = playedLine.score;
  const loss = Math.max(0, toCp(beforeScore) - toCp(playedScore));
  const drop = isBest ? 0 : expected(toCp(beforeScore)) - expected(toCp(playedScore));

  const findings: Finding[] = [];
  if (mates.length > 0 && !playedMates) findings.push(missedMate(position, mates[0]!, moveInfo, color));
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

  // Las líneas que cortó la tabla de transposición se completan para poder
  // comprobar en ellas los motivos (la horquilla de 13.Dd3+ tras 12…Df6 venía
  // en una línea de una sola respuesta). Solo hace falta si hay otra jugada que
  // explicar; si no, se usan las líneas tal cual (como hasta ahora para el elogio).
  const extendDepth = Math.max(1, beforeSearch.depth - 1);
  const extend = (line: readonly string[], plies: number): string[] => extendLine(position, line, plies, extendDepth, searchOptions);

  const before = toEvaluation(beforeScore, color, 0);
  const after = toEvaluation(playedScore, color, 1);
  const decision = decide({
    position,
    color,
    move: moveInfo,
    best: info(position, bestUci),
    isBest,
    playedMates,
    beforeScore,
    playedScore,
    replyScore: playedLine.replyScore,
    loss,
    drop,
    findings,
    before,
    after,
    bestLine: beforeSearch.pv,
    playedLine: playedLine.line,
    extend,
    depth: beforeSearch.depth,
  });

  return {
    color,
    move: moveInfo,
    best: info(position, bestUci),
    alternative: decision.alternative,
    before,
    after,
    loss,
    verdict: decision.verdict,
    category: decision.category,
    title: TITLES[decision.verdict],
    summary: decision.summary,
    findings,
    why: decision.why,
    line: lineText(position, decision.alternative === null ? decision.lines.played : decision.lines.best),
    lines: decision.lines,
    depth: beforeSearch.depth,
  };
}

/** Lo que `decide` necesita saber de la jugada ya analizada. */
interface DecisionInput {
  readonly position: Position;
  readonly color: Color;
  readonly move: MoveInfo;
  readonly best: MoveInfo;
  readonly isBest: boolean;
  readonly playedMates: boolean;
  /** Puntuaciones del motor para quien mueve (mates como en el motor). */
  readonly beforeScore: number;
  readonly playedScore: number;
  /** Puntuación de la respuesta del rival para el rival; `null` si la jugada acaba la partida. */
  readonly replyScore: number | null;
  readonly loss: number;
  readonly drop: number;
  readonly findings: readonly Finding[];
  readonly before: Evaluation;
  readonly after: Evaluation;
  /** Líneas del motor (UCI, desde la posición de antes) de su primera opción y de la jugada hecha. */
  readonly bestLine: readonly string[];
  readonly playedLine: readonly string[];
  /** Completa una línea hasta `plies` medias jugadas (ver `extendLine`). */
  readonly extend: (line: readonly string[], plies: number) => string[];
  readonly depth: number;
}

interface Decision {
  readonly verdict: Verdict;
  readonly category: Category;
  readonly alternative: MoveInfo | null;
  readonly summary: string;
  readonly why: string;
  /** Las líneas en que se apoyan los textos. */
  readonly lines: { readonly best: readonly string[]; readonly played: readonly string[] };
}

const RANK: readonly Verdict[] = ["mejor", "buena", "imprecision", "error", "error-grave"];
/** El peor de dos veredictos. */
const worst = (a: Verdict, b: Verdict): Verdict => (RANK.indexOf(a) >= RANK.indexOf(b) ? a : b);

const isMateFor = (score: number): boolean => score > MATE_BOUND;
const isMateAgainst = (score: number): boolean => score < -MATE_BOUND;

/**
 * La decisión única del informe (RC-01): veredicto, categoría, si se enseña
 * otra jugada como mejor, la frase del veredicto y el «por qué». Todo sale de
 * aquí, en este orden de importancia: mate > táctica > material > posicional >
 * sin evidencia. Cada frase se apoya en un hecho comprobado (una puntuación de
 * mate, una captura de la línea, un aviso confirmado por el motor); si no lo
 * hay, el texto dice lo que el coach no sabe en lugar de inventar un motivo.
 * `checkInvariants` comprueba el resultado.
 */
function decide(input: DecisionInput): Decision {
  const { position, color, move, best, isBest, playedMates, beforeScore, playedScore, loss, findings, before, after } = input;
  const san = spanishSan(move.san);
  const bestSan = spanishSan(best.san);
  const lostAlready = isMateAgainst(beforeScore);
  const allowsMate = isMateAgainst(playedScore) && !lostAlready;
  const hadMate = isMateFor(beforeScore);
  const keepsMate = isMateFor(playedScore);

  // 1. Veredicto. Los mates se comparan por distancia, no con la curva.
  let verdict: Verdict;
  if (isBest) verdict = "mejor";
  else if (lostAlready || (hadMate && keepsMate)) verdict = playedScore >= beforeScore ? "mejor" : "buena";
  else if (!hadMate && loss <= EQUIVALENT_CP) verdict = "mejor";
  else verdict = THRESHOLDS.find(([limit]) => input.drop >= limit)?.[1] ?? "buena";
  // Un aviso confirmado por el motor, o dejar escapar un mate, nunca es «buena» ni «mejor».
  if (findings.length > 0 || (hadMate && !keepsMate)) verdict = worst(verdict, "imprecision");
  const alternative = verdict === "mejor" ? null : best;

  // 2. Motivos comprobados en las líneas del motor (completadas si hay que explicar otra jugada;
  //    la de la jugada hecha, una más, para que la respuesta del rival también tenga las suyas).
  const bestLine = alternative === null ? [...input.bestLine] : input.extend(input.bestLine, EVIDENCE_PLIES);
  const playedLine = alternative === null ? [...input.playedLine] : isBest ? bestLine : input.extend(input.playedLine, EVIDENCE_PLIES + 1);
  const bestMotive = alternative === null ? null : explainMove(position, best.uci, bestLine, beforeScore);
  const refutation =
    alternative === null || input.replyScore === null ? null : refutationOf(position, move.uci, playedLine, input.replyScore);
  // El elogio usa la línea del motor tal cual (sin completar), como antes de este bloque.
  const playedMotive = explainMove(position, move.uci, input.playedLine, playedScore);

  // Un motivo solo explica la diferencia si los hechos la respaldan:
  // - el material de la mejor jugada cuenta si su línea gana más que la de la jugada hecha
  //   (si las dos ganan lo mismo, no es la razón de preferirla);
  // - lo que gana el rival tras la jugada cuenta si la evaluación cae al menos eso (si cae
  //   mucho menos, hay compensación que el coach no sabe nombrar, o la línea no es fiable).
  const materialEdge = lineGain(position, bestLine) - lineGain(position, playedLine);
  const bestExplains =
    bestMotive !== null &&
    bestMotive.kind !== "posicional" &&
    (bestMotive.kind === "salva" || bestMotive.kind === "mate" || materialEdge >= MIN_GAIN);
  const refutes = refutation !== null && (refutation.kind === "mate" || refutation.net <= loss + MIN_GAIN) ? refutation : null;
  const quiet = findings.length === 0 && noMaterialChange(position, bestLine, playedLine) && loss < POSITIONAL_MAX_CP;

  // 3. «Por qué» (solo si se enseña otra jugada) y de dónde sale.
  let why = "";
  let source: "mate" | "best" | "refutation" | "posicional" | "ninguno" = "ninguno";
  if (alternative !== null) {
    const difference = `${short(before)} frente a ${short(after)}`;
    if (allowsMate && refutes !== null) [why, source] = [refutes.text, "mate"];
    else if (lostAlready) [why, source] = [`Con ${bestSan} el mate tardaba más: ${lower(before.text)} frente a ${lower(after.text)}.`, "mate"];
    else if (bestExplains) [why, source] = [sameMotive(bestMotive!, best, playedMotive, move, verdict === "buena" ? null : difference) ?? bestMotive!.text, "best"];
    else if (refutes !== null) [why, source] = [refutes.text, "refutation"];
    else if (findings.length > 0) why = `Mira los avisos: ahí está lo que pierde ${san}. Con ${bestSan}, ${difference}.`;
    else if (quiet) [why, source] = [`Alfil Beta la prefiere por cómo quedan las piezas: en las líneas que ha mirado nadie gana material (${difference}).`, "posicional"];
    else if (verdict === "buena") why = `Alfil Beta la prefiere por poco (${difference}) y no encuentra un motivo concreto que explicarte.`;
    else why = `Alfil Beta la valora mejor (${difference}) mirando ${input.depth} medias jugadas, pero no encuentra un motivo concreto que explicarte.`;
    // Si la respuesta solo recupera la pieza que se acaba de entregar, puede ser
    // un sacrificio cuya compensación queda más allá de lo que mira el coach (H-06).
    if (source === "refutation" && refutes!.sacrifice) {
      why += ` Si era un sacrificio, Alfil Beta no ve la compensación mirando ${input.depth} medias jugadas.`;
    }
  }

  // 4. Categoría: la del motivo que se enseña (o de los avisos).
  const mateInvolved = before.mate !== null || after.mate !== null || findings.some((f) => f.kind === "mate-en-1");
  const tactic = (kind: string): boolean => kind === "horquilla" || kind === "clavada";
  let category: Category;
  if (mateInvolved) category = "mate";
  else if (verdict === "mejor") category = "correcta";
  else if (source === "best") category = tactic(bestMotive!.kind) ? "tactica" : "material";
  else if (source === "refutation") category = tactic(refutes!.kind) ? "tactica" : "material";
  else if (findings.length > 0) category = "material";
  else if (source === "posicional") category = "posicional";
  else category = "sin-evidencia";

  // 5. Frase del veredicto.
  let summary: string;
  if (playedMates) summary = "Da jaque mate.";
  else if (allowsMate) summary = `${san} permite mate en ${after.mate!.moves}.`;
  else if (lostAlready) {
    summary =
      verdict === "mejor"
        ? `Ya no hay defensa: ninguna jugada evita el mate de ${side(opposite(color))}.`
        : `Ya no había defensa, pero ${bestSan} retrasaba el mate.`;
  } else if (hadMate && keepsMate) {
    summary = isBest
      ? "Es la jugada que elige Alfil Beta: lleva al mate."
      : verdict === "mejor"
        ? `Lleva al mate igual de rápido que ${bestSan}.`
        : `Sigue habiendo mate, pero más lento: con ${bestSan} era ${lower(before.text)}.`;
  } else if (findings.length > 0) summary = summarize(move, findings);
  else if (hadMate) summary = `${san} deja escapar ${lower(before.text).replace(/^mate/, "un mate")}.`;
  else if ((verdict === "mejor" || verdict === "buena") && refutes === null && playedMotive.kind !== "posicional" && playedMotive.kind !== "mate") {
    summary = playedMotive.text; // elogio con motivo, si el rival no tiene una respuesta que lo desmienta
  }
  else if (isBest) summary = SUMMARIES.mejor;
  else if (verdict === "mejor") summary = `Igual de buena que ${bestSan}, la que elige Alfil Beta.`;
  else if (verdict === "buena") {
    summary =
      loss < 100
        ? `Casi tan buena como la mejor: la diferencia es de ${pawns(loss)} peones.`
        : `Había una jugada mejor (la valoración baja ${pawns(loss)} peones), pero con la partida tan decidida cambia poco.`;
  } else summary = `${LOSS_HEAD[verdict]}: la valoración baja ${pawns(loss)} peones.`;

  return { verdict, category, alternative, summary, why, lines: { best: bestLine, played: playedLine } };
}

/**
 * Si la jugada hecha y la mejor tienen el mismo motivo («pone a salvo la dama
 * de g4»), el «por qué» no puede presentarlo como la diferencia: lo dice con
 * «también» y deja la diferencia en la evaluación (`difference`; `null` si es
 * pequeña). Devuelve `null` si los motivos difieren.
 */
function sameMotive(bestMotive: Motive, best: MoveInfo, playedMotive: Motive, move: MoveInfo, difference: string | null): string | null {
  if (playedMotive.kind !== bestMotive.kind) return null;
  const bestSan = spanishSan(best.san);
  const playedSan = spanishSan(move.san);
  if (!bestMotive.text.startsWith(`${bestSan} `) || !playedMotive.text.startsWith(`${playedSan} `)) return null;
  const rest = bestMotive.text.slice(bestSan.length + 1);
  if (rest !== playedMotive.text.slice(playedSan.length + 1)) return null;
  const head = `${bestSan} también ${rest.replace(/\.$/, "")}`;
  return difference === null ? `${head}, y Alfil Beta la prefiere por poco.` : `${head}, pero Alfil Beta la valora mejor (${difference}).`;
}

/** «Mate en 1 para las negras» → «mate en 1 para las negras». */
const lower = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);

/** Valor corto de una evaluación: «+1,7» o «mate en 1 de las negras». */
function short(evaluation: Evaluation): string {
  return evaluation.mate !== null
    ? `mate en ${evaluation.mate.moves} de ${side(evaluation.mate.winner)}`
    : evaluation.text.split(" ")[0]!.replace(/,$/, "");
}

/** ¿Ninguna de las dos líneas gana ni pierde material? */
function noMaterialChange(position: Position, bestLine: readonly string[], playedLine: readonly string[]): boolean {
  return lineCaptures(position, bestLine).length === 0 && lineCaptures(position, playedLine).length === 0;
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

/**
 * Completa una línea del motor hasta `plies` medias jugadas buscando desde su
 * final a profundidad `depth` (la búsqueda corta la línea principal cuando
 * acierta en la tabla de transposición). Se para si la partida acaba. Deja
 * `position` como estaba.
 */
function extendLine(position: Position, line: readonly string[], plies: number, depth: number, options: SearchOptions): string[] {
  const out: string[] = [];
  let played = 0;
  let lastCaptured = false;
  try {
    for (const uci of line) {
      const move = position.moveFromUci(uci);
      if (move === null) break;
      lastCaptured = capturedValue(position, move) > 0;
      out.push(uci);
      position.makeMove(move);
      played++;
    }
    // Hasta `plies`, y después mientras la última jugada sea una captura (con un
    // tope): una línea que acaba capturando cuenta mal el material.
    while ((out.length < plies || (lastCaptured && out.length < plies + EXTRA_CAPTURE_PLIES)) && position.status().kind === "ongoing") {
      const next = search(position, { maxDepth: depth }, options).best;
      if (next === null) break;
      const move = position.moveFromUci(next)!;
      lastCaptured = capturedValue(position, move) > 0;
      out.push(next);
      position.makeMove(move);
      played++;
    }
  } finally {
    for (let i = 0; i < played; i++) position.unmakeMove();
  }
  return out;
}

/** Puntuación (para quien mueve en `position`) de hacer `uci`. Deja `position` como estaba. */
function scoreMove(position: Position, uci: string, limits: SearchLimits, options: SearchOptions): number {
  return scoreLine(position, uci, limits, options).score;
}

/** Puntuación de hacer `uci` y la línea que sigue (empezando por `uci`). Deja `position` como estaba. */
function scoreLine(
  position: Position,
  uci: string,
  limits: SearchLimits,
  options: SearchOptions,
): { score: number; line: readonly string[]; replyScore: number | null } {
  position.makeMove(position.moveFromUci(uci)!);
  try {
    const status = position.status();
    if (status.kind === "checkmate") return { score: MATE_SCORE - 1, line: [uci], replyScore: null };
    if (status.kind !== "ongoing") return { score: 0, line: [uci], replyScore: null }; // tablas
    const reply = search(position, limits, options);
    return { score: fromReply(reply.score), line: [uci, ...reply.pv], replyScore: reply.score };
  } finally {
    position.unmakeMove();
  }
}

/**
 * Pistas para la jugada que toca en la partida `game` (CAL-394). Lanza
 * `FenError` si la FEN no es válida y `CoachError` si alguna jugada no es
 * legal o la partida ya ha terminado.
 */
export function hintFor(game: CoachGame, options: AnalyzeOptions = {}): Hint {
  const position = replay(game);
  if (position.status().kind !== "ongoing") throw new CoachError("La partida ya ha terminado");
  return hintForPosition(position, options.limits ?? COACH_LIMITS, options.now ? { now: options.now } : {});
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

/** Frase del veredicto cuando hay avisos: qué hace mal la jugada. */
function summarize(move: MoveInfo, findings: readonly Finding[]): string {
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
