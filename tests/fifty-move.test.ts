// Regla de 50 jugadas: 100 medias jugadas seguidas sin mover un peón ni capturar.
// En Escaque las tablas son automáticas (no hay que reclamarlas), como en la
// mayoría de programas de ajedrez para aprender.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Position } from "../src/core/index.js";
import { after } from "./helpers.js";

describe("regla de 50 jugadas", () => {
  it("una posición cargada con el reloj a 100 ya es tablas", () => {
    const p = Position.fromFen("4k3/8/8/8/8/8/8/R3K3 w - - 100 120");
    assert.deepEqual(p.status(), { kind: "fifty-move" });
  });

  it("la jugada número 100 sin peón ni captura deja la partida en tablas", () => {
    const p = after("4k3/8/8/8/8/8/8/R3K3 w - - 99 120", "a1a2");
    assert.equal(p.toFen().split(" ")[4], "100");
    assert.deepEqual(p.status(), { kind: "fifty-move" });
  });

  it("con el reloj a 99 la partida sigue", () => {
    const p = after("4k3/8/8/8/8/8/8/R3K3 w - - 98 120", "a1a2");
    assert.deepEqual(p.status(), { kind: "ongoing" });
  });

  it("un movimiento de peón pone el reloj a cero", () => {
    const p = after("4k3/8/8/8/8/8/P7/R3K3 w - - 99 120", "a2a3");
    assert.deepEqual(p.status(), { kind: "ongoing" });
  });

  it("una captura pone el reloj a cero", () => {
    const p = after("4k3/8/8/8/8/8/r7/R3K3 w - - 99 120", "a1a2");
    assert.deepEqual(p.status(), { kind: "ongoing" });
  });

  it("si la jugada número 100 da mate, gana el mate", () => {
    const p = after("7k/8/6K1/8/8/8/8/5Q2 w - - 99 120", "f1f8");
    assert.deepEqual(p.status(), { kind: "checkmate", winner: "w" });
  });

  it("si la jugada número 100 ahoga, es ahogado", () => {
    const p = after("7k/8/6K1/8/8/8/8/5Q2 w - - 99 120", "f1f7");
    assert.deepEqual(p.status(), { kind: "stalemate" });
  });

  it("deshacer la jugada número 100 devuelve la partida a en juego", () => {
    const p = after("4k3/8/8/8/8/8/8/R3K3 w - - 99 120", "a1a2");
    p.unmakeMove();
    assert.deepEqual(p.status(), { kind: "ongoing" });
  });
});
