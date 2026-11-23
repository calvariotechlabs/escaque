// Repaso de la partida (diseño: docs/design/design-system/components/Review y
// lienzo «Repaso …»): qué jugadas hay, qué se dibuja en la curva, qué errores
// son clave, el resumen por bando y los textos. Sin DOM: se prueba en Node.
// Los informes de cada jugada son los del coach (`CoachReport`); la pantalla
// que lo pinta está en review-screen.ts.
import type { Color, GameStatus } from "../core/index.js";
import type { CoachReport, Evaluation, Verdict } from "../coach/index.js";
import { pawns } from "../coach/text.js";
import { reportView, type ReviewJob } from "./coach.js";
import type { Game } from "./game.js";
import { ENGINE_NAME, statusMessage } from "./notation.js";

/** Una jugada de la partida que se repasa. */
export interface ReviewMove {
  /** Media jugada (1 = la primera de la partida). */
  readonly ply: number;
  readonly color: Color;
  /** Número de la jugada («14» en «14. Th2»). */
  readonly number: number;
  /** SAN en español. */
  readonly san: string;
  /** «14. Th2» (blancas) o «10... f6» (negras), como en el diseño. */
  readonly label: string;
  readonly from: string;
  readonly to: string;
  /** Posición después de la jugada. */
  readonly fenAfter: string;
  /** Petición para el Worker del coach. */
  readonly job: ReviewJob;
}

/** Informes ya recibidos, por media jugada. */
export type Reports = ReadonlyMap<number, CoachReport>;

/** Forma de la marca: triángulo (error o error grave) o círculo discontinuo (imprecisión). */
export type Marker = "error" | "imprecision";

const SIDE: Readonly<Record<Color, string>> = { w: "blancas", b: "negras" };

/** Todas las jugadas de la partida, también las que se pueden rehacer. */
export function reviewMoves(game: Game): ReviewMove[] {
  const all = game.allMoves;
  const uci = all.map((m) => `${m.from}${m.to}${m.promotion ?? ""}`);
  const moves: ReviewMove[] = [];
  for (const row of game.moveList()) {
    for (const entry of [row.white, row.black]) {
      if (entry === null) continue;
      const record = all[entry.ply - 1]!;
      const label = record.color === "w" ? `${row.number}. ${entry.san}` : `${row.number}... ${entry.san}`;
      moves.push({
        ply: entry.ply,
        color: record.color,
        number: row.number,
        san: entry.san,
        label,
        from: record.from,
        to: record.to,
        fenAfter: record.fenAfter,
        job: { ply: entry.ply, fen: game.startFen, moves: uci.slice(0, entry.ply - 1), move: uci[entry.ply - 1]!, label, previous: false },
      });
    }
  }
  return moves;
}

/** Texto oculto que precede al veredicto: «14. Th2, blancas. ». */
export function spokenPrefix(move: ReviewMove): string {
  return `${move.label}, ${SIDE[move.color]}. `;
}

const MARKER: Readonly<Record<Verdict, Marker | null>> = {
  mejor: null,
  buena: null,
  imprecision: "imprecision",
  error: "error",
  "error-grave": "error",
};

const MARKER_TEXT: Readonly<Record<Verdict, string>> = {
  mejor: "",
  buena: "",
  imprecision: "imprecisión",
  error: "error",
  "error-grave": "error grave",
};

/** Marca de una jugada en la lista y su texto para lectores de pantalla, o `null` si no lleva. */
export function listMarker(report: CoachReport | undefined): { readonly marker: Marker; readonly text: string } | null {
  if (report === undefined) return null;
  const marker = MARKER[report.verdict];
  return marker === null ? null : { marker, text: MARKER_TEXT[report.verdict] };
}

/** Una fila de «Errores clave» o de las imprecisiones. */
export interface ReviewItem {
  readonly ply: number;
  readonly label: string;
  /** «Error grave». */
  readonly title: string;
  readonly side: string;
  /** «+3,1 → +7,6». */
  readonly evaluation: string;
  readonly marker: Marker;
}

