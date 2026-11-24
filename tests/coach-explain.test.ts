// Coach mejorado (CAL-394): por qué es mejor una jugada, la línea de Alfil
// Beta, el elogio de una buena jugada y las tres pistas para la jugada que toca.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Position, START_FEN } from "../src/core/index.js";
import { CoachError, analyzeMove, explainMove, hintFor, lineText } from "../src/coach/index.js";
import { search } from "../src/engine/index.js";
import { after } from "./helpers.js";

const LIMITS = { limits: { maxDepth: 3 } } as const;
const DEPTH4 = { limits: { maxDepth: 4 } } as const;

/** Apertura de la trampa de Légal hasta antes de la 5.ª jugada blanca. */
const LEGAL = ["e2e4", "e7e5", "g1f3", "d7d6", "f1c4", "c8g4", "b1c3", "g7g6"];

/** Motivo de la mejor jugada que encuentra Alfil Beta en `position`. */
function motiveOfBest(position: Position): ReturnType<typeof explainMove> {
  const result = search(position, { maxDepth: 3 });
  return explainMove(position, result.best!, result.pv, result.score);
}

describe("por qué es mejor una jugada", () => {
  it("un mate en una", () => {
    const motive = motiveOfBest(Position.fromFen("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1"));
    assert.equal(motive.kind, "mate");
    assert.equal(motive.text, "Ta8 da mate.");
  });

  it("un ataque doble que gana material", () => {
    const position = Position.fromFen("7k/2q1r3/8/8/8/2N5/8/K7 w - - 0 1");
    const motive = explainMove(position, "c3d5", ["c3d5", "c7c6", "d5e7"], 200);
    assert.equal(motive.kind, "horquilla");
    assert.equal(motive.text, "Cd5 ataca a la vez la dama de c7 y la torre de e7: una de las dos se pierde.");
  });

  it("una clavada contra el rey", () => {
    const position = Position.fromFen("4k3/8/8/4n3/8/8/8/R6K w - - 0 1");
    const motive = explainMove(position, "a1e1", ["a1e1", "e8f7", "e1e5"], 300);
    assert.equal(motive.kind, "clavada");
    assert.equal(motive.text, "Te1 clava el caballo de e5: si se mueve, el rey queda en jaque.");
  });

  it("poner a salvo una pieza atacada", () => {
    const position = Position.fromFen("4k3/8/4p3/3p4/2B5/8/8/4K3 w - - 0 1");
    const motive = motiveOfBest(position);
    assert.equal(motive.kind, "salva");
    assert.match(motive.text, /^A[a-h][1-8] pone a salvo el alfil de c4, que estaba atacado por el peón de d5\.$/);
  });

  it("ganar material con la línea de Alfil Beta", () => {
    const position = after(START_FEN, ...LEGAL);
    const motive = explainMove(position, "f3e5", ["f3e5", "d6e5", "d1g4", "g8f6"], 165);
    assert.equal(motive.kind, "material");
    assert.equal(motive.text, "Cxe5 gana un peón. Si las negras responden 5… dxe5, 6. Dxg4 se lleva el alfil.");
  });

  it("sin motivo táctico", () => {
    const motive = explainMove(Position.fromFen(START_FEN), "e2e4", ["e2e4", "e7e5"], 30);
    assert.equal(motive.kind, "posicional");
  });

  it("no cambia la posición", () => {
    const position = after(START_FEN, ...LEGAL);
    const fen = position.toFen();
    explainMove(position, "f3e5", ["f3e5", "d6e5", "d1g4"], 165);
    assert.equal(position.toFen(), fen);
  });
});

