// Tests de la herramienta de perft y perft dividido, independientes del tablero.
// Usan un "juego" sintético cuyo árbol conocemos de antemano, así la herramienta
// se puede verificar antes de que exista el generador de jugadas real.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  compareDivide,
  formatDivide,
  parseDivide,
  perft,
  perftDivide,
  type PerftTarget,
} from "../src/core/perft.js";

/**
 * Árbol sintético: en cada nodo hay `branching(camino)` jugadas, numeradas 0..n-1.
 * Lleva la cuenta del camino para comprobar que hacer/deshacer quedan equilibrados.
 */
class TreeGame implements PerftTarget<number> {
  readonly path: number[] = [];
  constructor(private readonly branching: (path: readonly number[]) => number) {}
  legalMoves(): number[] {
    return Array.from({ length: this.branching(this.path) }, (_, i) => i);
  }
  makeMove(move: number): void {
    this.path.push(move);
  }
  unmakeMove(): void {
    if (this.path.pop() === undefined) throw new Error("unmakeMove sin jugada previa");
  }
}

describe("perft", () => {
  it("a profundidad 0 cuenta la propia posición", () => {
    assert.equal(perft(new TreeGame(() => 5), 0), 1);
  });

  it("con ramificación constante b a profundidad d cuenta b^d hojas", () => {
    assert.equal(perft(new TreeGame(() => 3), 4), 81);
  });

  it("cuenta solo hojas a la profundidad pedida, no nodos intermedios", () => {
    // La raíz tiene 2 jugadas; tras la jugada 0 hay 1 respuesta, tras la 1 hay 4.
    const game = new TreeGame((p) => (p.length === 0 ? 2 : p[0] === 0 ? 1 : 4));
    assert.equal(perft(game, 2), 5);
  });

  it("una rama sin jugadas (mate o ahogado) aporta 0 hojas a más profundidad", () => {
    const game = new TreeGame((p) => (p.length === 0 ? 2 : p[0] === 0 ? 0 : 3));
    assert.equal(perft(game, 2), 3);
  });

  it("deja la posición como estaba (hacer/deshacer equilibrados)", () => {
    const game = new TreeGame(() => 2);
    perft(game, 5);
    assert.deepEqual(game.path, []);
  });

  it("rechaza profundidades negativas o no enteras", () => {
    assert.throws(() => perft(new TreeGame(() => 1), -1), RangeError);
    assert.throws(() => perft(new TreeGame(() => 1), 1.5), RangeError);
  });
});

describe("perftDivide", () => {
  const game = () => new TreeGame((p) => (p.length === 0 ? 3 : p[0]! + 1));
  const name = (m: number) => `m${m}`;

  it("desglosa las hojas por jugada inicial y suma el total", () => {
    const result = perftDivide(game(), 2, name);
    assert.deepEqual(result.moves, [
      { move: "m0", nodes: 1 },
      { move: "m1", nodes: 2 },
      { move: "m2", nodes: 3 },
    ]);
    assert.equal(result.total, 6);
  });

  it("su total coincide con perft", () => {
    assert.equal(perftDivide(game(), 3, name).total, perft(game(), 3));
  });

  it("a profundidad 1 cada jugada cuenta 1", () => {
    assert.deepEqual(
      perftDivide(game(), 1, name).moves.map((m) => m.nodes),
      [1, 1, 1],
    );
  });

  it("ordena las jugadas alfabéticamente para poder comparar con otra herramienta", () => {
    const g = new TreeGame((p) => (p.length === 0 ? 3 : 1));
    const order = ["e2e4", "a2a3", "b1c3"];
    const result = perftDivide(g, 1, (m) => order[m]!);
    assert.deepEqual(result.moves.map((m) => m.move), ["a2a3", "b1c3", "e2e4"]);
  });

  it("rechaza profundidad 0 (no hay jugadas que desglosar)", () => {
    assert.throws(() => perftDivide(game(), 0, name), RangeError);
  });
});

describe("formatDivide", () => {
  it("usa el formato de Stockfish (go perft): «jugada: nodos», línea en blanco y total", () => {
    const text = formatDivide({
      moves: [
        { move: "a2a3", nodes: 380 },
        { move: "e2e4", nodes: 600 },
      ],
      total: 980,
    });
    assert.equal(text, "a2a3: 380\ne2e4: 600\n\nNodes searched: 980\n");
  });
});

describe("parseDivide", () => {
  it("lee la salida de Stockfish ignorando líneas que no son jugadas", () => {
    const text = [
      "info string NNUE evaluation using nn-xyz.nnue",
      "a2a3: 380",
      "e7e8q: 12",
      "",
      "Nodes searched: 392",
    ].join("\n");
    assert.deepEqual(
      [...parseDivide(text)],
      [
        ["a2a3", 380],
        ["e7e8q", 12],
      ],
    );
  });

  it("acepta también el formato «jugada nodos» (perftree, qperft)", () => {
    assert.deepEqual([...parseDivide("a2a3 380\r\nb1c3 440\n")], [
      ["a2a3", 380],
      ["b1c3", 440],
    ]);
  });

  it("rechaza una jugada repetida", () => {
    assert.throws(() => parseDivide("a2a3: 1\na2a3: 1\n"), /a2a3/);
  });
});

describe("compareDivide", () => {
  it("devuelve vacío cuando todo coincide", () => {
    const a = new Map([["a2a3", 380], ["e2e4", 600]]);
    assert.deepEqual(compareDivide(a, new Map(a)), []);
  });

  it("señala conteos distintos, jugadas que sobran y jugadas que faltan", () => {
    const ours = new Map([["a2a3", 380], ["e2e4", 599], ["e1g1", 10]]);
    const reference = new Map([["a2a3", 380], ["e2e4", 600], ["d5e6", 7]]);
    assert.deepEqual(compareDivide(ours, reference), [
      { move: "d5e6", ours: null, reference: 7 },
      { move: "e1g1", ours: 10, reference: null },
      { move: "e2e4", ours: 599, reference: 600 },
    ]);
  });
});