/** Errores clave (errores y errores graves) e imprecisiones, en el orden de la partida. */
export function keyMoments(moves: readonly ReviewMove[], reports: Reports): { key: ReviewItem[]; minor: ReviewItem[] } {
  const key: ReviewItem[] = [];
  const minor: ReviewItem[] = [];
  for (const move of moves) {
    const report = reports.get(move.ply);
    const marker = report === undefined ? null : MARKER[report.verdict];
    if (report === undefined || marker === null) continue;
    const view = reportView(report, move.label);
    const item: ReviewItem = {
      ply: move.ply,
      label: move.label,
      title: report.title,
      side: SIDE[move.color],
      evaluation: `${view.before.value} → ${view.after.value}`,
      marker,
    };
    (marker === "error" ? key : minor).push(item);
  }
  return { key, minor };
}

/** Media jugada del error clave siguiente (`dir` = 1) o anterior (−1) a `ply`, o `null` si no lo hay. */
export function stepKeyError(ply: number, key: readonly { readonly ply: number }[], dir: 1 | -1): number | null {
  if (dir === 1) return key.find((k) => k.ply > ply)?.ply ?? null;
  for (let i = key.length - 1; i >= 0; i--) if (key[i]!.ply < ply) return key[i]!.ply;
  return null;
}

export type Tally = Record<Color, Record<Verdict, number>>;

/** Cuántas jugadas de cada veredicto tiene cada bando. */
export function tally(moves: readonly ReviewMove[], reports: Reports): Tally {
  const empty = (): Record<Verdict, number> => ({ mejor: 0, buena: 0, imprecision: 0, error: 0, "error-grave": 0 });
  const counts: Tally = { w: empty(), b: empty() };
  for (const move of moves) {
    const report = reports.get(move.ply);
    if (report !== undefined) counts[move.color][report.verdict]++;
  }
  return counts;
}

/** Siguiente jugada que hay que analizar: la seleccionada si falta; si no, la primera que falte. `null` si están todas. */
export function nextToAnalyze(moves: readonly ReviewMove[], reports: Reports, selected: number): number | null {
  if (moves.some((m) => m.ply === selected) && !reports.has(selected)) return selected;
  return moves.find((m) => !reports.has(m.ply))?.ply ?? null;
}

/** Cuántas jugadas seguidas, desde la primera, están ya revisadas. */
function reviewedPrefix(moves: readonly ReviewMove[], reports: Reports): number {
  let count = 0;
  while (count < moves.length && reports.has(moves[count]!.ply)) count++;
  return count;
}

// --- Curva -------------------------------------------------------------------

/** Mismas medidas que el lienzo: 640 × 200, igualdad en 100 y 18 de margen arriba y abajo. */
const WIDTH = 640;
const HEIGHT = 200;
const MIDDLE = 100;
const SPAN = 82;
const EDGE = 16;
/** Pendiente de la curva logística del coach: la curva usa su misma escala (puntos esperados). */
const SLOPE = 0.00368208;

const expected = (cp: number): number => 1 / (1 + Math.exp(-SLOPE * cp));
const yOf = (evaluation: Evaluation): number => MIDDLE - SPAN * (2 * expected(evaluation.cp) - 1);
const xOf = (ply: number, total: number): number => EDGE + (ply * (WIDTH - 2 * EDGE)) / total;
const fixed = (n: number): string => n.toFixed(1);

/** Posición horizontal de una media jugada, en % del ancho (para el cursor y las marcas). */
export function curveLeft(ply: number, total: number): number {
  return (xOf(ply, total) / WIDTH) * 100;
}

export interface CurveMark {
  readonly ply: number;
  readonly marker: Marker;
  /** Bando que hizo la jugada: relleno claro (blancas) u oscuro (negras). */
  readonly color: Color;
  /** % del ancho y del alto del lienzo. */
  readonly left: number;
  readonly top: number;
}

export interface CurveView {
  /** Trazado (`d`) del área clara, ventaja blanca. */
  readonly area: string;
  /** Trazado de lo que falta por revisar, o `null` si ya está todo. */
  readonly pending: string | null;
  /** Dónde empieza el rayado de lo pendiente, en % del ancho, o `null`. */
  readonly veil: number | null;
  readonly marks: readonly CurveMark[];
  /** Números de jugada bajo la curva. */
  readonly axis: readonly { readonly text: string; readonly left: number }[];
}

