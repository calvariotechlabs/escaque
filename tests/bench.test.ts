// Medición de la tabla de transposición: misma búsqueda con tabla y sin ella.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Position } from "../src/core/index.js";
import { BENCH_POSITIONS, NoTable, benchPosition, formatBench } from "../tools/bench-core.js";

describe("NoTable", () => {
  it("no recuerda nada: lo guardado no se encuentra", () => {
    const table = new NoTable();
    table.store(1, 2, 5, 0, 10, 99);
    assert.equal(table.find(1, 2), -1);
  });
});

describe("BENCH_POSITIONS", () => {
  it("son FEN válidos con profundidad positiva", () => {
    assert.ok(BENCH_POSITIONS.length >= 3);
    for (const p of BENCH_POSITIONS) {
      assert.doesNotThrow(() => Position.fromFen(p.fen), p.name);
      assert.ok(Number.isInteger(p.depth) && p.depth >= 1, p.name);
    }
  });
});

describe("benchPosition()", () => {
  const fine70 = "8/k7/3p4/p2P1p2/P2P1P2/8/8/K7 w - - 0 1";

  it("busca a la profundidad pedida con tabla y sin ella, y cuenta nodos y tiempo", () => {
    const row = benchPosition({ name: "Kiwipete", fen: "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", depth: 3 });
    assert.equal(row.with.depth, 3);
    assert.equal(row.without.depth, 3);
    assert.ok(row.with.nodes > 0 && row.without.nodes > 0);
    assert.ok(row.with.ms >= 0 && row.without.ms >= 0);
  });

  it("con tabla visita muchos menos nodos en un final con transposiciones", () => {
    const row = benchPosition({ name: "Fine 70", fen: fine70, depth: 9 });
    assert.ok(row.with.nodes * 2 < row.without.nodes, `${row.with.nodes} con tabla, ${row.without.nodes} sin tabla`);
  });
});

describe("formatBench()", () => {
  it("da una fila por posición y una de total con la reducción de nodos", () => {
    const rows = [
      { name: "A", depth: 4, with: { nodes: 500, ms: 10, depth: 4, best: "e2e4" }, without: { nodes: 1000, ms: 20, depth: 4, best: "e2e4" } },
      { name: "B", depth: 5, with: { nodes: 1500, ms: 30, depth: 5, best: "d2d4" }, without: { nodes: 2000, ms: 40, depth: 5, best: "d2d4" } },
    ];
    const text = formatBench(rows);
    assert.match(text, /^\| A \| 4 \|/m);
    assert.match(text, /^\| B \| 5 \|/m);
    assert.match(text, /^\| Total \|/m);
    assert.match(text, /-50 %/); // A: 1000 → 500 nodos
    assert.match(text, /-33 %/); // total: 3000 → 2000 nodos
    // Los nodos/s del total mezclarían posiciones muy distintas: no se dan.
    assert.match(text, /^\| Total \|.*\| — \| — \|$/m);
  });
});
