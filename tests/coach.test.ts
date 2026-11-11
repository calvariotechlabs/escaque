// Coach: valoración de la jugada y los tres detectores (mate en 1 que se
// escapó, pieza colgando y captura que ganaba material).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FenError, Position, START_FEN } from "../src/core/index.js";
import { CoachError, analyzeMove, exchangeGain, moveBalance, spanishSan, toEvaluation } from "../src/coach/index.js";
import type { CoachReport, Finding } from "../src/coach/index.js";
import { MATE_SCORE } from "../src/engine/index.js";
import { after } from "./helpers.js";

/** Sin límite de tiempo: los análisis son deterministas. */
const LIMITS = { limits: { maxDepth: 3 } } as const;

const analyze = (moves: string[], move: string, fen = START_FEN): CoachReport =>
  analyzeMove({ fen, moves }, move, LIMITS);

const kinds = (report: CoachReport): Finding["kind"][] => report.findings.map((f) => f.kind);

/** Casilla 0x88 a partir de su nombre. */
const sq = (name: string): number => (name.charCodeAt(1) - 49) * 16 + (name.charCodeAt(0) - 97);

describe("intercambio estático", () => {
  it("una pieza sin defensa se gana entera", () => {
    const position = Position.fromFen("4k3/8/8/4n3/8/8/8/4R1K1 w - - 0 1");
    assert.equal(exchangeGain(position, sq("e5")), 320);
  });

  it("una pieza defendida por un peón no se gana con una torre", () => {
    const position = Position.fromFen("4k3/8/3p4/4n3/8/8/8/4R1K1 w - - 0 1");
    assert.equal(exchangeGain(position, sq("e5")), 0);
    assert.equal(moveBalance(position, position.moveFromUci("e1e5")!), 320 - 500);
  });

  it("una pieza clavada no cuenta como atacante", () => {
    // Ce3 ataca d5, pero la torre de e8 lo clava contra el rey de e1.
    assert.equal(exchangeGain(Position.fromFen("r6k/8/8/3p4/8/4N3/8/4K3 w - - 0 1"), sq("d5")), 100);
    assert.equal(exchangeGain(Position.fromFen("4r2k/8/8/3p4/8/4N3/8/4K3 w - - 0 1"), sq("d5")), 0);
  });

  it("cuenta la coronación al capturar", () => {
    // bxa8=D gana la torre y además corona: 500 + 800.
    const position = Position.fromFen("r6k/1P6/8/8/8/8/8/4K3 w - - 0 1");
    assert.equal(moveBalance(position, position.moveFromUci("b7a8q")!), 1300);
  });

  it("no cambia la posición", () => {
    const position = Position.fromFen("4k3/8/3p4/4n3/8/8/8/4R1K1 w - - 0 1");
    const fen = position.toFen();
    exchangeGain(position, sq("e5"));
    assert.equal(position.toFen(), fen);
  });
});

describe("valoración de la jugada", () => {
  it("una buena apertura no tiene avisos", () => {
    const report = analyze([], "e2e4");
    assert.equal(report.color, "w");
    assert.deepEqual(report.move, { uci: "e2e4", san: "e4" });
    assert.ok(report.verdict === "mejor" || report.verdict === "buena", report.verdict);
    assert.deepEqual(report.findings, []);
    assert.ok(report.loss < 80, `pérdida ${report.loss}`);
  });

  it("la mejor jugada no pierde nada", () => {
    const first = analyze([], "e2e4");
    const report = analyze([], first.best.uci);
    assert.equal(report.verdict, "mejor");
    assert.equal(report.loss, 0);
    assert.deepEqual(report.before, report.after);
    assert.equal(report.title, "Mejor jugada");
  });

  it("dar mate es la mejor jugada", () => {
    const report = analyze([], "a1a8", "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1");
    assert.equal(report.verdict, "mejor");
    assert.equal(report.summary, "¡Jaque mate!");
    assert.deepEqual(report.after, { kind: "mate", moves: 1 });
    assert.deepEqual(report.findings, []);
  });

  it("un cambio igualado no es un error", () => {
    // 1.e4 d5 2.exd5: la dama recupera el peón.
    const report = analyze(["e2e4", "d7d5"], "e4d5");
    assert.deepEqual(report.findings, []);
    assert.ok(report.verdict === "mejor" || report.verdict === "buena", report.verdict);
  });

  it("un sacrificio que da mate no es una pieza colgando", () => {
    // Dd8+ entrega la dama (Axd8) y luego Te8#.
    const report = analyze([], "d5d8", "r1b2k1r/ppp1bppp/8/1B1Q4/5q2/2P5/PPP2PPP/R3R1K1 w - - 1 1");
    assert.equal(report.verdict, "mejor");
    assert.deepEqual(report.after, { kind: "mate", moves: 2 });
    assert.deepEqual(report.findings, []);
  });
});

