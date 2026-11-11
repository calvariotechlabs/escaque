// Búsqueda de Alfil Beta: negamax con alfa-beta, profundización iterativa,
// quietud, extensión de jaque y tabla de transposición.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Position, START_FEN } from "../src/core/index.js";
import { search, MATE_SCORE } from "../src/engine/index.js";
import { after } from "./helpers.js";
import { canMateIn } from "./mate.js";

const KIWIPETE = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";

const MATES_IN_1 = [
  "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1",
  "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
  "4r1k1/8/8/8/8/8/5PPP/6K1 b - - 0 1",
  "k7/8/1K6/8/8/8/8/6Q1 w - - 0 1",
];

const MATES_IN_2 = [
  "r1b2k1r/ppp1bppp/8/1B1Q4/5q2/2P5/PPP2PPP/R3R1K1 w - - 1 1",
  "2r3k1/5ppp/8/8/8/8/3R1PPP/3R2K1 w - - 0 1",
  "r5k1/5ppp/8/8/8/8/4RPPP/4R1K1 w - - 0 1",
];

/** Aplica una jugada UCI devuelta por el motor; falla si no es legal. */
function playUci(position: Position, uci: string): void {
  const move = position.moveFromUci(uci);
  assert.ok(move !== null, `${uci} no es legal en ${position.toFen()}`);
  position.makeMove(move);
}

describe("las posiciones de prueba son lo que dicen", () => {
  it("mates en 1 y en 2 comprobados por fuerza bruta", () => {
    for (const fen of MATES_IN_1) assert.ok(canMateIn(Position.fromFen(fen), 1), fen);
    for (const fen of MATES_IN_2) {
      assert.ok(!canMateIn(Position.fromFen(fen), 1), `${fen} tiene mate en 1`);
      assert.ok(canMateIn(Position.fromFen(fen), 2), fen);
    }
  });
});

describe("search()", () => {
  it("encuentra el mate en 1 y lo puntúa como mate a 1 media jugada", () => {
    for (const fen of MATES_IN_1) {
      const p = Position.fromFen(fen);
      const result = search(p, { maxDepth: 4 });
      assert.ok(result.best !== null);
      playUci(p, result.best);
      assert.equal(p.status().kind, "checkmate", `${fen}: ${result.best}`);
      assert.equal(result.score, MATE_SCORE - 1, fen);
    }
  });

  it("encuentra el mate en 2", () => {
    for (const fen of MATES_IN_2) {
      const p = Position.fromFen(fen);
      const result = search(p, { maxDepth: 5 });
      assert.ok(result.best !== null);
      assert.equal(result.score, MATE_SCORE - 3, `${fen}: ${result.best}`);
      playUci(p, result.best);
      // Tras la jugada, el rival no puede evitar el mate en 1.
      for (const reply of p.legalMoves()) {
        p.makeMove(reply);
        assert.ok(canMateIn(p, 1), `${fen}: ${result.best} y ${p.toFen()} escapa`);
        p.unmakeMove();
      }
    }
  });

  it("si recibe mate, retrasa el mate y lo puntúa en negativo", () => {
    // Solo hay Rb8, y después Dh8# o Db7#.
    const p = Position.fromFen("k7/8/1K6/8/8/8/8/7Q b - - 0 1");
    const result = search(p, { maxDepth: 4 });
    assert.equal(result.best, "a8b8");
    assert.equal(result.score, -MATE_SCORE + 2);
  });

  it("captura una pieza que se puede ganar gratis", () => {
    const result = search(Position.fromFen("4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1"), { maxDepth: 3 });
    assert.equal(result.best, "d2d5");
  });

  it("no captura un peón envenenado", () => {
    // Dxd5 perdería la dama por cxd5.
    const result = search(Position.fromFen("4k3/8/2p5/3p4/8/8/3Q4/4K3 w - - 0 1"), { maxDepth: 3 });
    assert.notEqual(result.best, "d2d5");
  });

  it("aparta una pieza atacada por un peón", () => {
    const result = search(Position.fromFen("4k3/8/8/2p5/3N4/8/8/4K3 w - - 0 1"), { maxDepth: 3 });
    assert.ok(result.best?.startsWith("d4"), `jugó ${result.best}`);
  });

  it("con mucha ventaja no ahoga al rival", () => {
    const p = Position.fromFen("7k/8/8/5Q2/8/8/8/6K1 w - - 0 1");
    const result = search(p, { maxDepth: 4 });
    assert.ok(result.best !== null);
    playUci(p, result.best);
    assert.notEqual(p.status().kind, "stalemate", result.best);
    assert.ok(result.score > 500);
  });

  it("valora una repetición como tablas", () => {
    // Las blancas tienen una dama de menos. Tras ir y volver con caballo y
    // rey, Cf3 repite una posición ya vista: la búsqueda la cuenta como tablas
    // (0) y la prefiere a cualquier otra jugada, que pierde.
    const p = after("k7/8/8/8/8/8/q7/6NK w - - 0 1", "g1f3", "a8b8", "f3g1", "b8a8");
    const result = search(p, { maxDepth: 2 });
    assert.equal(result.best, "g1f3");
    assert.equal(result.score, 0);
  });

  it("devuelve null y la puntuación de mate si no hay jugadas", () => {
    const mated = after("rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2", "d8h4");
    const result = search(mated, { maxDepth: 3 });
    assert.equal(result.best, null);
    assert.equal(result.score, -MATE_SCORE);
    const stalemate = search(Position.fromFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"), { maxDepth: 3 });
    assert.equal(stalemate.best, null);
    assert.equal(stalemate.score, 0);
  });

  it("respeta la profundidad máxima y da la variante principal", () => {
    const result = search(Position.fromFen(START_FEN), { maxDepth: 3 });
    assert.equal(result.depth, 3);
    assert.ok(result.pv.length >= 1 && result.pv[0] === result.best);
    assert.ok(result.nodes > 0);
    // La variante principal es una serie de jugadas legales.
    const p = Position.fromFen(START_FEN);
    for (const uci of result.pv) playUci(p, uci);
  });

  it("respeta el límite de tiempo y siempre devuelve una jugada", () => {
    const started = performance.now();
    const result = search(Position.fromFen(KIWIPETE), { timeMs: 150 });
    const elapsed = performance.now() - started;
    assert.ok(elapsed < 400, `tardó ${elapsed.toFixed(0)} ms`);
    assert.ok(result.best !== null && result.depth >= 1);
  });

  it("deja la posición como estaba", () => {
    const p = after(START_FEN, "e2e4", "e7e5", "g1f3");
    const fen = p.toFen();
    const key = `${p.hashHi}:${p.hashLo}`;
    search(p, { maxDepth: 3 });
    assert.equal(p.toFen(), fen);
    assert.equal(`${p.hashHi}:${p.hashLo}`, key);
    p.unmakeMove();
    assert.equal(p.toFen(), "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2");
  });

  it("da el mismo resultado si se repite", () => {
    const a = search(Position.fromFen(KIWIPETE), { maxDepth: 3 });
    const b = search(Position.fromFen(KIWIPETE), { maxDepth: 3 });
    assert.deepEqual([a.best, a.score, a.depth], [b.best, b.score, b.depth]);
  });
});
