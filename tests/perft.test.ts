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
