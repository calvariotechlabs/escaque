// Coach: las dos líneas (issue #87, hallazgo A-02 de la auditoría v2).
//
// Cuando el «Por qué» cuenta la respuesta del rival («Tras Dg5, las negras
// responden 4… Dxg5…»), el informe trae también la línea de la jugada hecha,
// acortada hasta lo que cuenta el texto, y el índice de la respuesta clave.
// Así el panel puede enseñar las dos líneas y la afirmación se puede recorrer.
// Las posiciones son del banco (`bench/posiciones.json`), a la profundidad del
// coach y sin reloj, para que sean deterministas.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Position, START_FEN } from "../src/core/index.js";
import { analyzeMove, checkInvariants } from "../src/coach/index.js";
import type { CoachGame, CoachReport } from "../src/coach/index.js";
import { COACH_TEXT, glueNumbers, reportView } from "../src/ui/coach.js";
import { CHATGPT_GAME, spanishGame } from "./auditoria-partidas.js";

const DEPTH4 = { limits: { maxDepth: 4 } } as const;

const H03: CoachGame = { fen: "r1b1kbnr/ppppqppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4" };
const PASILLO: CoachGame = { fen: "3r2k1/5ppp/8/8/8/8/5PPP/1Q4K1 w - - 0 1" };
const H10: CoachGame = { fen: "r1bq1b1r/ppp3pp/3k4/4p3/1NB5/P4Q2/1P1P1PPP/n1BK3R b - - 2 12" };

/** Media jugada (1 = la primera) de la última captura o coronación de `line` en sus 12 primeras. */
function lastCapture(game: CoachGame, line: readonly string[]): number {
  const position = Position.fromFen(game.fen);
  for (const uci of game.moves ?? []) position.makeMove(position.moveFromUci(uci)!);
  let last = 0;
  for (const [i, uci] of line.slice(0, 12).entries()) {
    const move = position.moveFromUci(uci);
    if (move === null) break;
    const enPassant = position.pieceAt(move.to) === null && position.pieceAt(move.from)?.type === "p" && (move.from & 7) !== (move.to & 7);
    if (position.pieceAt(move.to) !== null || enPassant || move.promotion !== null) last = i + 1;
    position.makeMove(move);
  }
  return last;
}

function assertCoherent(report: CoachReport, game: CoachGame): void {
  assert.deepEqual(checkInvariants(report, game), [], `${report.why} | ${report.refutationLine?.moves.join(" ")}`);
}

