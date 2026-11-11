// Suite de perft sobre las posiciones de referencia, a la profundidad rápida o completa.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Position, perft } from "../src/core/index.js";
import { PERFT_POSITIONS } from "./perft-positions.js";

export function definePerftSuite(mode: "fast" | "full"): void {
  describe(`perft (${mode === "full" ? "completo" : "rápido"})`, () => {
    for (const ref of PERFT_POSITIONS) {
      const maxDepth = mode === "full" ? ref.full : ref.fast;
      describe(`${ref.name}: ${ref.checks}`, () => {
        for (let depth = 1; depth <= maxDepth; depth++) {
          const expected = ref.counts[depth - 1]!;
          it(`profundidad ${depth} = ${expected}`, () => {
            assert.equal(perft(Position.fromFen(ref.fen), depth), expected, ref.fen);
          });
        }
      });
    }
  });
}
