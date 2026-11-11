// Coach en la interfaz: qué jugada se revisa, qué se enseña de cada informe y
// cómo se marcan las casillas. Sin DOM: se prueba en Node. El panel que lo
// pinta está en coach-panel.ts; el cálculo, en el Worker del coach.
import type { Color } from "../core/index.js";
import type { CoachReport, Evaluation, Finding, SquareMark, Verdict } from "../coach/index.js";
import type { Game } from "./game.js";
import { historyUci } from "./machine.js";
import type { Mark } from "./board.js";
import { sanToSpanish } from "./notation.js";

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
    return { ply, fen: game.startFen, moves: moves.slice(0, ply - 1), move: moves[ply - 1]!, label: moveLabel(game, ply) };
  }
  return null;
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
  readonly before: EvaluationView;
  readonly after: EvaluationView;
  readonly findings: readonly FindingView[];
}

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
    best: report.best.uci === report.move.uci ? null : sanToSpanish(report.best.san),
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
  empty: "Todavía no hay jugadas que revisar. Cuando muevas, el coach te dirá cómo ha ido.",
  reviewingTitle: "Revisando tu jugada.",
  reviewingText: "Alfil Beta está comparando la evaluación antes y después.",
  reviewingHint: "Puedes seguir jugando mientras tanto.",
  failedTitle: "No se ha podido revisar la jugada.",
  failedText: "Puedes seguir jugando. El coach lo intentará con la próxima.",
  noWarnings: "No hay avisos en esta jugada.",
  legend: "Valores en peones. La marca central es la igualdad; lo claro es ventaja blanca.",
  show: "Ver en el tablero",
  hide: "Quitar del tablero",
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
