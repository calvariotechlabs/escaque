// Triple repetición: la misma posición aparece tres veces con el mismo bando
// al mover, los mismos derechos de enroque y las mismas capturas al paso
// posibles (artículo 9.2 de las Leyes del Ajedrez de la FIDE). Tablas automáticas.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Position, START_FEN } from "../src/core/index.js";
import { after, play } from "./helpers.js";

const KNIGHTS_OUT_AND_BACK = ["g1f3", "g8f6", "f3g1", "f6g8"];

describe("triple repetición", () => {
  it("la posición inicial repetida tres veces es tablas", () => {
    const p = Position.fromFen(START_FEN);
    play(p, ...KNIGHTS_OUT_AND_BACK);
    assert.deepEqual(p.status(), { kind: "ongoing" }, "dos veces todavía no es tablas");
    play(p, "g1f3", "g8f6", "f3g1");
    assert.deepEqual(p.status(), { kind: "ongoing" });
    play(p, "f6g8");
    assert.deepEqual(p.status(), { kind: "threefold-repetition" });
  });

  it("las repeticiones no tienen que ser seguidas", () => {
    const p = Position.fromFen(START_FEN);
    play(p, ...KNIGHTS_OUT_AND_BACK, "b1c3", "b8c6", "c3b1", "c6b8");
    assert.deepEqual(p.status(), { kind: "threefold-repetition" });
  });

  it("una posición con distintos derechos de enroque es otra posición", () => {
    // La torre sale y vuelve: mismo tablero que al empezar, pero sin el enroque corto blanco.
    const p = after(START_FEN, "g1f3", "g8f6", "h1g1", "f6g8", "g1h1", "g8f6", "f3g1", "f6g8");
    play(p, ...KNIGHTS_OUT_AND_BACK);
    assert.deepEqual(p.status(), { kind: "ongoing" }, "solo dos veces sin el enroque corto");
    play(p, ...KNIGHTS_OUT_AND_BACK);
    assert.deepEqual(p.status(), { kind: "threefold-repetition" });
  });

  it("una casilla al paso sin captura posible no cambia la posición", () => {
    // Tras 1.e4 la FEN marca e3, pero ningún peón negro puede capturar al paso.
    const p = after(START_FEN, "e2e4");
    play(p, "g8f6", "g1f3", "f6g8", "f3g1");
    assert.deepEqual(p.status(), { kind: "ongoing" });
    play(p, "g8f6", "g1f3", "f6g8", "f3g1");
    assert.deepEqual(p.status(), { kind: "threefold-repetition" });
  });

  it("una captura al paso posible hace distinta la posición", () => {
    // Tras ...d5 las blancas pueden jugar exd6 al paso; cuando vuelve el mismo
    // tablero ese derecho ya se ha perdido.
    const p = after("4k3/3p4/8/4P3/8/8/8/4K1N1 b - - 0 1", "d7d5");
    const cycle = ["g1f3", "e8e7", "f3g1", "e7e8"];
    play(p, ...cycle, ...cycle);
    assert.deepEqual(p.status(), { kind: "ongoing" }, "la primera vez se podía capturar al paso");
    play(p, ...cycle);
    assert.deepEqual(p.status(), { kind: "threefold-repetition" });
  });

  it("una captura al paso clavada no cuenta como posible", () => {
    // El peón blanco de e5 está clavado por la torre de a5: exd6 dejaría al rey en jaque.
    const p = after("4k3/3p4/8/r3P2K/8/8/8/6N1 b - - 0 1", "d7d5");
    play(p, "g1f3", "e8e7", "f3g1", "e7e8");
    play(p, "g1f3", "e8e7", "f3g1");
    assert.deepEqual(p.status(), { kind: "ongoing" });
    play(p, "e7e8");
    assert.deepEqual(p.status(), { kind: "threefold-repetition" });
  });

  it("deshacer la tercera repetición devuelve la partida a en juego", () => {
    const p = after(START_FEN, ...KNIGHTS_OUT_AND_BACK, ...KNIGHTS_OUT_AND_BACK);
    p.unmakeMove();
    assert.deepEqual(p.status(), { kind: "ongoing" });
  });

  it("una posición cargada desde FEN no tiene historia previa", () => {
    assert.deepEqual(Position.fromFen(START_FEN).status(), { kind: "ongoing" });
  });
});

describe("status()", () => {
  it("no cambia la posición", () => {
    const p = after(START_FEN, ...KNIGHTS_OUT_AND_BACK, "e2e4");
    const fen = p.toFen();
    p.status();
    assert.equal(p.toFen(), fen);
    p.unmakeMove();
    assert.equal(p.toFen(), "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 4 3");
  });

  it("no invalida las jugadas ya obtenidas con legalMoves()", () => {
    const p = after(START_FEN, ...KNIGHTS_OUT_AND_BACK);
    const moves = p.legalMoves();
    p.status();
    p.makeMove(moves[0]!);
    assert.equal(p.turn, "b");
  });

  it("la triple repetición se detecta también tras volver con unmakeMove", () => {
    const p = after(START_FEN, ...KNIGHTS_OUT_AND_BACK, ...KNIGHTS_OUT_AND_BACK, "e2e4");
    p.unmakeMove();
    assert.deepEqual(p.status(), { kind: "threefold-repetition" });
  });
});
