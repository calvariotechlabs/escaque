// Material insuficiente: ningún bando puede dar mate con ninguna serie de jugadas legales.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Position, START_FEN } from "../src/core/index.js";
import { after } from "./helpers.js";

describe("material insuficiente", () => {
  const insufficient: Array<[string, string]> = [
    ["rey contra rey", "8/8/4k3/8/8/3K4/8/8 w - - 0 1"],
    ["rey y alfil contra rey", "8/8/4k3/8/8/3K4/3B4/8 w - - 0 1"],
    ["rey contra rey y alfil", "8/8/4k3/4b3/8/3K4/8/8 b - - 0 1"],
    ["rey y caballo contra rey", "8/8/4k3/8/8/3K4/8/6N1 w - - 0 1"],
    ["rey contra rey y caballo", "8/2n5/4k3/8/8/3K4/8/8 w - - 0 1"],
    ["alfiles de distinto bando en casillas del mismo color", "8/8/4k3/2b5/8/3K4/3B4/8 w - - 0 1"],
    ["varios alfiles, todos en casillas del mismo color", "8/8/4kb2/8/8/3K4/3B4/B7 w - - 0 1"],
  ];
  for (const [label, fen] of insufficient) {
    it(`es insuficiente: ${label}`, () => {
      const p = Position.fromFen(fen);
      assert.equal(p.isInsufficientMaterial(), true);
      assert.deepEqual(p.status(), { kind: "insufficient-material" });
    });
  }

  const sufficient: Array<[string, string]> = [
    ["posición inicial", START_FEN],
    ["un peón", "8/8/4k3/8/8/3K4/3P4/8 w - - 0 1"],
    ["una torre", "8/8/4k3/8/8/3K4/8/7R w - - 0 1"],
    ["una dama", "8/8/4k3/8/8/3K4/8/7q w - - 0 1"],
    ["dos caballos (el mate existe aunque no se pueda forzar)", "8/8/4k3/8/8/3K4/8/5NN1 w - - 0 1"],
    ["alfil y caballo del mismo bando", "8/8/4k3/8/8/3K4/8/5BN1 w - - 0 1"],
    ["alfil contra caballo (cabe un mate de ayuda)", "8/8/4k3/8/8/3K4/3B4/6n1 w - - 0 1"],
    ["alfiles en casillas de distinto color", "8/8/4k3/7b/8/3K4/3B4/8 w - - 0 1"],
  ];
  for (const [label, fen] of sufficient) {
    it(`no es insuficiente: ${label}`, () => {
      assert.equal(Position.fromFen(fen).isInsufficientMaterial(), false);
    });
  }

  it("se detecta tras la captura que deja el material justo", () => {
    // Rey y alfil contra rey y caballo; el alfil captura el caballo.
    const p = after("8/8/4k3/6n1/8/3K4/3B4/8 w - - 0 1", "d2g5");
    assert.equal(p.isInsufficientMaterial(), true);
    assert.deepEqual(p.status(), { kind: "insufficient-material" });
  });
});