describe("la línea de la jugada hecha cuando el «Por qué» es la respuesta del rival", () => {
  it("H-03 · 4.Dg5: «4. Dg5 Dxg5», con Dxg5 como respuesta clave", () => {
    const report = analyzeMove(H03, "h5g5", DEPTH4);
    assert.match(report.why, /^Tras Dg5, las negras /);
    assert.ok(report.refutationLine !== null);
    assert.equal(report.refutationLine.key, 1);
    assert.equal(report.refutationLine.moves[0], "4. Dg5");
    assert.equal(report.refutationLine.moves[1], "Dxg5");
    assertCoherent(report, H03);
  });

  it("mate del pasillo · 1.Db7: la línea llega al mate, «1. Db7 Td1#»", () => {
    const report = analyzeMove(PASILLO, "b1b7", DEPTH4);
    assert.equal(report.why, "Tras Db7, las negras dan mate en 1: 1… Td1#.");
    assert.deepEqual(report.refutationLine, { moves: ["1. Db7", "Td1#"], key: 1 });
    assertCoherent(report, PASILLO);
  });

  it("H-10 · 12…Df6: la línea llega hasta la captura de la dama que cuenta el texto", () => {
    const report = analyzeMove(H10, "d8f6", DEPTH4);
    assert.match(report.why, /^Tras Df6, las blancas responden 13\. Dd3\+ y ganan la dama/);
    const line = report.refutationLine;
    assert.ok(line !== null);
    assert.deepEqual(line.moves.slice(0, 2), ["12… Df6", "13. Dd3+"]);
    assert.equal(line.key, 1);
    assert.equal(line.moves.length, lastCapture(H10, report.lines.played));
    assert.ok(line.moves.length >= 2 && line.moves.length <= 12);
    assertCoherent(report, H10);
  });

  it("issue #87 · 4.Ac4 de la partida v2: «Tras Ac4… 4… Dxg5» se ve en la línea de tu jugada", () => {
    const moves = spanishGame("1. e4 d5 2. Cf3 dxe4 3. Cg5 Dd5 4. Ac4");
    const game = { fen: START_FEN, moves: moves.slice(0, 6) };
    const report = analyzeMove(game, moves[6]!, DEPTH4);
    assert.match(report.why, /^Tras Ac4, las negras responden 4… Dxg5 /);
    assert.ok(report.refutationLine !== null);
    assert.equal(report.refutationLine.moves[0], "4. Ac4");
    assert.match(report.why, new RegExp(report.refutationLine.moves[1]!.replace(/[+#]/g, "\\$&")));
    assertCoherent(report, game);
  });

  it("si el «Por qué» habla de la mejor jugada, no hay línea de la jugada hecha", () => {
    // H-08: «Dd3+ gana la dama…» explica la mejor jugada, no la respuesta del rival.
    const report = analyzeMove({ fen: START_FEN, moves: CHATGPT_GAME.slice(0, 24) }, CHATGPT_GAME[24]!, DEPTH4);
    assert.match(report.why, /^Dd3\+ gana/);
    assert.equal(report.refutationLine, null);
  });

  it("con la mejor jugada no hay alternativa ni línea de la jugada hecha", () => {
    const best = analyzeMove({ fen: START_FEN }, "e2e4", DEPTH4).best.uci;
    const report = analyzeMove({ fen: START_FEN }, best, DEPTH4);
    assert.equal(report.alternative, null);
    assert.equal(report.refutationLine, null);
  });
});

describe("checkInvariants y la línea de la jugada hecha", () => {
  it("un «Por qué» con la respuesta del rival y sin su línea es una violación", () => {
    const report = analyzeMove(H03, "h5g5", DEPTH4);
    const broken = { ...report, refutationLine: null };
    assert.ok(checkInvariants(broken, H03).some((v) => v.includes("respuesta del rival")));
  });

  it("una línea de la jugada hecha que no llega a la captura que cuenta el texto es una violación", () => {
    const report = analyzeMove(H10, "d8f6", DEPTH4);
    const short = { ...report, refutationLine: { moves: report.refutationLine!.moves.slice(0, 2), key: 1 } };
    assert.ok(checkInvariants(short, H10).some((v) => v.includes("línea de tu jugada")));
  });

  it("la respuesta clave es la segunda media jugada", () => {
    const report = analyzeMove(H03, "h5g5", DEPTH4);
    const wrong = { ...report, refutationLine: { moves: report.refutationLine!.moves, key: 0 } };
    assert.ok(checkInvariants(wrong, H03).some((v) => v.includes("respuesta clave")));
  });

  it("una línea de la jugada hecha sin «Por qué» de la respuesta del rival es una violación", () => {
    const report = analyzeMove({ fen: START_FEN, moves: CHATGPT_GAME.slice(0, 24) }, CHATGPT_GAME[24]!, DEPTH4);
    const extra = { ...report, refutationLine: { moves: ["13. Dd5+", "Re7"], key: 1 } };
    assert.ok(checkInvariants(extra, { fen: START_FEN, moves: CHATGPT_GAME.slice(0, 24) }).some((v) => v.includes("respuesta del rival")));
  });
});

describe("mates largos en el «Por qué»", () => {
  it("un mate de más de cinco jugadas se cuenta sin línea: no hay respuesta clave que enseñar", () => {
    const report = analyzeMove(PASILLO, "b1b7", DEPTH4);
    const long = { ...report, why: "Tras Db7, las negras tienen mate en 7.", refutationLine: null };
    assert.deepEqual(checkInvariants(long, PASILLO).filter((v) => /respuesta|línea de tu jugada/.test(v)), []);
  });

  it("una línea de mate se enseña entera: dos medias jugadas por jugada del mate", () => {
    // Texto inventado sobre la línea real de 4.Dg5 (siete medias jugadas o más): solo cuenta la longitud.
    const report = analyzeMove(H03, "h5g5", DEPTH4);
    assert.ok(report.lines.played.length >= 4);
    const cut = { ...report, why: "Tras Dg5, las negras tienen mate en 2: 4… Dxg5 5. d3 Dxg2.", refutationLine: { moves: report.refutationLine!.moves.slice(0, 1).concat(["Dxg5", "5. d3"]), key: 1 } };
    assert.ok(checkInvariants(cut, H03).some((v) => v.includes("la línea de tu jugada enseña 3 medias jugadas y el texto cuenta 4")));
  });
});

describe("reportView y las dos líneas", () => {
  it("pasa la línea de tu jugada con su respuesta clave al panel", () => {
    const view = reportView(analyzeMove(H03, "h5g5", DEPTH4), "4. Dg5");
    assert.ok(view.playedLine !== null);
    assert.deepEqual(view.playedLine.moves.slice(0, 2), ["4. Dg5", "Dxg5"]);
    assert.equal(view.playedLine.key, 1);
    assert.notEqual(view.line, "");
  });

  it("sin «Por qué» de la respuesta del rival, el panel enseña una sola línea", () => {
    const best = analyzeMove({ fen: START_FEN }, "e2e4", DEPTH4).best.uci;
    const view = reportView(analyzeMove({ fen: START_FEN }, best, DEPTH4), "1.");
    assert.equal(view.playedLine, null);
  });
});

describe("textos del bloque de las dos líneas", () => {
  it("el número va pegado a su jugada con un espacio duro: «12… Df6» no se parte", () => {
    assert.equal(glueNumbers("12… Df6 13. Dd3+ Re7"), "12…\u00a0Df6 13.\u00a0Dd3+ Re7");
    assert.equal(glueNumbers("Dxg5"), "Dxg5");
  });

  it("los textos son los del diseño", () => {
    assert.equal(COACH_TEXT.linesTitle, "Líneas de Alfil Beta");
    assert.equal(COACH_TEXT.playedLineName, "Línea de tu jugada");
    assert.equal(COACH_TEXT.bestLineName, "Línea de la mejor jugada");
    assert.equal(COACH_TEXT.keyReply, " (respuesta clave)");
    assert.equal(COACH_TEXT.linesNote, "Subrayada: la respuesta clave del rival, la que explica el «Por qué».");
  });
});
