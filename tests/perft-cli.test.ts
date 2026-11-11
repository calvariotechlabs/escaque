// Herramienta de perft dividido (npm run perft): argumentos y comparación con la referencia.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { START_FEN } from "../src/core/index.js";
import { compareReport, parsePerftArgs } from "../tools/perft-cli.js";

describe("parsePerftArgs", () => {
  it("solo con profundidad usa la posición inicial", () => {
    assert.deepEqual(parsePerftArgs(["3"]), { depth: 3, fen: START_FEN, moves: [], reference: null });
  });

  it("lee la FEN entre comillas (un único argumento)", () => {
    const fen = "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1";
    assert.deepEqual(parsePerftArgs(["5", fen]).fen, fen);
  });

  it("lee las jugadas UCI que bajan por una rama, sueltas o en un solo argumento", () => {
    assert.deepEqual(parsePerftArgs(["2", START_FEN, "e2e4", "e7e5"]).moves, ["e2e4", "e7e5"]);
    assert.deepEqual(parsePerftArgs(["2", START_FEN, "e2e4 e7e5"]).moves, ["e2e4", "e7e5"]);
  });

  it("lee --ref con el fichero de referencia en cualquier posición", () => {
    assert.equal(parsePerftArgs(["--ref", "sf.txt", "2"]).reference, "sf.txt");
    assert.equal(parsePerftArgs(["2", START_FEN, "--ref", "sf.txt"]).reference, "sf.txt");
  });

  it("rechaza profundidades ausentes o no válidas", () => {
    assert.throws(() => parsePerftArgs([]), /profundidad/i);
    assert.throws(() => parsePerftArgs(["0"]), /profundidad/i);
    assert.throws(() => parsePerftArgs(["tres"]), /profundidad/i);
  });

  it("si el segundo argumento es una jugada UCI, la FEN es la inicial", () => {
    assert.deepEqual(parsePerftArgs(["3", "e2e4", "e7e5"]), { depth: 3, fen: START_FEN, moves: ["e2e4", "e7e5"], reference: null });
  });

  it("rechaza jugadas que no son UCI", () => {
    assert.throws(() => parsePerftArgs(["2", START_FEN, "e4"]), /e4/);
  });

  it("rechaza --ref sin fichero", () => {
    assert.throws(() => parsePerftArgs(["2", "--ref"]), /--ref/);
  });
});

describe("compareReport", () => {
  const result = { moves: [{ move: "a2a3", nodes: 380 }, { move: "e2e4", nodes: 599 }], total: 979 };

  it("sin referencia no añade nada y sale con 0", () => {
    assert.deepEqual(compareReport(result, null), { text: "", exitCode: 0 });
  });

  it("si todo coincide lo dice y sale con 0", () => {
    const r = compareReport(result, "a2a3: 380\ne2e4: 599\n\nNodes searched: 979\n");
    assert.equal(r.exitCode, 0);
    assert.match(r.text, /Coincide con la referencia \(2 jugadas\)/);
  });

  it("lista solo las jugadas que no cuadran y sale con 1", () => {
    const r = compareReport(result, "a2a3: 380\ne2e4: 600\nd2d4: 8\n");
    assert.equal(r.exitCode, 1);
    assert.equal(
      r.text,
      "\nNo coincide con la referencia en 2 jugada(s):\n" +
        "  d2d4: nuestro no la generamos, referencia 8\n" +
        "  e2e4: nuestro 599, referencia 600\n",
    );
  });

  it("detecta una jugada que generamos dos veces aunque cada conteo coincida", () => {
    const dup = { moves: [{ move: "a2a3", nodes: 380 }, { move: "a2a3", nodes: 380 }], total: 760 };
    const r = compareReport(dup, "a2a3: 380\n");
    assert.equal(r.exitCode, 1);
    assert.match(r.text, /dos veces.*a2a3/);
  });

  it("avisa si el fichero de referencia no tiene ninguna jugada", () => {
    const r = compareReport(result, "hola\n");
    assert.equal(r.exitCode, 2);
    assert.match(r.text, /ninguna línea/);
  });
});
