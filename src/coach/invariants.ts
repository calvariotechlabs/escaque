// Invariantes del informe del coach (RC-01, CAL-408).
//
// Un informe es coherente si lo que dice cada parte del panel (veredicto,
// «Mejor jugada», «Por qué», avisos y evaluación) no contradice a las demás ni
// a las líneas del motor de las que sale. `checkInvariants` lo comprueba y
// devuelve la lista de violaciones (vacía si todo cuadra). Lo usan las pruebas
// y el banco de posiciones; no corre en la interfaz.
import { Position } from "../core/index.js";
import type { PieceType } from "../core/index.js";
import type { CoachGame, CoachReport } from "./analyze.js";
import { lineCaptures, materialPlies, shownPlies } from "./explain.js";
import { pawns } from "./text.js";

/** Misma tolerancia que el veredicto «mejor» para jugadas equivalentes. */
const EQUIVALENT_CP = 10;

const NOUNS: Readonly<Record<string, PieceType>> = {
  dama: "q",
  torre: "r",
  torres: "r",
  alfil: "b",
  alfiles: "b",
  caballo: "n",
  caballos: "n",
  "peón": "p",
  peones: "p",
};

/** «gana la dama», «se lleva el alfil», «gana dos peones»: piezas que el texto dice que se capturan. */
const PIECE_CLAIM = /\b(?:gana|se lleva)\s+(?:la|el|un|una|dos|tres|cuatro|cinco|seis|siete|ocho)\s+(dama|torres?|alfil(?:es)?|caballos?|peón|peones)\b/g;

/**
 * Comprueba las invariantes de `report`, el informe de una jugada hecha tras
 * la partida `game` (la misma que recibió `analyzeMove`). Devuelve una frase
 * por cada violación.
 */
export function checkInvariants(report: CoachReport, game: CoachGame): string[] {
  const out: string[] = [];
  const opponent = report.color === "w" ? "b" : "w";
  const shown = `${report.summary} ${report.why}`;
  const all = [report.summary, report.why, ...report.findings.map((f) => f.message)].join(" ");

  // 1. «Mejor jugada» y otra jugada como mejor no van juntas.
  if ((report.verdict === "mejor") !== (report.alternative === null)) {
    out.push(`veredicto «${report.verdict}» con alternativa ${report.alternative?.san ?? "ninguna"}`);
  }
  if (report.alternative !== null && report.alternative.uci === report.move.uci) out.push("la alternativa es la jugada hecha");
  if (report.alternative !== null && report.why === "") out.push("hay alternativa pero no hay «por qué»");
  if (report.summary.includes("elige Alfil Beta") && report.best.uci !== report.move.uci && !report.summary.startsWith("Igual de buena")) {
    out.push("dice que Alfil Beta la elige y no es su primera opción");
  }

  // 2. Con un aviso, un mate o un motivo concreto, nunca «no hay un motivo táctico».
  if (/no hay (?:un )?motivo táctico/i.test(all)) out.push("dice que no hay un motivo táctico");

  // 3. Con mate en contra tras la jugada, ni elogios ni «la diferencia es pequeña».
  if (report.after.mate !== null && report.after.mate.winner === opponent) {
    if (report.category !== "mate") out.push(`mate en contra con categoría «${report.category}»`);
    if (!/mate/i.test(report.summary)) out.push("mate en contra y la frase del veredicto no lo dice");
    if (/\bgana\b|pone a salvo|diferencia .*pequeña|casi tan buena/i.test(shown)) out.push("elogia o resta importancia con mate en contra");
  }

  // 4. Ninguna pieza ganada que la línea no capture de verdad.
  const position = replay(game, out);
  const captured = position === null ? new Set<PieceType>() : capturedTypes(report, position, out);
  for (const match of shown.matchAll(PIECE_CLAIM)) {
    const type = NOUNS[match[1]!]!;
    if (!captured.has(type)) out.push(`«${match[0]}» y ninguna línea captura esa pieza`);
  }

  // 4b. La línea del panel llega hasta la última captura que cuenta el texto (H-08).
  if (position !== null) {
    const panelLine = report.alternative === null ? report.lines.played : report.lines.best;
    const needed = shownPlies(position, panelLine);
    const inPanel = report.line.split(" ").filter((token) => token !== "" && !/^\d+[.…]$/.test(token)).length;
    if (inPanel < needed) out.push(`la línea del panel enseña ${inPanel} medias jugadas y el material se cuenta en ${needed}`);
  }

  // 4c. Si el «por qué» cuenta la respuesta del rival, el panel enseña la línea de tu jugada
  //     hasta lo que cuenta el texto, con esa respuesta como respuesta clave (issue #87).
  //     Un mate largo se cuenta sin línea («Tras X, las negras tienen mate en 7.»): no nombra respuesta.
  const tellsReply = report.alternative !== null && /^Tras \S+, /.test(report.why) && !/ mate en \d+\.$/.test(report.why);
  const own = report.refutationLine;
  if (tellsReply && own === null) out.push("el «por qué» cuenta la respuesta del rival y falta la línea de tu jugada");
  if (!tellsReply && own !== null) out.push("hay línea de tu jugada y el «por qué» no cuenta la respuesta del rival");
  if (tellsReply && own !== null) {
    const reply = own.moves[own.key];
    if (own.key !== 1 || reply === undefined || !report.why.includes(reply)) out.push(`la respuesta clave (${reply ?? "ninguna"}) no es la segunda media jugada que nombra el «por qué»`);
    const mate = /mate en (\d+):/.exec(report.why);
    // Un mate se escribe entero en el texto (2 × N medias jugadas desde la tuya, o las que tenga la línea).
    const needed =
      position === null ? 0 : mate !== null ? Math.min(2 * Number(mate[1]), legalPlies(position, report.lines.played)) : materialPlies(position, report.lines.played, 2);
    if (own.moves.length < needed) out.push(`la línea de tu jugada enseña ${own.moves.length} medias jugadas y el texto cuenta ${needed}`);
  }

  if (position !== null && stalemates(position, report.move.uci) && !/\bahoga\b/.test(report.summary)) {
    out.push("la jugada ahoga al rival y la frase del veredicto no dice ahogado");
  }

  if (/nadie gana material/.test(shown) && captured.size > 0) out.push("dice que nadie gana material y las líneas capturan");

  // 5. Los números del texto son los del panel.
  for (const match of shown.matchAll(/(?:baja|diferencia es de) (\d+,\d) peones/g)) {
    if (match[1] !== pawns(report.loss)) out.push(`el texto dice ${match[1]!} peones y la pérdida es ${pawns(report.loss)}`);
  }
  const mateScores = report.before.mate !== null || report.after.mate !== null;
  if (report.verdict === "mejor" && report.best.uci !== report.move.uci && !mateScores && report.loss > EQUIVALENT_CP) {
    out.push(`«mejor» con una pérdida de ${report.loss} centipeones`);
  }
  if ((report.verdict === "error" || report.verdict === "error-grave") && report.loss === 0) out.push(`«${report.verdict}» sin pérdida`);

  // 6. Un aviso de material confirmado no es «buena» ni «mejor».
  const materialFinding = report.findings.some((f) => f.kind === "pieza-colgando" || f.kind === "captura-gratis");
  if (materialFinding && (report.verdict === "mejor" || report.verdict === "buena")) out.push(`aviso de material con veredicto «${report.verdict}»`);

  // 7. La categoría cuadra con la evaluación.
  const mateInvolved = mateScores || report.findings.some((f) => f.kind === "mate-en-1");
  if ((report.category === "mate") !== mateInvolved) out.push(`categoría «${report.category}» y mate ${mateInvolved ? "en juego" : "ausente"}`);
  if (report.category === "correcta" && report.verdict !== "mejor") out.push(`categoría «correcta» con veredicto «${report.verdict}»`);

  // 8. Frases completas.
  if (!report.summary.endsWith(".")) out.push("la frase del veredicto no acaba en punto");
  if (report.why !== "" && !report.why.endsWith(".")) out.push("el «por qué» no acaba en punto");
  return out;
}