/** Lo que se dibuja de la curva con los informes recibidos hasta ahora. */
export function curveView(moves: readonly ReviewMove[], reports: Reports): CurveView {
  const total = Math.max(1, moves.length);
  const done = reviewedPrefix(moves, reports);
  const first = moves[0] === undefined ? undefined : reports.get(moves[0].ply);
  const startY = first === undefined ? MIDDLE : yOf(first.before);
  const points: string[] = [`L0 ${fixed(startY)}`, `L${fixed(xOf(0, total))} ${fixed(startY)}`];
  let lastX = xOf(0, total);
  let lastY = startY;
  const marks: CurveMark[] = [];
  for (const move of moves.slice(0, done)) {
    const report = reports.get(move.ply)!;
    lastX = xOf(move.ply, total);
    lastY = yOf(report.after);
    points.push(`L${fixed(lastX)} ${fixed(lastY)}`);
    const marker = MARKER[report.verdict];
    if (marker !== null) marks.push({ ply: move.ply, marker, color: move.color, left: (lastX / WIDTH) * 100, top: (lastY / HEIGHT) * 100 });
  }
  const complete = done === moves.length;
  if (complete) points.push(`L${fixed(WIDTH)} ${fixed(lastY)}`, `L${fixed(WIDTH)} ${HEIGHT}`);
  else points.push(`L${fixed(lastX)} ${HEIGHT}`);
  const area = `M0 ${HEIGHT} ${points.join(" ")} Z`;
  const pending = complete ? null : `M${fixed(lastX)} ${fixed(MIDDLE)} L${fixed(WIDTH - EDGE)} ${fixed(MIDDLE)}`;
  return { area, pending, veil: complete ? null : (lastX / WIDTH) * 100, marks, axis: axisLabels(moves, total) };
}

/** Un número cada 5 jugadas; en partidas largas, cada 10, 20 o 50, para que quepan. */
function axisLabels(moves: readonly ReviewMove[], total: number): { text: string; left: number }[] {
  const last = moves[moves.length - 1]?.number ?? 0;
  const step = [5, 10, 20, 50, 100].find((s) => last / s <= 8) ?? 100;
  const labels: { text: string; left: number }[] = [];
  for (const move of moves) {
    // Cada número una vez, en la primera media jugada que lo lleva (la de las blancas, salvo al empezar con negras).
    if (move.number % step !== 0 || labels.some((l) => l.text === String(move.number))) continue;
    labels.push({ text: String(move.number), left: curveLeft(move.ply, total) });
  }
  return labels;
}

// --- Textos ------------------------------------------------------------------

/** «+15,9», «−0,5» o «0,0». */
function signed(cp: number): string {
  const value = pawns(cp);
  return value === "0,0" ? value : `${cp > 0 ? "+" : "−"}${value}`;
}

/** Mayor ventaja de cada bando (sin contar los mates) y tras qué jugada. */
function peaks(moves: readonly ReviewMove[], reports: Reports): { w: { cp: number; label: string } | null; b: { cp: number; label: string } | null } {
  let w: { cp: number; label: string } | null = null;
  let b: { cp: number; label: string } | null = null;
  for (const move of moves) {
    const after = reports.get(move.ply)?.after;
    if (after === undefined) continue;
    if (after.mate !== null) continue;
    // Con empate gana la más tardía: «tras» la jugada que la deja así por última vez se lee mejor.
    if (after.cp > 0 && (w === null || after.cp >= w.cp)) w = { cp: after.cp, label: move.label };
    if (after.cp < 0 && (b === null || after.cp <= b.cp)) b = { cp: after.cp, label: move.label };
  }
  return { w, b };
}

/** Ventaja que no se nombra: por debajo de medio peón se habla de igualdad. */
const NOTABLE = 50;

