import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { FenError, Position, START_FEN } from "../src/core/index.js";
import { boardModel, parsePlacement, squareName } from "../src/ui/board.js";

describe("parsePlacement", () => {
  test("lee la posición inicial: 32 piezas en su sitio", () => {
    const pieces = parsePlacement(START_FEN);
    assert.equal(pieces.filter((p) => p !== null).length, 32);
    assert.deepEqual(pieces[0], { color: "w", type: "r" }); // a1
    assert.deepEqual(pieces[4], { color: "w", type: "k" }); // e1
    assert.deepEqual(pieces[63], { color: "b", type: "r" }); // h8
    assert.equal(pieces[8 * 3 + 3], null); // d4
  });

  test("acepta la colocación sola, sin los demás campos", () => {
    const placement = START_FEN.split(" ")[0]!;
    assert.deepEqual(parsePlacement(placement), parsePlacement(START_FEN));
  });

  test("coincide con lo que escribe Position.toFen()", () => {
    const fen = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";
    const fromCore = Position.fromFen(fen).toFen();
    assert.deepEqual(parsePlacement(fromCore), parsePlacement(fen));
  });

  test("rechaza colocaciones mal formadas con FenError", () => {
    const bad = [
      "8/8/8/8/8/8/8", // 7 filas
      "8/8/8/8/8/8/8/8/8", // 9 filas
      "9/8/8/8/8/8/8/8", // un 9 no es dígito válido
      "ppppppppp/8/8/8/8/8/8/8", // 9 casillas
      "ppppppp/8/8/8/8/8/8/8", // 7 casillas
      "xnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR", // letra que no es pieza
      "rnbqkbnK/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR", // signo Kelvin, no la letra K
      "",
    ];
    for (const text of bad) assert.throws(() => parsePlacement(text), FenError, text);
  });
});

describe("boardModel", () => {
  test("tiene 64 casillas, de arriba a abajo desde las blancas", () => {
    const squares = boardModel(START_FEN);
    assert.equal(squares.length, 64);
    assert.equal(squares[0]!.name, "a8");
    assert.equal(squares[7]!.name, "h8");
    assert.equal(squares[63]!.name, "h1");
  });

  test("girado, empieza en h1 y acaba en a8", () => {
    const squares = boardModel(START_FEN, "b");
    assert.equal(squares[0]!.name, "h1");
    assert.equal(squares[63]!.name, "a8");
  });

  test("a1 es oscura y h1 es clara; hay 32 de cada tono", () => {
    const squares = boardModel(START_FEN);
    const find = (name: string) => squares.find((s) => s.name === name)!;
    assert.equal(find("a1").light, false);
    assert.equal(find("h1").light, true);
    assert.equal(find("a8").light, true);
    assert.equal(squares.filter((s) => s.light).length, 32);
  });

  test("la etiqueta accesible lleva casilla y pieza con su género", () => {
    const squares = boardModel(START_FEN);
    const label = (name: string) => squares.find((s) => s.name === name)!.label;
    assert.equal(label("a8"), "a8, torre negra");
    assert.equal(label("d1"), "d1, dama blanca");
    assert.equal(label("e1"), "e1, rey blanco");
    assert.equal(label("b8"), "b8, caballo negro");
    assert.equal(label("c1"), "c1, alfil blanco");
    assert.equal(label("e7"), "e7, peón negro");
    assert.equal(label("e4"), "e4, vacía");
  });

  test("los nombres de casilla son únicos y cubren de a1 a h8", () => {
    const names = new Set(boardModel(START_FEN).map((s) => s.name));
    assert.equal(names.size, 64);
    assert.ok(names.has(squareName(0, 0)) && names.has(squareName(7, 7)));
  });
});
