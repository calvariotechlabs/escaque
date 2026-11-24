// Coach en la interfaz: qué jugada se revisa, qué se enseña de cada informe y
// cómo se marcan las casillas. Sin DOM: se prueba en Node. El panel que lo
// pinta está en coach-panel.ts; el cálculo, en el Worker del coach.
import { Position } from "../core/index.js";
import type { Color } from "../core/index.js";
import type { CoachReport, Evaluation, Finding, Hint, SquareMark, Verdict } from "../coach/index.js";
import type { Game } from "./game.js";
import { historyUci } from "./machine.js";
import type { Mark } from "./board.js";
import { ENGINE_NAME, sanToSpanish } from "./notation.js";

/** Qué revisa el coach: la última jugada de la persona a la altura de la partida en pantalla. */
export interface ReviewJob {
  /** Media jugada revisada (1 = la primera de la partida). */
  readonly ply: number;
  /** Partida ANTES de la jugada, como la pide el Worker. */
  readonly fen: string;
  readonly moves: readonly string[];
  readonly move: string;
  /** «4. Cf3» o «3… Cf6». */
  readonly label: string;
  /** Contra la máquina, tu jugada ya no es la última de la partida: la máquina ha respondido y la revisión es de la anterior. */
  readonly previous: boolean;
}

/**
 * Jugada que revisa el coach: la última hecha en pantalla. Contra la máquina
 * (`player` es tu color) solo se revisan tus jugadas, así que si la última es
 * suya se revisa la tuya anterior. En partida a dos (`player` = `null`) se
 * revisa siempre la última. `null` si aún no hay nada que revisar.
 */
export function reviewJob(game: Game, player: Color | null): ReviewJob | null {
  const history = game.history;
  for (let ply = history.length; ply >= 1; ply--) {
    if (player !== null && history[ply - 1]!.color !== player) continue;
    const moves = historyUci(game);
    return { ply, fen: game.startFen, moves: moves.slice(0, ply - 1), move: moves[ply - 1]!, label: moveLabel(game, ply), previous: player !== null && ply < history.length };
  }
  return null;
}

/** Nota del panel cuando la revisión es de tu jugada anterior (CAL-390). `yourTurn`: la partida sigue y te toca mover. */
export function previousNote(yourTurn: boolean): string {
  const base = `${ENGINE_NAME} ya ha respondido. Esta revisión es de tu jugada anterior.`;
  return yourTurn ? `${base} Ahora te toca mover.` : base;
}

/** Clave para guardar el informe de una jugada: la misma partida y la misma jugada dan el mismo informe. */
export function reviewKey(job: ReviewJob): string {
  return `${job.fen}|${job.moves.join(" ")}|${job.move}`;
}

/** Jugada con su número, en español: «4. Cf3» (blancas) o «3… Cf6» (negras). */
export function moveLabel(game: Game, ply: number): string {
  for (const row of game.moveList()) {
    if (row.white?.ply === ply) return `${row.number}. ${row.white.san}`;
    if (row.black?.ply === ply) return `${row.number}… ${row.black.san}`;
  }
  return "";
}

/** Lo que el panel enseña de un informe, ya en español y sin decisiones que tomar. */
export interface ReportView {
  readonly label: string;
  /** «Error grave.» */
  readonly verdictTitle: string;
  /** «Cf3 deja escapar el mate…» */
  readonly verdictText: string;
  readonly severity: "grave" | "dudosa" | "buena";
  /** Mejor jugada en español; `null` si es la que se hizo. */
  readonly best: string | null;
  /** Por qué es mejor (CAL-394); vacío si no hay alternativa. */
  readonly why: string;
  /** Línea de Alfil Beta: «5. Cxe5 dxe5 6. Dxg4 Cf6». */
  readonly line: string;
  /** Flecha de la mejor jugada (en la posición de antes); `null` si es la que se hizo. */
  readonly bestArrow: SquareMove | null;
  /** Flecha de la jugada hecha. */
  readonly playedArrow: SquareMove;
  readonly before: EvaluationView;
  readonly after: EvaluationView;
  readonly findings: readonly FindingView[];
}

/** Origen y destino de una jugada, por nombre de casilla. */
export interface SquareMove {
  readonly from: string;
  readonly to: string;
}

const squaresOf = (uci: string): SquareMove => ({ from: uci.slice(0, 2), to: uci.slice(2, 4) });

