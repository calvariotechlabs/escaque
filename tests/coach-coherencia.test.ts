// Coherencia del coach (RC-01, RC-02 y RC-03 de la Release Candidate, CAL-408).
//
// Cada caso es una jugada real de las dos auditorías externas (24-nov-2026),
// analizada con la profundidad del coach (4) y sin reloj, para que sea
// determinista. Los textos de antes de este bloque se contradecían; aquí se
// comprueba que ya no, con frases concretas y con las invariantes del informe.
// Valores de referencia de Stockfish 17.1 en docs/auditorias/consolidacion-rc.md.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { START_FEN } from "../src/core/index.js";
import { analyzeMove, checkInvariants } from "../src/coach/index.js";
import type { CoachReport } from "../src/coach/index.js";
import { reportView } from "../src/ui/coach.js";
import { CHATGPT_GAME, CLAUDE_GAME, spanishGame } from "./auditoria-partidas.js";

/** Profundidad real del coach (`COACH_LIMITS`), sin reloj. */
const DEPTH4 = { limits: { maxDepth: 4 } } as const;

/** Informe de la media jugada `ply` (0 = la primera) de una partida desde la posición inicial. */
function reportAt(moves: readonly string[], ply: number): CoachReport {
  return analyzeMove({ fen: START_FEN, moves: moves.slice(0, ply) }, moves[ply]!, DEPTH4);
}

/** Todos los textos que ve la persona en el panel. */
const texts = (report: CoachReport): string => [report.summary, report.why, ...report.findings.map((f) => f.message)].join(" | ");

/** Las invariantes se cumplen; si no, el mensaje dice cuáles fallan y el informe. */
function assertCoherent(report: CoachReport, moves: readonly string[], ply: number): void {
  const violations = checkInvariants(report, { fen: START_FEN, moves: moves.slice(0, ply) });
  assert.deepEqual(violations, [], `${report.move.san}: ${texts(report)}`);
}

const NO_MOTIVE = /no hay un motivo táctico/i;

describe("coherencia del coach con los casos de las auditorías", () => {
  it("H-01 · 2.g4 permite mate en 1 y lo dice", () => {
    const moves = spanishGame("1. f3 e5 2. g4 Dh4#");
    const report = reportAt(moves, 2);
    assert.equal(report.verdict, "error-grave");
    assert.doesNotMatch(texts(report), NO_MOTIVE);
    assert.match(report.summary, /^g4 permite mate en 1\./);
    assert.equal(report.why, "Tras g4, las negras dan mate en 1: 2… Dh4#.");
    assert.equal(report.category, "mate");
    assertCoherent(report, moves, 2);
  });

  it("H-02 · 2.Cf3 vale lo mismo que Cc3: no hay otra «Mejor jugada» debajo", () => {
    const report = reportAt(CLAUDE_GAME, 2);
    assert.equal(report.verdict, "mejor");
    assert.equal(report.alternative, null);
    const view = reportView(report, "2. Cf3");
    assert.equal(view.best, null);
    assert.equal(view.bestArrow, null);
    assert.match(report.summary, /Cc3/);
    assertCoherent(report, CLAUDE_GAME, 2);
  });

  it("H-03 · 4.Dg5 con la dama colgando no dice «no hay un motivo táctico»", () => {
    const moves = spanishGame("1. e4 e5 2. Ac4 Cc6 3. Dh5 De7 4. Dg5");
    const report = reportAt(moves, 6);
    assert.equal(report.verdict, "error-grave");
    assert.doesNotMatch(texts(report), NO_MOTIVE);
    assert.equal(report.why, "Tras Dg5, las negras responden 4… Dxg5 y ganan la dama.");
    assert.equal(report.category, "material");
    assertCoherent(report, moves, 6);
  });

  it("H-04 · 40.gxf5 con mate en 1 en contra no elogia el material", () => {
    const report = reportAt(CHATGPT_GAME, 78);
    assert.doesNotMatch(report.summary, /gana/);
    assert.match(report.summary, /mate/);
    assert.equal(report.category, "mate");
    assertCoherent(report, CHATGPT_GAME, 78);
  });

  it("H-05 · 32.Tc8+ regala una torre: no puede ser «Buena jugada»", () => {
    const report = reportAt(CLAUDE_GAME, 62);
    assert.ok(report.verdict !== "mejor" && report.verdict !== "buena", report.verdict);
    assert.doesNotMatch(report.summary, /diferencia .*pequeña/);
    assertCoherent(report, CLAUDE_GAME, 62);
  });

  it("H-06 · 6.Cxf7 reconoce el límite de lo que ve el coach", () => {
    const report = reportAt(CLAUDE_GAME, 10);
    assert.doesNotMatch(texts(report), NO_MOTIVE);
    assert.match(report.why, /sacrificio/);
    assert.match(report.why, /4 medias jugadas/);
    assertCoherent(report, CLAUDE_GAME, 10);
  });

  it("H-08 · 13.Dd5+: no dice que Dd3+ gane una torre que la línea no captura", () => {
    const report = reportAt(CHATGPT_GAME, 24);
    assert.doesNotMatch(report.why, /gana una torre/);
    // La línea de Alfil Beta: 13.Dd3+ Re7 14.Cd5+ Rf7 15.Cxf6 Rxf6 16.Dd8+ … gana la dama por el caballo.
    assert.match(report.why, /^Dd3\+ gana la dama( y un peón)? a cambio de un caballo\.$/);
    assertCoherent(report, CHATGPT_GAME, 24);
  });

  it("H-09 · 16.Ab5+ solo aplaza la amenaza: no «pone a salvo» la dama", () => {
    const report = reportAt(CHATGPT_GAME, 30);
    assert.doesNotMatch(texts(report), /pone a salvo la dama/);
    assertCoherent(report, CHATGPT_GAME, 30);
  });

  it("H-10 · 12…Df6 explica lo que permite: Dd3+ y Cd5+ ganan la dama", () => {
    const report = reportAt(CHATGPT_GAME, 23);
    assert.equal(report.verdict, "error-grave");
    assert.doesNotMatch(texts(report), NO_MOTIVE);
    // Con el motor de B11 la línea confirmada a profundidad 6 se come también el peón de c7
    // (13. Dd3+ Re7 14. Cd5+ Re8 15. Cxc7+ … Cxf6+ gxf6): el texto cuenta lo que pasa en ella.
    assert.equal(report.why, "Tras Df6, las blancas responden 13. Dd3+ y ganan la dama y un peón a cambio de un caballo.");
    assert.equal(report.category, "material");
    assertCoherent(report, CHATGPT_GAME, 23);
  });
});

