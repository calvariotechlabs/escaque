// Ahogado frente a jaque mate.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Position, START_FEN } from "../src/core/index.js";
import { after } from "./helpers.js";

describe("ahogado", () => {
  const stalemates: Array<[string, string]> = [
    ["rey en la esquina con dama", "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"],
    ["rey frente a un peón en séptima", "k7/P7/K7/8/8/8/8/8 b - - 0 1"],
    ["la única pieza que podría moverse está clavada", "k1K5/1n6/8/1N1B4/8/8/8/8 b - - 0 1"],
    ["peón bloqueado y rey sin casillas", "7k/5K1p/7P/8/8/8/8/8 b - - 0 1"],
  ];
  for (const [label, fen] of stalemates) {
    it(`sin jugadas y sin jaque es ahogado: ${label}`, () => {
      const p = Position.fromFen(fen);
      assert.deepEqual(p.legalMoves(), []);
      assert.equal(p.isCheck(), false);
      assert.deepEqual(p.status(), { kind: "stalemate" });
    });
  }

  it("sin jugadas y en jaque es mate, no ahogado", () => {
    const p = Position.fromFen("7k/6Q1/6K1/8/8/8/8/8 b - - 0 1");
    assert.deepEqual(p.legalMoves(), []);
    assert.equal(p.isCheck(), true);
    assert.deepEqual(p.status(), { kind: "checkmate", winner: "w" });
  });

  it("el mate del pastor gana para las blancas", () => {
    const p = after(START_FEN, "e2e4", "e7e5", "f1c4", "b8c6", "d1h5", "g8f6", "h5f7");
    assert.deepEqual(p.status(), { kind: "checkmate", winner: "w" });
  });

  it("el mate del loco gana para las negras", () => {
    const p = after(START_FEN, "f2f3", "e7e5", "g2g4", "d8h4");
    assert.deepEqual(p.status(), { kind: "checkmate", winner: "b" });
  });

  it("una jugada que ahoga deja la partida en tablas", () => {
    // El rey blanco se acerca y quita al negro su última casilla sin darle jaque.
    const p = after("7k/5Q2/8/6K1/8/8/8/8 w - - 0 1", "g5g6");
    assert.deepEqual(p.status(), { kind: "stalemate" });
  });

  it("con jugadas disponibles la partida sigue", () => {
    assert.deepEqual(Position.fromFen(START_FEN).status(), { kind: "ongoing" });
  });
});