describe("detectores", () => {
  it("mate en 1 que se escapó", () => {
    const report = analyze([], "a1a2", "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1");
    assert.deepEqual(kinds(report), ["mate-en-1"]);
    const finding = report.findings[0]!;
    assert.equal(finding.kind, "mate-en-1");
    if (finding.kind !== "mate-en-1") return;
    assert.deepEqual(finding.move, { uci: "a1a8", san: "Ra8#" });
    assert.equal(finding.message, "Tenías mate en 1 con Ta8#.");
    assert.notEqual(report.verdict, "mejor");
  });

  it("pieza que queda colgando", () => {
    // 1.e4 e5 2.Cf3 Cc6 3.Cg5?? Dxg5.
    const report = analyze(["e2e4", "e7e5", "g1f3", "b8c6"], "f3g5");
    assert.deepEqual(kinds(report), ["pieza-colgando"]);
    const finding = report.findings[0]!;
    if (finding.kind !== "pieza-colgando") throw new Error(finding.kind);
    assert.equal(finding.piece, "n");
    assert.equal(finding.square, "g5");
    assert.deepEqual(finding.capture, { uci: "d8g5", san: "Qxg5" });
    assert.equal(finding.gain, 320);
    assert.equal(finding.message, "Tu caballo en g5 queda colgando: el rival puede jugar Dxg5 y ganar material.");
    assert.equal(report.verdict, "error-grave");
  });

  it("pieza que ya colgaba y se deja colgando", () => {
    // El alfil de f3 ataca la torre de d1, que solo defiende el rey: h3 no lo arregla.
    const report = analyze([], "h2h3", "4k3/8/8/8/8/5b2/7P/3RK3 w - - 0 1");
    const finding = report.findings.find((f) => f.kind === "pieza-colgando");
    if (finding?.kind !== "pieza-colgando") throw new Error(JSON.stringify(report.findings));
    assert.equal(finding.square, "d1");
    assert.equal(finding.gain, 500 - 330);
    assert.equal(finding.message, "Tras tu jugada, tu torre de d1 queda colgando: el rival puede jugar Axd1 y ganar material.");
  });

  it("captura gratis que no se vio", () => {
    // 1.e4 e5 2.Cf3 Dg5?? 3.a3: Cxg5 ganaba la dama.
    const report = analyze(["e2e4", "e7e5", "g1f3", "d8g5"], "a2a3");
    const finding = report.findings.find((f) => f.kind === "captura-gratis");
    if (finding?.kind !== "captura-gratis") throw new Error(JSON.stringify(report.findings));
    assert.equal(finding.piece, "q");
    assert.equal(finding.square, "g5");
    assert.deepEqual(finding.capture, { uci: "f3g5", san: "Nxg5" });
    assert.equal(finding.free, true);
    assert.equal(finding.gain, 900);
    assert.equal(finding.message, "Podías capturar gratis la dama de g5 con Cxg5: no estaba defendida.");
    assert.equal(report.verdict, "error-grave");
  });

  it("captura que ganaba material aunque estuviera defendida", () => {
    // El peón de d4 captura el caballo de e5, defendido por el peón de d6: gana 320 − 100.
    const report = analyze([], "h2h3", "4k3/8/3p4/4n3/3P4/8/7P/4K3 w - - 0 1");
    const finding = report.findings.find((f) => f.kind === "captura-gratis");
    if (finding?.kind !== "captura-gratis") throw new Error(JSON.stringify(report.findings));
    assert.equal(finding.free, false);
    assert.equal(finding.gain, 220);
    assert.equal(
      finding.message,
      "Con dxe5 ganabas material: capturabas el caballo de e5 y el rival no podía recuperarlo todo.",
    );
  });

  it("no avisa de una captura si la jugada hecha gana lo mismo o más", () => {
    const report = analyze(["e2e4", "e7e5", "g1f3", "d8g5"], "f3g5");
    assert.equal(report.verdict, "mejor");
    assert.deepEqual(report.findings, []);
  });
});

describe("entradas", () => {
  it("rechaza jugadas ilegales y partidas terminadas", () => {
    assert.throws(() => analyze([], "e2e5"), CoachError);
    assert.throws(() => analyze(["e2e5"], "e7e5"), CoachError);
    assert.throws(() => analyzeMove({ fen: START_FEN, moves: [42 as unknown as string] }, "e2e4", LIMITS), CoachError);
    assert.throws(() => analyzeMove(null as unknown as { fen: string }, "e2e4", LIMITS), CoachError);
    // Mate del loco: la partida ya terminó.
    assert.throws(() => analyze(["f2f3", "e7e5", "g2g4", "d8h4"], "e1f2"), CoachError);
  });

  it("propaga los errores de FEN", () => {
    assert.throws(() => analyzeMove({ fen: "no es una fen" }, "e2e4", LIMITS), FenError);
  });

  it("no toca la partida que recibe", () => {
    const moves = Object.freeze(["e2e4", "e7e5"]);
    analyzeMove({ fen: START_FEN, moves }, "g1f3", LIMITS);
    assert.deepEqual(moves, ["e2e4", "e7e5"]);
  });

  it("con límites por defecto responde en poco tiempo", () => {
    const start = performance.now();
    const report = analyzeMove({ fen: START_FEN, moves: ["e2e4", "e7e5", "g1f3", "b8c6"] }, "f3g5");
    const elapsed = performance.now() - start;
    assert.ok(report.depth >= 1);
    assert.ok(elapsed < 3000, `${elapsed.toFixed(0)} ms`);
  });
});

describe("utilidades", () => {
  it("valoraciones legibles", () => {
    assert.deepEqual(toEvaluation(35), { kind: "cp", value: 35 });
    assert.deepEqual(toEvaluation(MATE_SCORE - 1), { kind: "mate", moves: 1 });
    assert.deepEqual(toEvaluation(MATE_SCORE - 3), { kind: "mate", moves: 2 });
    assert.deepEqual(toEvaluation(-(MATE_SCORE - 2)), { kind: "mate", moves: -1 });
  });

  it("SAN española", () => {
    assert.equal(spanishSan("Nxg5"), "Cxg5");
    assert.equal(spanishSan("e8=Q+"), "e8=D+");
    assert.equal(spanishSan("O-O"), "O-O");
  });

  it("el ayudante de partidas sigue igual", () => {
    assert.equal(after(START_FEN, "e2e4").turn, "b");
  });
});