describe("invariantes en partidas completas", () => {
  // Barrido: cada jugada de las dos partidas de las auditorías (161 medias
  // jugadas, con errores, sacrificios, mates en contra y finales perdidos)
  // tiene que dar un informe sin contradicciones. Con profundidad 3 y 2 para
  // que la suite no se alargue; el banco de posiciones (B2) lo repite a 4.
  const sweep = (moves: readonly string[], depth: number): string[] => {
    const problems: string[] = [];
    for (let ply = 0; ply < moves.length; ply++) {
      const game = { fen: START_FEN, moves: moves.slice(0, ply) };
      const report = analyzeMove(game, moves[ply]!, { limits: { maxDepth: depth } });
      for (const violation of checkInvariants(report, game)) problems.push(`${ply} ${report.move.san}: ${violation}`);
    }
    return problems;
  };

  it("partida de ChatGPT (80 medias jugadas, profundidad 3)", () => {
    assert.deepEqual(sweep(CHATGPT_GAME, 3), []);
  });

  it("partida de Claude (70 medias jugadas, profundidad 2)", () => {
    assert.deepEqual(sweep(CLAUDE_GAME, 2), []);
  });
});

describe("checkInvariants detecta las contradicciones de antes", () => {
  // Informes con los textos que daba el coach auditado (commit 5e9e946):
  // las invariantes tienen que señalarlos.
  const moves = spanishGame("1. f3 e5 2. g4");
  const game = { fen: START_FEN, moves: moves.slice(0, 2) };
  const good = analyzeMove(game, moves[2]!, DEPTH4);

  it("«Mejor jugada» con otra jugada como mejor", () => {
    const bad = { ...good, verdict: "mejor" as const, title: "Mejor jugada" };
    assert.ok(checkInvariants(bad, game).some((v) => v.includes("alternativa")));
  });

  it("«no hay un motivo táctico» ante un mate en contra", () => {
    const bad = { ...good, why: "No hay un motivo táctico: Alfil Beta la prefiere por cómo quedan las piezas (−0,7 frente a mate en 1 de las negras)." };
    assert.ok(checkInvariants(bad, game).some((v) => v.includes("motivo táctico")));
  });

  it("elogio de material con mate en contra", () => {
    const bad = { ...good, summary: "g4 gana una pieza." };
    const violations = checkInvariants(bad, game);
    assert.ok(violations.some((v) => v.includes("elogia")));
    assert.ok(violations.some((v) => v.includes("no lo dice")));
  });

  it("una pieza ganada que ninguna línea captura", () => {
    const bad = { ...good, why: "Cc3 gana una torre." };
    assert.ok(checkInvariants(bad, game).some((v) => v.includes("gana una torre")));
  });

  it("una cifra que no es la del panel", () => {
    const bad = { ...good, summary: "Había una jugada mucho mejor: la valoración baja 1,0 peones. Permite mate." };
    assert.ok(checkInvariants(bad, game).some((v) => v.includes("peones")));
  });
});

describe("hallazgos de la revisión de código", () => {
  it("un mate en contra de varias jugadas se escribe hasta el mate", () => {
    // 33.Tf1 permite mate en 3: antes la línea se cortaba a las cuatro medias jugadas.
    const report = analyzeMove({ fen: START_FEN, moves: CLAUDE_GAME.slice(0, 64) }, CLAUDE_GAME[64]!, { limits: { maxDepth: 3 } });
    assert.match(report.why, /^Tras Tf1, las negras tienen mate en 3: .*#\.$/);
  });

  it("con reloj, completar las líneas respeta el tope de tiempo", () => {
    // Un reloj que avanza 2 s en cada lectura: la búsqueda de antes llega a
    // profundidad 1 y las líneas no se completan, pero el informe sigue siendo coherente.
    let t = 0;
    const now = (): number => (t += 2000);
    const moves = spanishGame("1. e4 e5 2. Ac4 Cc6 3. Dh5 De7 4. Dg5");
    const game = { fen: START_FEN, moves: moves.slice(0, 6) };
    const report = analyzeMove(game, moves[6]!, { limits: { maxDepth: 4, timeMs: 3000 }, now });
    assert.ok(report.lines.best.length <= 1 && report.lines.played.length <= 2, `${report.lines.best.join(" ")} / ${report.lines.played.join(" ")}`);
    assert.deepEqual(checkInvariants(report, game), []);
  });
});
