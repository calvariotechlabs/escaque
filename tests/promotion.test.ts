// Coronación.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Position } from "../src/core/index.js";
import { after, legalUci } from "./helpers.js";

const pawnMoves = (fen: string, from: string) => legalUci(Position.fromFen(fen)).filter((m) => m.startsWith(from));

describe("coronación", () => {
  it("un peón en séptima genera las cuatro coronaciones y ninguna jugada sin coronar", () => {
    assert.deepEqual(pawnMoves("8/P7/8/8/8/8/8/k6K w - - 0 1", "a7"), ["a7a8b", "a7a8n", "a7a8q", "a7a8r"]);
  });

  it("coronar capturando también genera las cuatro piezas", () => {
    assert.deepEqual(pawnMoves("1n6/P7/8/8/8/8/8/k6K w - - 0 1", "a7"), [
      "a7a8b", "a7a8n", "a7a8q", "a7a8r",
      "a7b8b", "a7b8n", "a7b8q", "a7b8r",
    ]);
  });

  it("si la casilla de delante está ocupada solo quedan las coronaciones con captura", () => {
    assert.deepEqual(pawnMoves("nr6/P7/8/8/8/8/8/k6K w - - 0 1", "a7"), ["a7b8b", "a7b8n", "a7b8q", "a7b8r"]);
  });

  it("las negras coronan en la primera fila", () => {
    assert.deepEqual(pawnMoves("K6k/8/8/8/8/8/p7/8 b - - 0 1", "a2"), ["a2a1b", "a2a1n", "a2a1q", "a2a1r"]);
  });

  it("la pieza elegida aparece en el tablero en lugar del peón", () => {
    assert.equal(after("8/P7/8/8/8/8/8/k6K w - - 0 1", "a7a8n").toFen(), "N7/8/8/8/8/8/8/k6K b - - 0 1");
    assert.equal(after("1n6/P7/8/8/8/8/8/k6K w - - 5 40", "a7b8r").toFen(), "1R6/8/8/8/8/8/8/k6K b - - 0 40");
    assert.equal(after("K6k/8/8/8/8/8/p7/8 b - - 0 1", "a2a1q").toFen(), "K6k/8/8/8/8/8/8/q7 w - - 0 2");
  });

  it("un peón clavado no puede coronar si sale de la clavada", () => {
    // La torre de a7 clava el peón de e7 contra el rey de h7 en la séptima fila.
    assert.deepEqual(pawnMoves("k7/r3P2K/8/8/8/8/8/8 w - - 0 1", "e7"), []);
  });

  it("coronar puede ser la única forma de salir del jaque", () => {
    // La torre de f8 da jaque al rey de c8 por la octava: e7xf8 la captura y e7e8 tapa el jaque.
    const moves = legalUci(Position.fromFen("2K2r2/4P3/8/8/8/8/8/3k4 w - - 0 1"));
    assert.ok(moves.includes("e7f8q"));
    assert.ok(moves.includes("e7e8n"));
  });

  it("deshacer una coronación devuelve el peón (y la pieza capturada)", () => {
    const fen = "1n6/P7/8/8/8/8/8/k6K w - - 5 40";
    const p = after(fen, "a7b8q");
    p.unmakeMove();
    assert.equal(p.toFen(), fen);
  });
});
