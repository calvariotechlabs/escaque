import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { Position } from "../src/core/index.js";
import { parsePlacement, squareName } from "../src/ui/board.js";
import { POSITIONS } from "../src/ui/demo-positions.js";

describe("posiciones de la demo", () => {
  test("todas son FEN que acepta el núcleo y que pinta el tablero", () => {
    assert.ok(POSITIONS.length >= 4);
    for (const item of POSITIONS) {
      const position = Position.fromFen(item.fen);
      assert.equal(parsePlacement(item.fen).filter((p) => p !== null).length > 0, true, item.name);
      assert.ok(position.toFen().startsWith(item.fen.split(" ")[0]!), item.name);
    }
  });

  test("las marcas de ejemplo apuntan a casillas que existen", () => {
    const names = new Set<string>();
    for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) names.add(squareName(f, r));
    for (const item of POSITIONS) for (const [square] of item.marks) assert.ok(names.has(square), `${item.name}: ${square}`);
  });

  test("el mate del pastor es jaque mate de las blancas", () => {
    const item = POSITIONS.find((p) => p.name === "Mate del pastor")!;
    assert.deepEqual(Position.fromFen(item.fen).status(), { kind: "checkmate", winner: "w" });
  });
});