describe("línea de Alfil Beta", () => {
  it("numera las jugadas en SAN española", () => {
    const position = after(START_FEN, ...LEGAL);
    assert.equal(lineText(position, ["f3e5", "d6e5", "d1g4", "g8f6"]), "5. Cxe5 dxe5 6. Dxg4 Cf6");
  });

  it("empieza con puntos suspensivos si mueven las negras", () => {
    const position = after(START_FEN, "e2e4");
    assert.equal(lineText(position, ["e7e5", "g1f3"]), "1… e5 2. Cf3");
  });

  it("se corta en cuatro medias jugadas y al primer UCI que no es legal", () => {
    const position = Position.fromFen(START_FEN);
    assert.equal(lineText(position, ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5"]), "1. e4 e5 2. Cf3 Cc6");
    assert.equal(lineText(position, ["e2e4", "e2e4"]), "1. e4");
  });
});

describe("informe con la alternativa", () => {
  // A profundidad 3 Alfil Beta no ve Cxe5: estas usan la del coach (4), sin reloj.
  it("dice por qué es mejor la jugada de Alfil Beta y su línea", () => {
    const report = analyzeMove({ fen: START_FEN, moves: LEGAL }, "h2h3", DEPTH4);
    assert.equal(report.best.uci, "f3e5");
    assert.match(report.why, /^Cxe5 gana un peón\./);
    assert.match(report.line, /^5\. Cxe5 dxe5 6\. Dxg4/);
  });

  it("elogia una buena jugada con motivo", () => {
    const report = analyzeMove({ fen: START_FEN, moves: LEGAL }, "f3e5", DEPTH4);
    assert.equal(report.verdict, "mejor");
    assert.match(report.summary, /^Cxe5 gana un peón\./);
  });

  it("sin porqué si la jugada vale lo mismo que la de Alfil Beta", () => {
    const report = analyzeMove({ fen: START_FEN, moves: [] }, "g1f3", { limits: { maxDepth: 2 } });
    assert.notEqual(report.best.uci, "g1f3");
    assert.equal(report.before.cp, report.after.cp);
    assert.equal(report.why, "");
  });

  it("sin motivo concreto, la frase de siempre", () => {
    const report = analyzeMove({ fen: START_FEN, moves: [] }, "e2e4", LIMITS);
    assert.ok(report.verdict === "mejor" || report.verdict === "buena");
    assert.ok(!/gana|ataca|clava|mate|salvo/.test(report.summary), report.summary);
  });
});

describe("pistas", () => {
  it("tres pistas: idea, pieza y jugada", () => {
    const hint = hintFor({ fen: START_FEN, moves: [...LEGAL, "h2h3", "g4f3"] }, LIMITS);
    assert.equal(hint.move.uci, "d1f3");
    assert.equal(hint.idea, "Puedes recuperar material: una pieza del rival está en tu campo.");
    assert.equal(hint.piece, "Mueve la dama de d1.");
    assert.equal(hint.play, "Alfil Beta jugaría Dxf3.");
    assert.equal(hint.from, "d1");
    assert.equal(hint.to, "f3");
  });

  it("avisa del mate", () => {
    const hint = hintFor({ fen: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1" }, LIMITS);
    assert.equal(hint.idea, "Puedes dar mate en 1.");
  });

  it("una pieza atacada", () => {
    const hint = hintFor({ fen: "4k3/8/4p3/3p4/2B5/8/8/4K3 w - - 0 1" }, LIMITS);
    assert.equal(hint.idea, "Una de tus piezas está atacada: ponla a salvo.");
  });

  it("al empezar, sacar piezas", () => {
    const hint = hintFor({ fen: START_FEN, moves: ["e2e4", "e7e5"] }, LIMITS);
    assert.ok(hint.idea.length > 0);
    assert.match(hint.piece, /^Mueve (el|la) [a-zñ]+ de [a-h][1-8]\.$/);
  });

  it("no da pistas con la partida terminada", () => {
    assert.throws(() => hintFor({ fen: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", moves: ["a1a8"] }, LIMITS), CoachError);
  });
});

describe("el coach no depende de la velocidad de la máquina", () => {
  it("con los límites por defecto, un equipo unas 10 veces más lento da la misma explicación", () => {
    // Reloj simulado: cada consulta avanza 65 ms (en un equipo normal, el análisis completo consulta
    // el reloj unas 40 veces en ~0,3 s, es decir, ~7 ms por consulta). Sin tiempos reales: no es intermitente.
    let ticks = 0;
    const slow = (): number => ticks++ * 65;
    const slowReport = analyzeMove({ fen: START_FEN, moves: LEGAL }, "h2h3", { now: slow });
    const reference = analyzeMove({ fen: START_FEN, moves: LEGAL }, "h2h3", DEPTH4);
    assert.equal(slowReport.depth, 4);
    assert.equal(slowReport.line, reference.line);
    assert.equal(slowReport.verdict, reference.verdict);
    assert.match(slowReport.why, /Cxe5 gana un peón/);
  });
});
