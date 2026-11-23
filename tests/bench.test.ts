// Medición de la tabla de transposición: misma búsqueda con tabla y sin ella.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Position } from "../src/core/index.js";
import { TranspositionTable } from "../src/engine/index.js";
import { BENCH_POSITIONS, MoveOnlyTable, NoTable, benchPosition, formatBench } from "../tools/bench-core.js";

describe("NoTable", () => {
  it("no recuerda nada: lo guardado no se encuentra", () => {
    const table = new NoTable();
    table.store(1, 2, 5, 0, 10, 99);
    assert.equal(table.find(1, 2), -1);
  });
});

describe("MoveOnlyTable", () => {
  it("da la jugada guardada pero nunca permite cortar con la puntuación", () => {
    const table = new MoveOnlyTable();
    table.store(1, 2, 5, 0, 10, 99);
    const entry = table.find(1, 2);
    assert.notEqual(entry, -1);
    assert.equal(table.move(entry), 99);
    assert.ok(table.depth(entry) < 1, "ninguna profundidad pedida (≥ 1) puede usar la puntuación");
    assert.ok(table instanceof TranspositionTable);
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
    for (const run of [row.with, row.moveOnly, row.without]) {
      assert.equal(run.depth, 3);
      assert.ok(run.nodes > 0 && run.ms >= 0);
    }
  });

  it("con tabla visita muchos menos nodos en un final con transposiciones", () => {
    const row = benchPosition({ name: "Fine 70", fen: fine70, depth: 9 });
    assert.ok(row.with.nodes * 2 < row.without.nodes, `${row.with.nodes} con tabla, ${row.without.nodes} sin tabla`);
  });
});

describe("formatBench()", () => {
  it("no redondea a -100 % un ahorro que no es total", () => {
    const run = (nodes: number) => ({ nodes, ms: 1, depth: 1, best: null });
    const text = formatBench([{ name: "F", depth: 1, with: run(39), moveOnly: run(1000), without: run(37_453) }]);
    assert.match(text, /39 \(-99,9 %\)/);
    assert.ok(!text.includes("-100 %"));
  });

  it("da una fila por posición y una de total con la reducción de nodos", () => {
    const run = (nodes: number, ms: number, depth: number) => ({ nodes, ms, depth, best: "e2e4" });
    const rows = [
      { name: "A", depth: 4, with: run(500, 10, 4), moveOnly: run(800, 15, 4), without: run(1000, 20, 4) },
      { name: "B", depth: 5, with: run(1500, 30, 5), moveOnly: run(1800, 35, 5), without: run(2000, 40, 5) },
    ];
    const text = formatBench(rows);
    assert.match(text, /^\| A \| 4 \|/m);
    assert.match(text, /^\| B \| 5 \|/m);
    assert.match(text, /^\| Total \|/m);
    assert.match(text, /^\| A \| 4 \| 1\.000 \| 800 \(-20 %\) \| 500 \(-50 %\) \|/m);
    assert.match(text, /^\| Total \| {2}\| 3\.000 \| 2\.600 \(-13 %\) \| 2\.000 \(-33 %\) \|/m);
    // Los nodos/s del total mezclarían posiciones muy distintas: no se dan.
    assert.match(text, /^\| Total \|.*\| — \| — \|$/m);
  });
});
