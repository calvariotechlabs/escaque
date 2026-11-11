// Captura al paso.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Position, START_FEN } from "../src/core/index.js";
import { after, legalUci } from "./helpers.js";

const has = (p: Position, uci: string) => legalUci(p).includes(uci);

describe("captura al paso", () => {
  it("el avance doble deja la casilla al paso en la FEN", () => {
    assert.match(after(START_FEN, "e2e4").toFen(), / b KQkq e3 /);
    assert.match(after(START_FEN, "e2e4", "d7d5").toFen(), / w KQkq d6 /);
  });

  it("un avance sencillo no deja casilla al paso", () => {
    assert.match(after(START_FEN, "e2e3").toFen(), / b KQkq - /);
  });

  it("se puede capturar al paso justo después del avance doble", () => {
    const p = after("4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1", "d7d5");
    assert.ok(has(p, "e5d6"));
  });

  it("la captura quita el peón que avanzó, no el de la casilla de destino", () => {
    const p = after("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", "e5d6");
    assert.equal(p.toFen(), "4k3/8/3P4/8/8/8/8/4K3 b - - 0 1");
  });

  it("las negras también capturan al paso", () => {
    const p = after("4k3/8/8/8/3Pp3/8/8/4K3 b - d3 0 1", "e4d3");
    assert.equal(p.toFen(), "4k3/8/8/8/8/3p4/8/4K3 w - - 0 2");
  });

  it("el derecho caduca si no se usa en la jugada siguiente", () => {
    const p = after("4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1", "d7d5", "e1d1", "e8d8");
    assert.ok(!has(p, "e5d6"));
  });

  it("solo puede capturar un peón situado al lado", () => {
    const p = after("4k3/3p4/8/6P1/8/8/8/4K3 b - - 0 1", "d7d5");
    assert.ok(!has(p, "g5d6"));
    assert.deepEqual(legalUci(p).filter((m) => m.startsWith("g5")), ["g5g6"]);
  });

  it("no es legal si deja al rey en jaque por la fila (clavada horizontal de dos peones)", () => {
    // Al capturar desaparecen d5 y e5 de la fila 5 y la torre de h5 ataca al rey de a5.
    const p = Position.fromFen("4k3/8/8/K2pP2r/8/8/8/8 w - d6 0 1");
    assert.ok(!has(p, "e5d6"));
    assert.ok(has(p, "e5e6"));
  });

  it("no es legal si el peón que captura está clavado en diagonal", () => {
    // El alfil de g7 clava el peón de e5 contra el rey de c3; d6 se sale de la diagonal.
    const p = Position.fromFen("4k3/6b1/8/3pP3/8/2K5/8/8 w - d6 0 1");
    assert.ok(!has(p, "e5d6"));
  });

  it("sí es legal si la captura se mueve a lo largo de la clavada", () => {
    // El alfil de c7 clava e5 contra el rey de g3; d6 sigue en esa diagonal.
    const p = Position.fromFen("4k3/2b5/8/3pP3/8/6K1/8/8 w - d6 0 1");
    assert.ok(has(p, "e5d6"));
    assert.ok(!has(p, "e5e6"));
  });

  it("es legal si elimina al peón que da jaque", () => {
    // El peón de d4 acaba de avanzar dos casillas y da jaque al rey de c5.
    const p = Position.fromFen("8/8/8/2k5/3Pp3/8/8/4K3 b - d3 0 1");
    assert.ok(p.isCheck());
    assert.ok(has(p, "e4d3"));
  });

  it("deshacer la captura al paso devuelve el peón capturado", () => {
    const fen = "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1";
    const p = after(fen, "e5d6");
    p.unmakeMove();
    assert.equal(p.toFen(), fen);
  });
});