export interface EvaluationView {
  /** «+0,3» o «Mate en 1»: la parte que va en mono. */
  readonly value: string;
  /** « a favor de las blancas» (con el espacio inicial). */
  readonly rest: string;
  /** Anchura de la barra, de 0 a 100: lo claro es ventaja blanca. */
  readonly percent: number;
}

export interface FindingView {
  readonly kind: Finding["kind"];
  readonly title: string;
  readonly message: string;
  /** SAN en español que hay que destacar dentro del mensaje, si la hay. */
  readonly san: string | null;
  readonly label: string;
  readonly marks: readonly SquareMark[];
}

const SEVERITY: Readonly<Record<Verdict, ReportView["severity"]>> = {
  mejor: "buena",
  buena: "buena",
  imprecision: "dudosa",
  error: "grave",
  "error-grave": "grave",
};

/** Barra de la evaluación: arcotangente suave, para que +1 y +6 no se confundan. 50 = igualdad; los mates llenan o vacían. */
export function barPercent(evaluation: Pick<Evaluation, "cp" | "mate">): number {
  if (evaluation.mate !== null) return evaluation.mate.winner === "w" ? 100 : 0;
  const percent = 50 + 50 * (2 / Math.PI) * Math.atan(evaluation.cp / 300);
  return Math.round(Math.min(98, Math.max(2, percent)));
}

/** Parte con el valor y parte con el resto del texto de una evaluación («+0,3» + « a favor de las blancas»). */
function evaluationView(evaluation: Evaluation): EvaluationView {
  const text = evaluation.text;
  const split = evaluation.mate !== null ? text.match(/^(Mate en \d+)(.*)$/) : text.match(/^([+−]?\d+,\d)(.*)$/);
  const value = split?.[1] ?? text;
  const rest = split?.[2] ?? "";
  return { value, rest: rest.replace(/^,/, ""), percent: barPercent(evaluation) };
}

export function reportView(report: CoachReport, label: string): ReportView {
  return {
    label,
    verdictTitle: `${report.title}.`,
    verdictText: report.summary,
    severity: SEVERITY[report.verdict],
    // La decisión de enseñar otra jugada es del coach (RC-01): con jugadas equivalentes no hay alternativa.
    best: report.alternative === null ? null : sanToSpanish(report.alternative.san),
    why: report.alternative === null ? "" : report.why,
    line: report.line,
    bestArrow: report.alternative === null ? null : squaresOf(report.alternative.uci),
    playedArrow: squaresOf(report.move.uci),
    before: evaluationView(report.before),
    after: evaluationView(report.after),
    findings: report.findings.map((f) => ({
      kind: f.kind,
      title: f.title,
      message: f.message,
      san: f.kind === "mate-en-1" ? sanToSpanish(f.move.san) : null,
      label: f.label,
      marks: f.marks,
    })),
  };
}

/** Textos de los estados sin informe. */
export const COACH_TEXT = {
  title: "Coach",
  emptyTitle: "El coach espera tu primera jugada.",
  emptyText: "Cuando muevas, te dirá cómo ha ido y qué había mejor.",
  reviewingTitle: "Revisando tu jugada.",
  reviewingText: "Alfil Beta está comparando la evaluación antes y después.",
  reviewingHint: "Puedes seguir jugando mientras tanto.",
  failedTitle: "No se ha podido revisar la jugada.",
  failedText: "Puedes seguir jugando. El coach lo intentará con la próxima.",
  noWarnings: "No hay avisos en esta jugada.",
  legend: "Valores en peones. La marca central es la igualdad; lo claro es ventaja blanca.",
  show: "Ver en el tablero",
  hide: "Quitar del tablero",
  previousTag: "Jugada anterior",
  // Coach mejorado (CAL-394)
  bestPrefix: "Mejor jugada: ",
  whyPrefix: "Por qué: ",
  linePrefix: "Línea de Alfil Beta: ",
  returnToGame: "Volver a la partida",
  hintsTitle: "Pista para tu jugada",
  hintIntro: "Una idea para la jugada que te toca, sin decirte cuál es.",
  hintBusy: "Buscando una idea…",
  hintWaiting: "Alfil Beta está pensando. Podrás pedir una pista cuando te toque.",
  hintFailed: "No se ha podido preparar la pista. Prueba otra vez.",
  hintNoMore: "No quedan más pistas",
  hintArrow: " Mira la flecha.",
  previousMove: "Tu jugada: ",
  reviewedMove: "Jugada revisada: ",
} as const;

