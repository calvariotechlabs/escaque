// Contraste del tablero (CAL-397): los dos tableros cumplen WCAG 1.4.11 (3:1 en gráficos) en sus casillas, marcas y flechas.
// Lee los colores de src/ui/tokens.css, que es la fuente, así que un cambio de color que baje del mínimo falla aquí.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tokens = readFileSync(new URL("../src/ui/tokens.css", import.meta.url), "utf8");
const board = readFileSync(new URL("../src/ui/board.css", import.meta.url), "utf8");

function block(selector) {
  const start = tokens.indexOf(selector + " {");
  assert.notEqual(start, -1, `falta ${selector} en tokens.css`);
  return tokens.slice(start, tokens.indexOf("}", start));
}
function vars(text) {
  return Object.fromEntries([...text.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]));
}
const base = vars(block(":root"));
const THEMES = { bosque: base, nogal: { ...base, ...vars(block(':root[data-tablero="nogal"]')) } };

const rgb = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const lum = (c) => {
  const [r, g, b] = rgb(c).map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const mix = (a, b, p) => "#" + rgb(a).map((v, i) => Math.round(v * p + rgb(b)[i] * (1 - p)).toString(16).padStart(2, "0")).join("");

for (const [name, t] of Object.entries(THEMES)) {
  describe(`tablero ${name}`, () => {
    const squares = { clara: t["square-light"], oscura: t["square-dark"] };
    it("las dos casillas se distinguen (3:1)", () => assert.ok(ratio(squares.clara, squares.oscura) >= 3));
    for (const [kind, sq] of Object.entries(squares)) {
      it(`contorno de las piezas y anillos sobre casilla ${kind}`, () => {
        assert.ok(ratio(t["piece-outline-white"], sq) >= 3, "contorno de pieza blanca");
        assert.ok(ratio(t["piece-outline-black"], sq) >= 3, "contorno de pieza negra");
        assert.ok(ratio(t["board-ink"], sq) >= 3, "anillo de foco, jaque y captura");
      });
      it(`la última jugada se ve sobre casilla ${kind}`, () => {
        const fill = mix(t["mark-last-move"], sq, 0.92);
        assert.ok(ratio(mix(t["board-ink"], fill, 0.62), fill) >= 3, "borde sobre relleno");
      });
      it(`la selección se ve sobre casilla ${kind}`, () => {
        assert.ok(ratio(t["board-ink"], mix(t["mark-selected"], sq, 0.6)) >= 3, "anillo sobre relleno");
      });
    }
    it("el halo claro se ve sobre la tinta y sobre la casilla oscura", () => {
      assert.ok(ratio(t["board-halo"], t["board-ink"]) >= 3);
      assert.ok(ratio(t["board-halo"], squares.oscura) >= 3);
    });
    it("las flechas se ven sobre su borde claro, y el borde sobre la casilla oscura", () => {
      assert.ok(ratio(t["arrow-best"], "#ffffff") >= 3);
      assert.ok(ratio(t["arrow-yours"], "#ffffff") >= 3);
      assert.ok(ratio("#ffffff", squares.oscura) >= 3);
      assert.ok(ratio(t["arrow-best"], squares.clara) >= 3);
    });
  });
}

describe("reglas del tablero", () => {
  it("el punto de destino y la captura no son translúcidos y llevan halo", () => {
    for (const re of [/\[data-marks~="target"\]:not\(\[data-marks~="capture"\]\)::after\{[^}]*\}/, /\[data-marks~="capture"\]::after\{[^}]*\}/]) {
      const rule = board.match(re)?.[0] ?? "";
      assert.ok(rule.includes("--board-halo"), "sin halo");
      assert.ok(!/opacity/.test(rule), "no debe ser translúcido");
    }
  });
  it("las flechas usan colores fijos y no los de la interfaz", () => {
    const arrows = board.slice(board.indexOf(".tablero__flechas"), board.indexOf(".vista-revision"));
    assert.ok(/--arrow-best/.test(arrows) && /--arrow-yours/.test(arrows));
    assert.ok(!/var\(--(accent|ink)\)/.test(arrows), "las flechas no deben depender del tema de la interfaz");
  });
  it("jaque y foco llevan anillo doble", () => {
    assert.match(board, /\[data-marks~="check"\]\{[^}]*--board-halo/);
    assert.match(board, /\.casilla:focus-visible\{[^}]*--board-halo/);
  });
});
