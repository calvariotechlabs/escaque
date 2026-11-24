// Calidad del análisis del coach (RC-05 de la Release Candidate, bloque B3, issue #62).
//
// Cada prueba cubre un defecto confirmado de las auditorías o del banco de
// posiciones (bench/), con el análisis sin reloj para que sea determinista.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { START_FEN } from "../src/core/index.js";
import { analyzeMove, checkInvariants } from "../src/coach/index.js";
import type { CoachReport } from "../src/coach/index.js";
import { CLAUDE_GAME } from "./auditoria-partidas.js";

const DEPTH4 = { limits: { maxDepth: 4 } } as const;

function reportAt(moves: readonly string[], ply: number): CoachReport {
  return analyzeMove({ fen: START_FEN, moves: moves.slice(0, ply) }, moves[ply]!, DEPTH4);
}

describe("avisos verificados con el motor", () => {
  it("H-07 · 13.O-O: el peón de e5 no cuelga, porque …Axe5 sale mal para las negras", () => {
    // Stockfish: 13.O-O es la mejor (+6,26). El intercambio estático decía que el
    // peón de e5 se perdía, pero el motor ve que capturarlo empeora a las negras.
    const report = reportAt(CLAUDE_GAME, 24);
    assert.equal(report.move.san, "O-O");
    assert.ok(!report.findings.some((f) => f.kind === "pieza-colgando"), report.findings.map((f) => f.message).join(" | "));
    assert.deepEqual(checkInvariants(report, { fen: START_FEN, moves: CLAUDE_GAME.slice(0, 24) }), []);
  });
});


describe("mates más largos que la búsqueda de antes", () => {
  it("Philidor · Cf7+ deja escapar el mate en 2, pero no es un error: sigue ganando", () => {
    // Stockfish: Dg8+ mate en 2; Cf7+ mate en 4. La búsqueda de antes se paraba al
    // ver el mate en 2 y la de Cf7+ se quedaba en dos medias jugadas: «Error».
    const report = analyzeMove({ fen: "5r1k/6pp/7N/3Q4/8/8/8/6K1 w - - 0 1" }, "h6f7", DEPTH4);
    assert.ok(report.verdict === "imprecision" || report.verdict === "buena", `${report.verdict}: ${report.summary}`);
    assert.match(report.summary, /mate en 2/);
    assert.deepEqual(checkInvariants(report, { fen: "5r1k/6pp/7N/3Q4/8/8/8/6K1 w - - 0 1" }), []);
  });

  it("coronar torre en lugar de dama: el mate sigue ahí, solo más lento", () => {
    const fen = "8/k1P5/8/1K6/8/8/8/8 w - - 0 1";
    const report = analyzeMove({ fen }, "c7c8r", DEPTH4);
    assert.equal(report.verdict, "buena");
    assert.match(report.summary, /^Sigue habiendo mate, pero más lento/);
    assert.deepEqual(checkInvariants(report, { fen }), []);
  });
});
