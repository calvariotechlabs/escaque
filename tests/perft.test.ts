// Perft sobre las posiciones de referencia: el criterio de «terminado» del hito 1.
//
// `npm test` usa la profundidad rápida de cada posición; `npm run test:perft`
// ejecuta tests/perft-full.ts, que usa la profunda. Si un conteo falla, localiza la
// rama con `npm run perft -- <profundidad> "<fen>"` y compárala con la referencia.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Position } from "../src/core/index.js";
import { PERFT_POSITIONS } from "./perft-positions.js";
import { definePerftSuite } from "./perft-suite.js";

definePerftSuite("fast");

describe("hacer y deshacer dejan la posición intacta", () => {
  // Recorre dos jugadas desde cada posición y comprueba la FEN tras cada deshacer.
  // Detecta estados que no se restauran (derechos de enroque, al paso, relojes).
  for (const ref of PERFT_POSITIONS) {
    it(ref.name, () => {
      const position = Position.fromFen(ref.fen);
      const root = position.toFen();
      for (const first of position.legalMoves()) {
        position.makeMove(first);
        const afterFirst = position.toFen();
        for (const second of position.legalMoves()) {
          position.makeMove(second);
          position.unmakeMove();
          assert.equal(position.toFen(), afterFirst);
        }
        position.unmakeMove();
        assert.equal(position.toFen(), root);
      }
    });
  }
});

describe("makeMove solo acepta jugadas de legalMoves() de la posición actual", () => {
  const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";

  it("rechaza una jugada construida a mano", () => {
    const p = Position.fromFen(fen);
    p.legalMoves();
    assert.throws(() => p.makeMove({ from: 3, to: 115, promotion: "q" }), /legalMoves/);
    assert.equal(p.toFen(), fen);
  });

  it("rechaza una jugada antigua cuando la posición ha cambiado", () => {
    const p = Position.fromFen(fen);
    const castle = p.moveFromUci("e1g1")!;
    p.makeMove(p.moveFromUci("h1h2")!);
    p.makeMove(p.moveFromUci("a8a7")!);
    p.makeMove(p.moveFromUci("h2h1")!);
    p.makeMove(p.moveFromUci("a7a8")!);
    assert.throws(() => p.makeMove(castle), /legalMoves/);
  });

  it("rechaza una jugada de otra posición", () => {
    const a = Position.fromFen(fen);
    const b = Position.fromFen(fen);
    const move = a.moveFromUci("e1g1")!;
    assert.throws(() => b.makeMove(move), /legalMoves/);
  });

  it("acepta de nuevo la jugada tras deshacer y volver a la misma posición", () => {
    const p = Position.fromFen(fen);
    const [first, second] = p.legalMoves();
    p.makeMove(first!);
    p.unmakeMove();
    p.makeMove(second!);
    p.unmakeMove();
    assert.equal(p.toFen(), fen);
  });
});
