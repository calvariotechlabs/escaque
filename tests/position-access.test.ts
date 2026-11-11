// Lectura de la posición que necesita el motor: piezas por casilla y reloj de 50 jugadas.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Position, START_FEN } from "../src/core/index.js";
import { after } from "./helpers.js";

/** «e4» → índice 0x88. */
const sq = (name: string): number => (name.charCodeAt(1) - 49) * 16 + (name.charCodeAt(0) - 97);

describe("pieceAt()", () => {
  it("dice qué pieza hay en cada casilla", () => {
    const p = Position.fromFen(START_FEN);
    assert.deepEqual(p.pieceAt(sq("e1")), { color: "w", type: "k" });
    assert.deepEqual(p.pieceAt(sq("d8")), { color: "b", type: "q" });
    assert.deepEqual(p.pieceAt(sq("g7")), { color: "b", type: "p" });
    assert.equal(p.pieceAt(sq("e4")), null);
  });

  it("sigue las jugadas hechas", () => {
    const p = after(START_FEN, "e2e4");
    assert.deepEqual(p.pieceAt(sq("e4")), { color: "w", type: "p" });
    assert.equal(p.pieceAt(sq("e2")), null);
  });

  it("devuelve null fuera del tablero", () => {
    const p = Position.fromFen(START_FEN);
    for (const outside of [-1, 8, 127 + 1, 0x88, 1.5]) assert.equal(p.pieceAt(outside), null);
  });
});

describe("halfmoveClock", () => {
  it("cuenta las medias jugadas sin mover peón ni capturar", () => {
    assert.equal(Position.fromFen("4k3/8/8/8/8/8/8/4K3 w - - 37 80").halfmoveClock, 37);
    assert.equal(after(START_FEN, "g1f3", "g8f6").halfmoveClock, 2);
    assert.equal(after(START_FEN, "g1f3", "e7e5").halfmoveClock, 0);
  });
});
