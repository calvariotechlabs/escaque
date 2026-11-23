// Piezas capturadas y ventaja de material (lógica sin DOM del panel «Capturas»).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { captureSummary, capturedGroups, capturesDescription, capturesMarkup } from "../src/ui/captures.js";
import type { PlayedMove } from "../src/ui/notation.js";

function move(color: "w" | "b", captured: PlayedMove["captured"], promotion: PlayedMove["promotion"] = null): PlayedMove {
  return { color, san: "x", from: "a1", to: "a2", piece: "p", captured, promotion };
}

describe("captureSummary", () => {
  it("sin jugadas no hay capturas ni ventaja", () => {
    const summary = captureSummary([]);
    assert.deepEqual(summary.w, { q: 0, r: 0, b: 0, n: 0, p: 0 });
    assert.deepEqual(summary.b, { q: 0, r: 0, b: 0, n: 0, p: 0 });
    assert.deepEqual(summary.lead, { color: null, points: 0 });
  });

  it("apunta cada captura en el bando que captura", () => {
    const summary = captureSummary([move("w", "p"), move("b", "b"), move("w", "n"), move("w", "p")]);
    assert.deepEqual(summary.w, { q: 0, r: 0, b: 0, n: 1, p: 2 });
    assert.deepEqual(summary.b, { q: 0, r: 0, b: 1, n: 0, p: 0 });
  });

  it("la ventaja es la diferencia de valor: peón 1, caballo y alfil 3, torre 5, dama 9", () => {
    const summary = captureSummary([move("w", "q"), move("b", "r"), move("b", "n")]);
    assert.deepEqual(summary.lead, { color: "w", points: 1 });
    assert.deepEqual(captureSummary([move("b", "q")]).lead, { color: "b", points: 9 });
  });

  it("con el mismo material no hay ventaja", () => {
    const summary = captureSummary([move("w", "n"), move("b", "b")]);
    assert.deepEqual(summary.lead, { color: null, points: 0 });
  });

  it("coronar suma el valor de la pieza menos el peón, sin haber capturado nada", () => {
    const summary = captureSummary([move("w", null, "q")]);
    assert.deepEqual(summary.w, { q: 0, r: 0, b: 0, n: 0, p: 0 });
    assert.deepEqual(summary.lead, { color: "w", points: 8 });
    assert.deepEqual(captureSummary([move("b", null, "n")]).lead, { color: "b", points: 2 });
  });

  it("coronar capturando suma las dos cosas", () => {
    assert.deepEqual(captureSummary([move("w", "r", "q")]).lead, { color: "w", points: 13 });
  });
});

describe("capturedGroups", () => {
  it("ordena de más a menos valor y omite los tipos sin capturas", () => {
    assert.deepEqual(capturedGroups({ q: 0, r: 1, b: 0, n: 2, p: 3 }), [
      { type: "r", count: 1 },
      { type: "n", count: 2 },
      { type: "p", count: 3 },
    ]);
    assert.deepEqual(capturedGroups({ q: 0, r: 0, b: 0, n: 0, p: 0 }), []);
  });
});

describe("capturesDescription", () => {
  it("dice qué ha capturado cada bando y su ventaja", () => {
    const summary = captureSummary([move("w", "n"), move("w", "p"), move("w", "p"), move("b", "b")]);
    assert.equal(capturesDescription("w", summary), "Blancas han capturado un caballo y 2 peones. Ventaja de 2.");
    assert.equal(capturesDescription("b", summary), "Negras han capturado un alfil.");
  });

  it("sin capturas dice que no han capturado nada", () => {
    assert.equal(capturesDescription("b", captureSummary([])), "Negras no han capturado nada.");
  });

  it("usa el género y el plural correctos", () => {
    const summary = captureSummary([move("w", "q"), move("w", "r"), move("w", "r"), move("w", "b"), move("w", "b")]);
    assert.equal(capturesDescription("w", summary), "Blancas han capturado una dama, 2 torres y 2 alfiles. Ventaja de 25.");
  });
});

describe("capturesMarkup", () => {
  const sample = captureSummary([move("w", "n"), move("w", "p"), move("w", "p"), move("b", "b")]);

  it("pone primero la fila del bando que está abajo en el tablero", () => {
    const abajoBlancas = capturesMarkup(sample, "w");
    assert.ok(abajoBlancas.indexOf("Blancas</span>") < abajoBlancas.indexOf("Negras</span>"));
    const abajoNegras = capturesMarkup(sample, "b");
    assert.ok(abajoNegras.indexOf("Negras</span>") < abajoNegras.indexOf("Blancas</span>"));
  });

  it("dibuja las piezas capturadas del color rival, decorativas, y el texto oculto de cada fila", () => {
    const html = capturesMarkup(sample, "w");
    assert.equal((html.match(/pieza--b/g) ?? []).length, 3); // caballo y 2 peones negros
    assert.equal((html.match(/pieza--w/g) ?? []).length, 1); // el alfil blanco
    assert.ok(html.includes('<span class="capturas__piezas" aria-hidden="true">'));
    assert.ok(html.includes('<span class="oculto">Blancas han capturado un caballo y 2 peones. Ventaja de 2.</span>'));
    assert.ok(html.includes('<span class="oculto">Negras han capturado un alfil.</span>'));
  });

  it("la ventaja «+N» solo aparece en el bando que va por delante", () => {
    const html = capturesMarkup(sample, "w");
    assert.equal((html.match(/capturas__ventaja/g) ?? []).length, 1);
    assert.ok(html.includes('<span class="capturas__ventaja" aria-hidden="true">+2</span>'));
  });

  it("sin capturas pone «Ninguna» y no añade nota", () => {
    const html = capturesMarkup(captureSummary([]), "w");
    assert.equal((html.match(/Ninguna/g) ?? []).length, 2);
    assert.ok(!html.includes("capturas__ventaja"));
    assert.ok(!html.includes("capturas__nota"));
  });

  it("con capturas e igualdad lo dice en una nota", () => {
    const html = capturesMarkup(captureSummary([move("w", "n"), move("b", "b")]), "w");
    assert.ok(html.includes('<p class="capturas__nota">Material igualado.</p>'));
    assert.ok(!html.includes("capturas__ventaja"));
  });

  it("no lleva atributos style ni scripts (CSP estricta)", () => {
    const html = capturesMarkup(sample, "w");
    assert.ok(!/\sstyle\s*=/i.test(html));
    assert.ok(!/<script|on\w+\s*=|javascript:/i.test(html));
  });
});

describe("capturesMarkup y lectores de pantalla", () => {
  it("el nombre visible del bando no se lee dos veces: lo dice el texto oculto de la fila", () => {
    const html = capturesMarkup(captureSummary([]), "w");
    assert.equal((html.match(/class="capturas__quien" aria-hidden="true"/g) ?? []).length, 2);
  });
});
