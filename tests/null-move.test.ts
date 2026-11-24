// makeNullMove(): «pasar» el turno dentro de la búsqueda (poda de jugada nula, B11).
// No es una jugada del ajedrez: solo la usa el motor y siempre la deshace.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Position } from "../src/core/index.js";

const KIWIPETE = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";

describe("makeNullMove()", () => {
  it("cambia el turno y deja la misma clave que la posición con el otro bando al mover", () => {
    const p = Position.fromFen(KIWIPETE);
    p.makeNullMove();
    assert.equal(p.turn, "b");
    const same = Position.fromFen(KIWIPETE.replace(" w ", " b "));
    assert.equal(p.hashHi, same.hashHi);
    assert.equal(p.hashLo, same.hashLo);
    assert.deepEqual(p.legalMoves().length, same.legalMoves().length);
  });

  it("borra la captura al paso y unmakeNullMove deja la posición como estaba", () => {
    const fen = "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 3";
    const p = Position.fromFen(fen);
    const { hashHi, hashLo } = p;
    p.makeNullMove();
    assert.equal(p.toFen().split(" ")[3], "-");
    p.unmakeNullMove();
    assert.equal(p.toFen(), fen);
    assert.equal(p.hashHi, hashHi);
    assert.equal(p.hashLo, hashLo);
    assert.ok(p.moveFromUci("e5d6") !== null);
  });

  it("no se puede pasar estando en jaque", () => {
    const p = Position.fromFen("4k3/8/8/8/8/8/4r3/4K3 w - - 0 1");
    assert.throws(() => p.makeNullMove());
  });

  it("las repeticiones no cruzan la jugada nula", () => {
    const p = Position.fromFen("4k3/8/8/8/8/8/8/R3K3 w - - 0 1");
    for (const uci of ["a1a2", "e8e7", "a2a1", "e7e8"]) p.makeMove(p.moveFromUci(uci)!);
    assert.equal(p.repetitions(), 1);
    p.makeNullMove();
    p.makeMove(p.moveFromUci("e8e7")!);
    p.makeNullMove();
    p.makeMove(p.moveFromUci("e7e8")!);
    assert.equal(p.repetitions(), 0);
  });

  it("unmakeMove no deshace una jugada nula, ni unmakeNullMove una normal", () => {
    const p = Position.fromFen(KIWIPETE);
    p.makeNullMove();
    assert.throws(() => p.unmakeMove());
    p.unmakeNullMove();
    p.makeMove(p.legalMoves()[0]!);
    assert.throws(() => p.unmakeNullMove());
  });

  it("tras la jugada nula, las jugadas de una lista anterior de ese ply no valen", () => {
    const p = Position.fromFen(KIWIPETE);
    p.makeMove(p.moveFromUci("e1g1")!);
    const old = p.legalMoves();
    p.unmakeMove();
    p.makeNullMove();
    assert.throws(() => p.makeMove(old[0]!));
  });

  it("conserva la línea: tras pasar y deshacer, rehacer la misma jugada sigue valiendo", () => {
    const p = Position.fromFen(KIWIPETE);
    const moves = p.legalMoves();
    const m = moves.find((x) => x.from === 0x04 && x.to === 0x06)!; // O-O
    p.makeNullMove();
    p.makeMove(p.legalMoves()[0]!);
    p.unmakeMove();
    p.unmakeNullMove();
    p.makeMove(m);
    assert.equal(p.turn, "b");
  });
});
