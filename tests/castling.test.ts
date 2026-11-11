// Enroque: derechos, casillas atacadas y piezas en medio.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Position } from "../src/core/index.js";
import { after, legalUci } from "./helpers.js";

const CASTLING = ["e1g1", "e1c1", "e8g8", "e8c8"];
const castlesOf = (p: Position) => legalUci(p).filter((m) => CASTLING.includes(m));
const castles = (fen: string) => castlesOf(Position.fromFen(fen));

describe("enroque", () => {
  describe("derechos", () => {
    it("con todos los derechos y el camino libre, se puede enrocar a ambos lados", () => {
      assert.deepEqual(castles("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"), ["e1c1", "e1g1"]);
      assert.deepEqual(castles("r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1"), ["e8c8", "e8g8"]);
    });

    it("sin derechos no hay enroque aunque reyes y torres estén en su sitio", () => {
      assert.deepEqual(castles("r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1"), []);
    });

    it("cada derecho habilita solo su lado", () => {
      assert.deepEqual(castles("r3k2r/8/8/8/8/8/8/R3K2R w K - 0 1"), ["e1g1"]);
      assert.deepEqual(castles("r3k2r/8/8/8/8/8/8/R3K2R w Q - 0 1"), ["e1c1"]);
    });

    it("mover el rey (aunque vuelva) pierde los dos derechos", () => {
      const p = after("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "e1f1", "a8b8", "f1e1", "b8a8");
      assert.deepEqual(castlesOf(p), []);
      assert.match(p.toFen(), / w k - /);
    });

    it("mover una torre pierde el derecho de su lado", () => {
      const p = after("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "h1g1", "a8b8", "g1h1", "b8a8");
      assert.deepEqual(castlesOf(p), ["e1c1"]);
      assert.match(p.toFen(), / w Qk - /);
    });

    it("perder una torre (capturada en su casilla) quita el derecho de ese lado", () => {
      const p = after("r3k2r/1B6/8/8/8/8/8/R3K2R w KQkq - 0 1", "b7a8");
      assert.match(p.toFen(), / b KQk - /);
      assert.deepEqual(castlesOf(p), ["e8g8"]);
    });
  });

  describe("piezas en medio", () => {
    it("una pieza entre rey y torre impide el enroque de ese lado", () => {
      assert.deepEqual(castles("r3k2r/8/8/8/8/8/8/R3KB1R w KQkq - 0 1"), ["e1c1"]);
      assert.deepEqual(castles("r3k2r/8/8/8/8/8/8/R3K1NR w KQkq - 0 1"), ["e1c1"]);
    });

    it("una pieza en b1 impide el enroque largo aunque el rey no pase por b1", () => {
      assert.deepEqual(castles("r3k2r/8/8/8/8/8/8/RN2K2R w KQkq - 0 1"), ["e1g1"]);
    });

    it("una pieza rival en medio también lo impide", () => {
      assert.deepEqual(castles("r3k2r/8/8/8/8/8/8/R2nK2R w KQkq - 0 1").filter((m) => m === "e1c1"), []);
    });
  });

  describe("casillas atacadas", () => {
    it("no se puede enrocar estando en jaque", () => {
      assert.deepEqual(castles("4r1k1/8/8/8/8/8/8/R3K2R w KQ - 0 1"), []);
    });

    it("no se puede pasar por una casilla atacada (f1 / d1)", () => {
      assert.deepEqual(castles("5rk1/8/8/8/8/8/8/R3K2R w KQ - 0 1"), ["e1c1"]);
      assert.deepEqual(castles("3r2k1/8/8/8/8/8/8/R3K2R w KQ - 0 1"), ["e1g1"]);
    });

    it("no se puede acabar en una casilla atacada (g1 / c1)", () => {
      assert.deepEqual(castles("3k2r1/8/8/8/8/8/8/R3K2R w KQ - 0 1"), ["e1c1"]);
      assert.deepEqual(castles("2r3k1/8/8/8/8/8/8/R3K2R w KQ - 0 1"), ["e1g1"]);
    });

    it("que b1 esté atacada no impide el enroque largo (el rey no pasa por b1)", () => {
      assert.deepEqual(castles("1r4k1/8/8/8/8/8/8/R3K2R w KQ - 0 1"), ["e1c1", "e1g1"]);
    });

    it("que la torre esté atacada no impide el enroque", () => {
      assert.deepEqual(castles("r2k4/8/8/8/8/8/8/R3K2R w KQ - 0 1"), ["e1c1", "e1g1"]);
    });

    it("las negras siguen las mismas reglas (peón que ataca f8)", () => {
      assert.deepEqual(castles("r3k2r/6P1/8/8/8/8/8/4K3 b kq - 0 1"), ["e8c8"]);
    });
  });

  describe("efecto en el tablero", () => {
    it("el enroque corto lleva el rey a g1 y la torre a f1", () => {
      assert.equal(after("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 3 10", "e1g1").toFen(), "r3k2r/8/8/8/8/8/8/R4RK1 b kq - 4 10");
    });

    it("el enroque largo de negras lleva el rey a c8 y la torre a d8", () => {
      assert.equal(after("r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 10", "e8c8").toFen(), "2kr3r/8/8/8/8/8/8/R3K2R w KQ - 1 11");
    });

    it("deshacer un enroque restaura rey, torre y derechos", () => {
      const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
      const p = after(fen, "e1c1");
      p.unmakeMove();
      assert.equal(p.toFen(), fen);
    });
  });
});
