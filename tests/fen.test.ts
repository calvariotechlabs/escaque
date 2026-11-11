// Lectura y escritura de FEN.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FenError, Position, START_FEN } from "../src/core/index.js";
import { after } from "./helpers.js";
import { PERFT_POSITIONS } from "./perft-positions.js";

describe("FEN", () => {
  it("la posición inicial va y vuelve sin cambios", () => {
    assert.equal(Position.fromFen(START_FEN).toFen(), START_FEN);
  });

  for (const ref of PERFT_POSITIONS) {
    it(`ida y vuelta: ${ref.name}`, () => {
      assert.equal(Position.fromFen(ref.fen).toFen(), ref.fen);
    });
  }

  it("acepta FEN sin relojes y los completa con «0 1»", () => {
    const fen = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -";
    assert.equal(Position.fromFen(fen).toFen(), `${fen} 0 1`);
  });

  it("lee el turno", () => {
    assert.equal(Position.fromFen(START_FEN).turn, "w");
    assert.equal(Position.fromFen("4k3/8/8/8/8/8/8/4K3 b - - 0 1").turn, "b");
  });

  it("actualiza turno, al paso y relojes al jugar", () => {
    assert.equal(after(START_FEN, "e2e4").toFen(), "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");
    assert.equal(
      after(START_FEN, "e2e4", "c7c5", "g1f3").toFen(),
      "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
    );
  });

  it("el reloj de 50 jugadas vuelve a 0 con una captura", () => {
    const fen = "4k3/8/8/3p4/8/8/8/3RK3 w - - 7 30";
    assert.equal(after(fen, "d1d5").toFen(), "4k3/8/8/3R4/8/8/8/4K3 b - - 0 30");
  });

  const invalid: Array<[string, string]> = [
    ["vacía", ""],
    ["sin turno", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR"],
    ["siete filas", "rnbqkbnr/pppppppp/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"],
    ["fila con nueve casillas", "rnbqkbnr/pppppppp/9/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"],
    ["pieza desconocida", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNX w KQkq - 0 1"],
    ["letra que solo parece una pieza (signo Kelvin)", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQ\u212ABNR w KQkq - 0 1"],
    ["turno inválido", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1"],
    ["enroque inválido", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQxq - 0 1"],
    ["derecho de enroque sin la torre", "4k3/8/8/8/8/8/8/R3K3 w K - 0 1"],
    ["derecho de enroque con el rey fuera de su casilla", "r3k2r/8/8/8/8/8/8/R2K3R w Q - 0 1"],
    ["al paso fuera de la fila 3 o 6", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq e4 0 1"],
    ["al paso sin el peón que avanzó", "4k3/8/8/4P3/8/8/8/4K3 w - d6 0 1"],
    ["al paso con la casilla de salida ocupada", "4k3/3p4/8/3pP3/8/8/8/4K3 w - d6 0 1"],
    ["reloj negativo", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - -1 1"],
    ["sin rey blanco", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQ1BNR w kq - 0 1"],
    ["dos reyes negros", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNk w - - 0 1"],
    ["peón en la primera fila", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNP w Qkq - 0 1"],
    ["el bando que no mueve está en jaque", "4k3/4R3/8/8/8/8/8/4K3 w - - 0 1"],
  ];
  for (const [label, fen] of invalid) {
    it(`rechaza con FenError: ${label}`, () => {
      assert.throws(() => Position.fromFen(fen), FenError);
    });
  }
});