/** Suma a las marcas del tablero las del aviso activo, sin repetir. */
export function withCoachMarks(base: ReadonlyMap<string, readonly Mark[]>, extra: readonly SquareMark[]): Map<string, Mark[]> {
  const merged = new Map<string, Mark[]>();
  for (const [square, marks] of base) merged.set(square, [...marks]);
  for (const { square, mark } of extra) {
    const list = merged.get(square);
    if (list === undefined) merged.set(square, [mark]);
    else if (!list.includes(mark)) list.push(mark);
  }
  return merged;
}

/** Posición de antes de la jugada revisada y la jugada que llevó a ella (para la vista con flechas, CAL-394). */
export function reviewPosition(job: ReviewJob): { readonly fen: string; readonly lastMove: SquareMove | null } {
  const position = Position.fromFen(job.fen);
  for (const uci of job.moves) {
    const move = position.moveFromUci(uci);
    if (move === null) break;
    position.makeMove(move);
  }
  const last = job.moves[job.moves.length - 1];
  return { fen: position.toFen(), lastMove: last === undefined ? null : squaresOf(last) };
}

/** Texto de la vista de la posición de antes (aviso sobre el tablero y nombre de la rejilla). */
export function reviewViewText(label: string): { readonly title: string; readonly text: string; readonly grid: string } {
  return {
    title: `Posición antes de tu jugada ${label}`,
    text: "Mira la flecha: así seguía mejor la partida. No puedes mover hasta volver.",
    grid: `Tablero de ajedrez, posición antes de ${label}`,
  };
}

/** Pistas pedidas en la posición actual (CAL-394). */
export interface HintsState {
  /** Pistas enseñadas: de 0 a 3. */
  readonly shown: number;
  readonly hint: Hint | null;
  readonly pending: boolean;
  readonly failed: boolean;
}

export const HINTS_TOTAL = 3;
export const NO_HINTS: HintsState = Object.freeze({ shown: 0, hint: null, pending: false, failed: false });

/** `available`: te toca mover. `waiting`: piensa la máquina. `hidden`: partida terminada. */
export type HintsAvailability = "available" | "waiting" | "hidden";

export interface HintsView {
  readonly visible: boolean;
  readonly note: string | null;
  readonly items: readonly string[];
  readonly busy: boolean;
  /** `disabled`: se pinta con aria-disabled, no con `disabled`, para que el botón no pierda el foco. */
  readonly button: { readonly text: string; readonly disabled: boolean } | null;
}

export function hintsView(state: HintsState, availability: HintsAvailability): HintsView {
  if (availability === "hidden") return { visible: false, note: null, items: [], busy: false, button: null };
  if (availability === "waiting") return { visible: true, note: COACH_TEXT.hintWaiting, items: [], busy: false, button: null };
  // Mientras se prepara, el botón sigue ahí (inactivo) para que quien lo pulsó no pierda el foco.
  if (state.pending) return { visible: true, note: COACH_TEXT.hintBusy, items: [], busy: true, button: { text: `Pedir pista 1 de ${HINTS_TOTAL}`, disabled: true } };
  const hint = state.hint;
  const items: string[] = [];
  if (hint !== null) {
    const all = [hint.idea, hint.piece, hint.play + COACH_TEXT.hintArrow];
    items.push(...all.slice(0, state.shown));
  }
  const note = state.failed ? COACH_TEXT.hintFailed : items.length === 0 ? COACH_TEXT.hintIntro : null;
  const button =
    items.length >= HINTS_TOTAL
      ? { text: COACH_TEXT.hintNoMore, disabled: true }
      : { text: `Pedir pista ${items.length + 1} de ${HINTS_TOTAL}`, disabled: false };
  return { visible: true, note, items, busy: false, button };
}

/** Marcas de las pistas en la posición actual: la 2 marca la pieza y la 3 añade la flecha. */
export function hintMarks(state: HintsState): { readonly marks: readonly SquareMark[]; readonly arrow: SquareMove | null } {
  const hint = state.hint;
  if (hint === null || state.shown < 2) return { marks: [], arrow: null };
  return { marks: [{ square: hint.from, mark: "selected" }], arrow: state.shown >= 3 ? { from: hint.from, to: hint.to } : null };
}
