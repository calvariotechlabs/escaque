// Notación algebraica estándar (SAN), en inglés como en PGN: N B R Q K.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Position, START_FEN, moveToUci } from "../src/core/index.js";
import { after } from "./helpers.js";

const KIWIPETE = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";

/** SAN de la jugada UCI en la posición. */
function san(position: Position, uci: string): string {
  const move = position.moveFromUci(uci);
  assert.ok(move !== null, `${uci} no es legal en ${position.toFen()}`);
  return position.moveToSan(move!);
}

describe("SAN: escritura", () => {
  it("las 20 jugadas de la posición inicial", () => {
    const p = Position.fromFen(START_FEN);
    const all = p.legalMoves().map((m) => p.moveToSan(m)).sort();
    assert.deepEqual(all, [
      "Na3", "Nc3", "Nf3", "Nh3",
      "a3", "a4", "b3", "b4", "c3", "c4", "d3", "d4", "e3", "e4", "f3", "f4", "g3", "g4", "h3", "h4",
    ]);
  });

  it("captura de peón con la columna de salida", () => {
    assert.equal(san(after(START_FEN, "e2e4", "d7d5"), "e4d5"), "exd5");
  });

  it("captura al paso", () => {
    assert.equal(san(Position.fromFen("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1"), "e5d6"), "exd6");
  });

  it("captura de pieza", () => {
    assert.equal(san(Position.fromFen(KIWIPETE), "f3f6"), "Qxf6");
  });

  it("enroques corto y largo", () => {
    const p = Position.fromFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    assert.equal(san(p, "e1g1"), "O-O");
    assert.equal(san(p, "e1c1"), "O-O-O");
  });

  it("enroque que da jaque", () => {
    assert.equal(san(Position.fromFen("5k2/8/8/8/8/8/8/4K2R w K - 0 1"), "e1g1"), "O-O+");
  });

  it("coronación, con captura y jaque", () => {
    const p = Position.fromFen("1n5k/P7/8/8/8/8/8/K7 w - - 0 1");
    assert.equal(san(p, "a7b8q"), "axb8=Q+");
    assert.equal(san(p, "a7b8r"), "axb8=R+");
    assert.equal(san(p, "a7b8b"), "axb8=B");
    assert.equal(san(p, "a7b8n"), "axb8=N");
    assert.equal(san(p, "a7a8q"), "a8=Q");
  });

  it("jaque y jaque mate", () => {
    assert.equal(san(after(START_FEN, "e2e4", "e7e5"), "d1h5"), "Qh5");
    assert.equal(san(after(START_FEN, "e2e4", "e7e5", "f1c4", "b8c6", "d1h5", "g8f6"), "h5f7"), "Qxf7#");
    assert.equal(san(after(START_FEN, "e2e4", "f7f6"), "d1h5"), "Qh5+");
  });

  it("desambiguación por columna", () => {
    const p = Position.fromFen("4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1");
    assert.equal(san(p, "b1d2"), "Nbd2");
    assert.equal(san(p, "f1d2"), "Nfd2");
    assert.equal(san(p, "b1c3"), "Nc3");
  });

  it("desambiguación por fila", () => {
    const p = Position.fromFen("4k3/8/8/R7/8/8/8/R3K3 w - - 0 1");
    assert.equal(san(p, "a1a3"), "R1a3");
    assert.equal(san(p, "a5a3"), "R5a3");
  });

  it("desambiguación por columna y fila", () => {
    const p = Position.fromFen("8/7k/8/8/Q7/8/7K/Q2Q4 w - - 0 1");
    assert.equal(san(p, "a1d4"), "Qa1d4");
    assert.equal(san(p, "a4d4"), "Q4d4");
    assert.equal(san(p, "d1d4"), "Qdd4");
  });

  it("una pieza clavada no obliga a desambiguar", () => {
    // El caballo de c3 está clavado por el alfil de b4: solo el de g1 puede ir a e2.
    assert.equal(san(Position.fromFen("4k3/8/8/8/1b6/2N5/8/4K1N1 w - - 0 1"), "g1e2"), "Ne2");
  });

  it("todas las jugadas de Kiwipete tienen una SAN distinta", () => {
    const p = Position.fromFen(KIWIPETE);
    const all = p.legalMoves().map((m) => p.moveToSan(m));
    assert.equal(all.length, 48);
    assert.equal(new Set(all).size, 48);
  });

  it("rechaza una jugada que no es legal en la posición", () => {
    const other = Position.fromFen(START_FEN);
    const e4 = other.moveFromUci("e2e4")!;
    const p = after(START_FEN, "e2e4");
    assert.throws(() => p.moveToSan(e4));
  });

  it("no cambia la posición ni invalida las jugadas de legalMoves()", () => {
    const p = Position.fromFen(KIWIPETE);
    const moves = p.legalMoves();
    for (const m of moves) p.moveToSan(m);
    assert.equal(p.toFen(), KIWIPETE);
    p.makeMove(moves[0]!);
    assert.equal(p.turn, "b");
  });
});

describe("SAN: lectura", () => {
  it("ida y vuelta con todas las jugadas de varias posiciones", () => {
    const fens = [START_FEN, KIWIPETE, "1n5k/P7/8/8/8/8/8/K7 w - - 0 1", "8/7k/8/8/Q7/8/7K/Q2Q4 w - - 0 1", "r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1"];
    for (const fen of fens) {
      const p = Position.fromFen(fen);
      for (const m of p.legalMoves()) {
        const text = p.moveToSan(m);
        const back = p.moveFromSan(text);
        assert.ok(back !== null, `${text} no se reconoce en ${fen}`);
        assert.equal(moveToUci(back!), moveToUci(m), `${text} en ${fen}`);
      }
    }
  });

  it("devuelve una jugada que makeMove acepta", () => {
    const p = Position.fromFen(START_FEN);
    p.makeMove(p.moveFromSan("Nf3")!);
    assert.equal(p.toFen(), "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1");
  });

  it("tolera variantes habituales", () => {
    const castle = Position.fromFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    assert.equal(moveToUci(castle.moveFromSan("0-0")!), "e1g1");
    assert.equal(moveToUci(castle.moveFromSan("0-0-0")!), "e1c1");
    const promo = Position.fromFen("1n5k/P7/8/8/8/8/8/K7 w - - 0 1");
    assert.equal(moveToUci(promo.moveFromSan("axb8Q")!), "a7b8q");
    assert.equal(moveToUci(promo.moveFromSan("axb8=N")!), "a7b8n");
    const start = Position.fromFen(START_FEN);
    assert.equal(moveToUci(start.moveFromSan("e4!?")!), "e2e4");
    assert.equal(moveToUci(start.moveFromSan(" Nf3 ")!), "g1f3");
    // El jaque se puede omitir o añadir sin que cambie la jugada.
    assert.equal(moveToUci(after(START_FEN, "e2e4", "f7f6").moveFromSan("Qh5")!), "d1h5");
  });

  it("devuelve null si la jugada no es legal, es ambigua o no es SAN", () => {
    const start = Position.fromFen(START_FEN);
    assert.equal(start.moveFromSan("Ke2"), null);
    assert.equal(start.moveFromSan("e5"), null);
    assert.equal(start.moveFromSan(""), null);
    assert.equal(start.moveFromSan("hola"), null);
    assert.equal(start.moveFromSan("N".repeat(10_000)), null);
    assert.equal(Position.fromFen("4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1").moveFromSan("Nd2"), null);
  });
});
