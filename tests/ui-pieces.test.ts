import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Color, PieceType } from "../src/core/index.js";
import { GRADIENT_ID, PIECE_TYPES, pieceDefsSvg, pieceMarkup, pieceName } from "../src/ui/pieces.js";

const COLORS: Color[] = ["w", "b"];

describe("piezas SVG", () => {
  test("hay seis tipos y doce piezas distintas", () => {
    assert.equal(PIECE_TYPES.length, 6);
    const all = COLORS.flatMap((c) => PIECE_TYPES.map((t) => pieceMarkup(c, t)));
    assert.equal(new Set(all).size, 12);
  });

  test("cada pieza es un SVG decorativo con el degradado de su bando", () => {
    for (const color of COLORS) {
      for (const type of PIECE_TYPES) {
        const svg = pieceMarkup(color, type);
        assert.match(svg, /^<svg class="pieza pieza--[wb]" viewBox="0 0 45 45" aria-hidden="true" focusable="false">/);
        assert.ok(svg.includes(`fill="url(#${GRADIENT_ID[color]})"`), `${color}${type}`);
        assert.ok(svg.endsWith("</svg>"));
      }
    }
  });

  test("sin atributos style ni scripts, compatible con una CSP estricta", () => {
    const markup = [...COLORS.flatMap((c) => PIECE_TYPES.map((t) => pieceMarkup(c, t))), pieceDefsSvg()].join("");
    assert.ok(!/\sstyle\s*=/i.test(markup));
    assert.ok(!/<script|on\w+\s*=|javascript:/i.test(markup));
  });

  test("los degradados existen para los dos bandos y no llevan colores fijos", () => {
    const defs = pieceDefsSvg();
    for (const color of COLORS) assert.ok(defs.includes(`id="${GRADIENT_ID[color]}"`));
    assert.ok(!/stop-color|#[0-9a-f]{3,8}/i.test(defs), "los colores salen de los tokens");
  });

  test("los nombres en español llevan el género correcto", () => {
    const names = (c: Color) => PIECE_TYPES.map((t: PieceType) => pieceName(c, t));
    assert.deepEqual(names("w"), ["rey blanco", "dama blanca", "torre blanca", "alfil blanco", "caballo blanco", "peón blanco"]);
    assert.deepEqual(names("b"), ["rey negro", "dama negra", "torre negra", "alfil negro", "caballo negro", "peón negro"]);
  });
});