/** Resumen escrito de la curva (su `aria-label`). */
export function curveLabel(moves: readonly ReviewMove[], reports: Reports, status: GameStatus): string {
  const intro = "Curva de evaluación de la partida, vista por las blancas.";
  const done = reviewedPrefix(moves, reports);
  if (done < moves.length) return `${intro} Revisadas ${done} de ${moves.length} jugadas; el resto sigue pendiente.`;
  const parts = [intro];
  const start = moves[0] === undefined ? undefined : reports.get(moves[0].ply)?.before;
  if (start !== undefined) {
    parts.push(
      Math.abs(start.cp) < NOTABLE ? "Empieza en igualdad." : `Empieza con ventaja de las ${SIDE[start.cp > 0 ? "w" : "b"]}: ${signed(start.cp)}.`,
    );
  }
  const { w, b } = peaks(moves, reports);
  if (w !== null && w.cp >= NOTABLE) parts.push(`La mayor ventaja de las blancas es ${signed(w.cp)} tras ${w.label}.`);
  if (b !== null && b.cp <= -NOTABLE) parts.push(`La mayor ventaja de las negras es ${signed(b.cp)} tras ${b.label}.`);
  const last = moves[moves.length - 1];
  if (status.kind === "checkmate" && last !== undefined) parts.push(`Acaba con jaque mate de las ${SIDE[status.winner]} en la jugada ${last.number}.`);
  else if (status.kind !== "ongoing") parts.push(`Acaba en ${statusMessage(status, "w", false).charAt(0).toLowerCase()}${statusMessage(status, "w", false).slice(1)}`);
  const errors = moves.filter((m) => MARKER[reports.get(m.ply)!.verdict] !== null).length;
  parts.push(errors === 0 ? "No hay jugadas con imprecisión o error." : `Hay ${errors} ${errors === 1 ? "jugada" : "jugadas"} con imprecisión o error.`);
  return parts.join(" ");
}

/** Frase final del pie de la curva: la mayor ventaja de la partida, o `null` si no hubo ninguna notable. */
export function curveNote(moves: readonly ReviewMove[], reports: Reports, status: GameStatus): string | null {
  const { w, b } = peaks(moves, reports);
  const mate = status.kind === "checkmate";
  const best = w !== null && (b === null || w.cp >= -b.cp) ? { ...w, side: "blanca" } : b !== null ? { ...b, side: "negra" } : null;
  if (best === null || Math.abs(best.cp) < NOTABLE) return null;
  return `Máxima ventaja ${best.side}${mate ? " antes del mate" : ""}: ${signed(best.cp)} tras ${best.label}.`;
}

/** Texto de la cabecera: cómo acabó y cuántas jugadas se revisan. */
export function reviewIntro(status: GameStatus, total: number, analyzed: number): string {
  const result =
    status.kind === "checkmate" ? `Ganan las ${SIDE[status.winner]} por jaque mate.` : status.kind === "ongoing" ? "" : statusMessage(status, "w", false);
  const what = total === 1 ? "la jugada" : `las ${total} jugadas`;
  const review =
    analyzed >= total
      ? `${ENGINE_NAME} ha revisado ${what}. Elige una jugada o salta de error en error.`
      : `${ENGINE_NAME} está revisando ${what}. Ya puedes recorrer las que estén listas.`;
  return result === "" ? review : `${result} ${review}`;
}

/** Progreso del análisis: «Jugada 24 de 53.». */
export function progressText(analyzed: number, total: number): string {
  return `Jugada ${analyzed} de ${total}.`;
}

/** Textos fijos de la pantalla. */
export const REVIEW_TEXT = {
  title: "Repaso de la partida",
  selected: "Jugada seleccionada",
  analyzingTitle: "Analizando la partida",
  analyzingNote: "Ya puedes recorrer las jugadas revisadas. Las demás aparecerán en cuanto estén listas.",
  stop: "Parar el análisis",
  stoppedNote: "Has parado el análisis. Las jugadas que faltan no tienen veredicto.",
  resume: "Seguir con el análisis",
  reviewing: "Revisando esta jugada.",
  reviewingText: "Revisando esta jugada. La posición ya está en el tablero y el veredicto llega en unos segundos.",
  notReviewed: "Esta jugada no está revisada. Sigue con el análisis para ver su veredicto.",
  failedMove: "No se pudo revisar esta jugada.",
  keyNote: "Errores y errores graves de los dos bandos, en el orden de la partida.",
  noKey: "No hay errores clave. Ninguna jugada cambió el rumbo de la partida.",
  noKeyYet: "Todavía no hay errores clave en las jugadas revisadas.",
  listNote: "Triángulo: error. Círculo discontinuo: imprecisión.",
  curveCaption:
    "Valores en peones, vistos por las blancas: arriba, ventaja blanca; abajo, ventaja negra. La línea discontinua es la igualdad. Marca clara: jugada de las blancas; marca oscura: de las negras. Bajo la curva, el número de jugada.",
  failedTitle: "No se pudo revisar la partida.",
  failedText: `${ENGINE_NAME} no ha podido analizar las jugadas. Tu partida sigue guardada en este dispositivo.`,
  retry: "Reintentar",
} as const;
