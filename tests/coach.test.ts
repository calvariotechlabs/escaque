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
    assert.equal(report.title, "Mejor jugada");
    assert.equal(report.summary, "Es la jugada que elige Alfil Beta.");
  });

  it("dar mate es la mejor jugada", () => {
    const report = analyze([], "a1a8", "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1");
    assert.equal(report.verdict, "mejor");
    assert.equal(report.summary, "Da jaque mate.");
    assert.deepEqual(report.before.mate, { winner: "w", moves: 1 });
    assert.equal(report.before.text, "Mate en 1 para las blancas");
    assert.deepEqual(report.after.mate, { winner: "w", moves: 0 });
    assert.equal(report.after.text, "Jaque mate: ganan las blancas");
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
    assert.deepEqual(report.after.mate, { winner: "w", moves: 1 });
    assert.deepEqual(report.findings, []);
  });

  it("las negras también reciben su análisis", () => {
    // 1.e4 e5 2.Cf3 Dg5??: la dama queda colgando.
    const report = analyze(["e2e4", "e7e5", "g1f3"], "d8g5");
    assert.equal(report.color, "b");
    assert.equal(report.verdict, "error-grave");
    assert.ok(report.after.cp > 500, report.after.text);
    assert.match(report.after.text, /^\+\d+,\d a favor de las blancas$/);
    const finding = report.findings[0]!;
    if (finding.kind !== "pieza-colgando") throw new Error(JSON.stringify(report.findings));
    assert.equal(finding.message, "Tu dama de g5 está atacada por el caballo blanco de f3 y no la defiende ninguna pieza.");
    assert.equal(report.summary, "Dg5 deja la dama sin protección.");
  });
});