/** ¿Deja la jugada `uci` al rival ahogado? Deja `position` como estaba. */
function stalemates(position: Position, uci: string): boolean {
  const move = position.moveFromUci(uci);
  if (move === null) return false;
  position.makeMove(move);
  const result = position.status().kind === "stalemate";
  position.unmakeMove();
  return result;
}

/** Medias jugadas legales seguidas al principio de `line`. Deja `position` como estaba. */
function legalPlies(position: Position, line: readonly string[]): number {
  let played = 0;
  try {
    for (const uci of line) {
      const move = position.moveFromUci(uci);
      if (move === null) break;
      position.makeMove(move);
      played++;
    }
  } finally {
    for (let i = 0; i < played; i++) position.unmakeMove();
  }
  return played;
}

/** La posición de antes de la jugada; `null` (y lo anota en `out`) si la FEN o una jugada no son válidas. */
function replay(game: CoachGame, out: string[]): Position | null {
  let position: Position;
  try {
    position = Position.fromFen(game.fen);
  } catch (error) {
    out.push(`FEN no válida: ${(error as Error).message}`);
    return null;
  }
  for (const uci of game.moves ?? []) {
    const move = position.moveFromUci(uci);
    if (move === null) {
      out.push(`partida ilegal en ${uci}`);
      return null;
    }
    position.makeMove(move);
  }
  return position;
}

/** Piezas que se capturan en alguna de las dos líneas del informe, desde `position`. Anota en `out` las líneas ilegales. */
function capturedTypes(report: CoachReport, position: Position, out: string[]): Set<PieceType> {
  const types = new Set<PieceType>();
  for (const line of [report.lines.best, report.lines.played]) {
    if (line.some((uci) => typeof uci !== "string")) out.push("línea con jugadas que no son texto");
    for (const capture of lineCaptures(position, line)) if (capture.type !== null) types.add(capture.type);
  }
  return types;
}
