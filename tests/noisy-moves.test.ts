// noisyMoves(): las jugadas legales «ruidosas» (capturas, al paso y coronaciones) que
// usa la búsqueda de quietud de Alfil Beta sin generar ni comprobar las demás (B11).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Position, moveToUci } from "../src/core/index.js";
import type { Move } from "../src/core/index.js";
import { PERFT_POSITIONS } from "./perft-positions.js";

/** ¿Captura (también al paso) o corona? Se decide con el tablero de antes de jugarla. */
function isNoisy(p: Position, m: Move): boolean {
  if (m.promotion !== null) return true;
  if (p.pieceAt(m.to) !== null) return true;
  const mover = p.pieceAt(m.from)!;
  return mover.type === "p" && (m.from & 7) !== (m.to & 7);
}

const ucis = (moves: readonly Move[]): string[] => moves.map(moveToUci).sort();

/** Recorre el árbol a `depth` comprobando en cada nodo que noisyMoves() = legalMoves() filtradas. */
function walk(p: Position, depth: number): number {
  const legal = p.legalMoves();
  const expected = ucis(legal.filter((m) => isNoisy(p, m)));
  assert.deepEqual(ucis(p.noisyMoves()), expected, p.toFen());
  let nodes = 1;
  if (depth === 0) return nodes;
  for (const m of p.legalMoves()) {
    p.makeMove(m);
    nodes += walk(p, depth - 1);
    p.unmakeMove();
  }
  return nodes;
}

describe("noisyMoves()", () => {
  for (const ref of PERFT_POSITIONS) {
    it(`coincide con las capturas y coronaciones de legalMoves() en «${ref.name}»`, () => {
      assert.ok(walk(Position.fromFen(ref.fen), 2) > 0);
    });
  }

  it("sus jugadas valen para makeMove y dejan la posición igual al deshacerlas", () => {
    const p = Position.fromFen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1");
    const before = p.toFen();
    for (const m of p.noisyMoves()) {
      p.makeMove(m);
      p.unmakeMove();
    }
    assert.equal(p.toFen(), before);
  });

  it("devuelve una copia: cambiarla no afecta a la posición", () => {
    const p = Position.fromFen("4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1");
    const moves = p.noisyMoves();
    assert.deepEqual(ucis(moves), ["e4d5"]);
    moves.length = 0;
    const again = p.noisyMoves();
    p.makeMove(again[0]!);
    assert.equal(p.toFen().split(" ")[0], "4k3/8/8/3P4/8/8/8/4K3");
  });

  it("no recorta la lista de moveFromUci, moveFromSan ni moveToSan (revisión de código)", () => {
    const p = Position.fromFen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1");
    p.noisyMoves();
    const quiet = p.moveFromUci("a2a3");
    assert.ok(quiet !== null, "a2a3 es legal");
    assert.equal(p.moveToSan(quiet!), "a3");
    assert.ok(p.moveFromSan("Kd1") !== null);
    p.makeMove(quiet!);
    assert.equal(p.turn, "b");
  });
});