describe("detectores", () => {
  it("el ejemplo del diseño: mate que se escapa y dama colgando", () => {
    // 1.e4 e5 2.Ac4 Cc6 3.Dh5 Cf6 4.Cf3??: Dxf7# era mate y la dama de h5 queda atacada.
    const report = analyze(["e2e4", "e7e5", "f1c4", "b8c6", "d1h5", "g8f6"], "g1f3");
    assert.equal(report.verdict, "error-grave");
    assert.equal(report.title, "Error grave");
    assert.equal(report.summary, "Cf3 deja escapar el mate y deja la dama sin protección.");
    assert.deepEqual(report.best, { uci: "h5f7", san: "Qxf7#" });
    assert.equal(report.before.text, "Mate en 1 para las blancas");
    assert.match(report.after.text, /^\u2212\d+,\d a favor de las negras$/);
    assert.deepEqual(kinds(report), ["mate-en-1", "pieza-colgando"]);

    const [mate, hanging] = report.findings;
    if (mate?.kind !== "mate-en-1" || hanging?.kind !== "pieza-colgando") throw new Error(JSON.stringify(report.findings));
    assert.equal(mate.title, "Mate en 1 que se escapó");
    assert.equal(mate.message, "Con Dxf7# ganabas la partida en el acto. Con Cf3 el rey negro sigue vivo.");
    assert.equal(mate.label, "mate en 1 con Dxf7#");
    assert.deepEqual(mate.marks, [
      { square: "h5", mark: "selected" },
      { square: "f7", mark: "capture" },
    ]);
    assert.equal(hanging.title, "Pieza colgando");
    assert.equal(hanging.message, "Tu dama de h5 está atacada por el caballo negro de f6 y no la defiende ninguna pieza.");
    assert.equal(hanging.label, "dama colgando en h5");
    assert.deepEqual(hanging.attacker, { piece: "n", square: "f6" });
    assert.equal(hanging.defended, false);
    assert.deepEqual(hanging.marks, [
      { square: "f6", mark: "selected" },
      { square: "h5", mark: "capture" },
    ]);
  });

  it("mate en 1 que se escapó aunque quede otro mate más largo", () => {
    const report = analyze([], "a1a2", "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1");
    assert.equal(kinds(report)[0], "mate-en-1");
    const finding = report.findings[0]!;
    if (finding.kind !== "mate-en-1") throw new Error(finding.kind);
    assert.deepEqual(finding.move, { uci: "a1a8", san: "Ra8#" });
    assert.notEqual(report.verdict, "mejor");
    assert.notEqual(report.verdict, "buena");
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
    assert.equal(finding.message, "Tu caballo de g5 está atacado por la dama negra de d8 y no lo defiende ninguna pieza.");
    assert.equal(report.verdict, "error-grave");
  });

  it("pieza defendida pero atacada por otra de menos valor", () => {
    // El alfil de f3 ataca la torre de d1, que solo defiende el rey: h3 no lo arregla.
    const report = analyze([], "h2h3", "4k3/8/8/8/8/5b2/7P/3RK3 w - - 0 1");
    const finding = report.findings.find((f) => f.kind === "pieza-colgando");
    if (finding?.kind !== "pieza-colgando") throw new Error(JSON.stringify(report.findings));
    assert.equal(finding.square, "d1");
    assert.equal(finding.gain, 500 - 330);
    assert.equal(finding.defended, true);
    assert.equal(finding.message, "Tu torre de d1 está atacada por el alfil negro de f3, que vale menos: defenderla no basta.");
    assert.equal(report.summary, "h3 deja la torre en peligro.");
  });

  it("captura gratis que no se vio", () => {
    // 1.e4 e5 2.Cf3 Dg5?? 3.a3: Cxg5 ganaba la dama.
    const report = analyze(["e2e4", "e7e5", "g1f3", "d8g5"], "a2a3");
    const finding = report.findings.find((f) => f.kind === "captura-gratis");
    if (finding?.kind !== "captura-gratis") throw new Error(JSON.stringify(report.findings));
    assert.equal(finding.title, "Captura gratis no vista");
    assert.equal(finding.piece, "q");
    assert.equal(finding.square, "g5");
    assert.equal(finding.attacker, "n");
    assert.deepEqual(finding.capture, { uci: "f3g5", san: "Nxg5" });
    assert.equal(finding.free, true);
    assert.equal(finding.gain, 900);
    assert.equal(finding.message, "Podías capturar la dama de g5 con el caballo y nadie la recuperaba. No lo has visto.");
    assert.equal(finding.label, "captura gratis en g5");
    assert.deepEqual(finding.marks, [
      { square: "f3", mark: "selected" },
      { square: "g5", mark: "capture" },
    ]);
    assert.equal(report.verdict, "error-grave");
    assert.match(report.summary, /^a3 .*no aprovecha la captura de la dama de g5\.$/);
  });

  it("captura que ganaba material aunque el rival recuperara", () => {
    // dxe5 gana el caballo; el peón de d6 recupera: 320 − 100.
    const report = analyze([], "h2h3", "4k3/8/3p4/4n3/3P4/8/7P/4K3 w - - 0 1");
    const finding = report.findings.find((f) => f.kind === "captura-gratis");
    if (finding?.kind !== "captura-gratis") throw new Error(JSON.stringify(report.findings));
    assert.equal(finding.free, false);
    assert.equal(finding.gain, 220);
    assert.equal(
      finding.message,
      "Podías capturar el caballo de e5 con el peón: aunque el rival responda capturando, ganabas material. No lo has visto.",
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
  it("evaluaciones vistas por las blancas", () => {
    assert.deepEqual(toEvaluation(30, "w"), { cp: 30, mate: null, text: "+0,3 a favor de las blancas" });
    assert.deepEqual(toEvaluation(30, "b"), { cp: -30, mate: null, text: "\u22120,3 a favor de las negras" });
    assert.deepEqual(toEvaluation(-580, "w"), { cp: -580, mate: null, text: "\u22125,8 a favor de las negras" });
    assert.equal(toEvaluation(4, "w").text, "0,0, igualdad");
    assert.equal(toEvaluation(0, "b").cp, 0);
    assert.deepEqual(toEvaluation(MATE_SCORE - 1, "w").mate, { winner: "w", moves: 1 });
    assert.deepEqual(toEvaluation(MATE_SCORE - 3, "b").mate, { winner: "b", moves: 2 });
    assert.equal(toEvaluation(MATE_SCORE - 3, "b").cp, -10_000);
    assert.deepEqual(toEvaluation(-(MATE_SCORE - 2), "w").mate, { winner: "b", moves: 1 });
    // Tras la jugada (una media jugada después), el mate en 2 pasa a mate en 1.
    assert.equal(toEvaluation(MATE_SCORE - 3, "w", 1).text, "Mate en 1 para las blancas");
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
