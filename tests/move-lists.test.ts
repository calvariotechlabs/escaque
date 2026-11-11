// Las jugadas obtenidas con legalMoves() siguen valiendo para makeMove mientras
// la posición no cambie: leer SAN o UCI, pedir el estado o formatear jugadas no
// las invalida, y deshacer y rehacer la misma línea tampoco.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Position, START_FEN, moveToUci } from "../src/core/index.js";
import type { Move } from "../src/core/index.js";

/** Jugada de la lista con esa notación UCI. */
function pick(moves: readonly Move[], uci: string): Move {
  const move = moves.find((m) => moveToUci(m) === uci);
  assert.ok(move !== undefined, `${uci} no está en la lista`);
  return move!;
}

describe("Listas de legalMoves()", () => {
  it("moveFromSan no invalida las jugadas ya obtenidas", () => {
    const p = Position.fromFen(START_FEN);
    const moves = p.legalMoves();
    assert.ok(p.moveFromSan("Nf3") !== null);
    p.makeMove(pick(moves, "e2e4"));
    assert.equal(p.turn, "b");
  });

  it("moveFromUci no invalida las jugadas ya obtenidas", () => {
    const p = Position.fromFen(START_FEN);
    const moves = p.legalMoves();
    assert.ok(p.moveFromUci("g1f3") !== null);
    p.makeMove(pick(moves, "e2e4"));
    assert.equal(p.turn, "b");
  });

  it("moveFromSan y moveFromUci devuelven jugadas de la lista ya obtenida", () => {
    const p = Position.fromFen(START_FEN);
    const moves = p.legalMoves();
    assert.ok(moves.includes(p.moveFromSan("e4")!));
    assert.ok(moves.includes(p.moveFromUci("e2e4")!));
  });

  it("rehacer la misma jugada tras deshacerla conserva la lista del ply siguiente", () => {
    const p = Position.fromFen(START_FEN);
    const e4 = pick(p.legalMoves(), "e2e4");
    p.makeMove(e4);
    const replies = p.legalMoves();
    p.unmakeMove();
    p.makeMove(e4);
    p.makeMove(pick(replies, "e7e5"));
    assert.equal(p.toFen(), "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2");
  });

  it("status() y moveToSan() entre deshacer y rehacer no rompen la línea", () => {
    const p = Position.fromFen(START_FEN);
    const first = p.legalMoves();
    const e4 = pick(first, "e2e4");
    p.makeMove(e4);
    const replies = p.legalMoves();
    p.unmakeMove();
    p.status();
    for (const m of first) p.moveToSan(m);
    p.makeMove(e4);
    p.status();
    p.makeMove(pick(replies, "e7e5"));
    assert.equal(p.turn, "w");
  });

  it("llegar al ply con otra jugada descarta la lista vieja", () => {
    const p = Position.fromFen(START_FEN);
    const first = p.legalMoves();
    p.makeMove(pick(first, "e2e4"));
    const replies = p.legalMoves();
    p.unmakeMove();
    p.makeMove(pick(first, "d2d4"));
    assert.throws(() => p.makeMove(pick(replies, "e7e5")));
  });

  it("la lista vieja de un ply profundo también se descarta al cambiar de línea antes", () => {
    const p = Position.fromFen(START_FEN);
    const first = p.legalMoves();
    p.makeMove(pick(first, "e2e4"));
    p.makeMove(pick(p.legalMoves(), "e7e5"));
    const deep = p.legalMoves();
    p.unmakeMove();
    p.unmakeMove();
    // Otra línea que llega a la misma posición en el ply 2.
    p.makeMove(pick(first, "e2e3"));
    p.makeMove(pick(p.legalMoves(), "e7e5"));
    assert.throws(() => p.makeMove(pick(deep, "g1f3")));
  });
});

describe("moveFromSan: capturas", () => {
  it("rechaza una captura de pieza si en el destino no hay nada", () => {
    const p = Position.fromFen(START_FEN);
    assert.equal(p.moveFromSan("Nxf3"), null);
    assert.equal(p.moveFromSan("Ngxf3"), null);
    assert.equal(p.moveFromSan("Ng1xf3"), null);
  });

  it("rechaza una jugada de pieza sin «x» si el destino tiene una pieza rival", () => {
    // 1. e4 d5 2. Nc3: el caballo de c3 puede tomar en d5.
    const p = Position.fromFen("rnbqkbnr/ppp1pppp/8/3p4/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 0 2");
    assert.equal(p.moveFromSan("Nd5"), null);
    assert.equal(p.moveFromSan("Ncd5"), null);
    assert.equal(moveToUci(p.moveFromSan("Nxd5")!), "c3d5");
    assert.equal(moveToUci(p.moveFromSan("Ncxd5")!), "c3d5");
  });

  it("acepta la captura al paso, que llega a una casilla vacía", () => {
    const p = Position.fromFen("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1");
    assert.equal(moveToUci(p.moveFromSan("exd6")!), "e5d6");
    assert.equal(moveToUci(p.moveFromSan("exd6 e.p.")!), "e5d6");
  });

  it("rechaza una captura de peón sin pieza ni casilla al paso", () => {
    const p = Position.fromFen("4k3/8/8/4P3/8/8/8/4K3 w - - 0 1");
    assert.equal(p.moveFromSan("exd6"), null);
  });
});
