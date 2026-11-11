// Evaluación de Alfil Beta: material más tablas de valor por casilla, en
// centipeones y desde el punto de vista del bando que mueve.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Position, START_FEN } from "../src/core/index.js";
import { evaluate, PIECE_VALUES } from "../src/engine/index.js";

const evalOf = (fen: string): number => evaluate(Position.fromFen(fen));

/** La misma posición con los colores cambiados y el tablero reflejado. */
function mirror(fen: string): string {
  const [placement, turn, castling, ep, half = "0", full = "1"] = fen.split(" ") as [string, string, string, string, string?, string?];
  const swap = (s: string): string => [...s].map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join("");
  const rows = placement.split("/").reverse().map(swap).join("/");
  const rights = castling === "-" ? "-" : [...swap(castling)].sort((a, b) => "KQkq".indexOf(a) - "KQkq".indexOf(b)).join("");
  const epSquare = ep === "-" ? "-" : ep[0]! + (ep[1] === "3" ? "6" : "3");
  return [rows, turn === "w" ? "b" : "w", rights, epSquare, half, full].join(" ");
}

const SAMPLES = [
  START_FEN,
  "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
  "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",
  "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
  "8/8/4k3/8/2P5/8/5K2/8 b - - 0 1",
];

describe("evaluate()", () => {
  it("la posición inicial vale 0", () => {
    assert.equal(evalOf(START_FEN), 0);
  });

  it("es simétrica: cambiar los colores no cambia la valoración para quien mueve", () => {
    for (const fen of SAMPLES) assert.equal(evalOf(fen), evalOf(mirror(fen)), fen);
  });

  it("se da desde el punto de vista del bando que mueve", () => {
    for (const fen of SAMPLES) {
      const other = fen.replace(/ ([wb]) /, (_, t: string) => ` ${t === "w" ? "b" : "w"} `).replace(/ [a-h][36] /, " - ");
      let flipped: Position;
      try {
        flipped = Position.fromFen(other);
      } catch {
        continue; // el bando que no movería quedaría en jaque
      }
      assert.equal(evaluate(flipped) + evalOf(fen), 0, fen);
    }
  });

  it("valora el material con los valores del plan", () => {
    assert.deepEqual(PIECE_VALUES, { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 });
    // Una dama de más pesa casi lo que vale, aunque las casillas la maticen.
    const up = evalOf("rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    assert.ok(up > 850 && up < 950, `dama de más: ${up}`);
  });

  it("prefiere un caballo en el centro a uno en la esquina", () => {
    assert.ok(evalOf("4k3/8/8/8/3N4/8/8/4K3 w - - 0 1") > evalOf("4k3/8/8/8/8/8/8/N3K3 w - - 0 1"));
  });

  it("en el medio juego quiere el rey resguardado; en el final, centralizado", () => {
    const middle = "rnbq1rk1/pppppppp/8/8/8/8/PPPPPPPP/RNBQ1RK1 w - - 0 1";
    const middleExposed = "rnbq1rk1/pppppppp/8/8/4K3/8/PPPPPPPP/RNBQ1R2 w - - 0 1";
    assert.ok(evalOf(middle) > evalOf(middleExposed), "medio juego");
    const ending = "8/8/4k3/8/8/8/P7/7K w - - 0 1";
    const endingCentral = "8/8/4k3/8/3K4/8/P7/8 w - - 0 1";
    assert.ok(evalOf(endingCentral) > evalOf(ending), "final");
  });

  it("no cambia la posición", () => {
    const p = Position.fromFen(SAMPLES[1]!);
    const fen = p.toFen();
    evaluate(p);
    assert.equal(p.toFen(), fen);
  });
});
