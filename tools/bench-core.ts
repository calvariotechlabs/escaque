// Mide cuánto aporta la tabla de transposición: busca las mismas posiciones a
// la misma profundidad con la tabla de Alfil Beta y con una tabla que no
// recuerda nada, y compara nodos, tiempo y nodos por segundo.
import { Position } from "../src/core/index.js";
import { TranspositionTable, search } from "../src/engine/index.js";

/** Tabla que no guarda nada: la búsqueda funciona como si no hubiera tabla de transposición. */
export class NoTable extends TranspositionTable {
  constructor() {
    super(4); // el mínimo: no se usa
  }
  override find(_hi: number, _lo: number): number {
    return -1;
  }
  override store(_hi: number, _lo: number, _depth: number, _bound: number, _score: number, _move: number): void {}
}

export interface BenchPosition {
  readonly name: string;
  readonly fen: string;
  readonly depth: number;
}

export interface BenchRun {
  readonly nodes: number;
  readonly ms: number;
  readonly depth: number;
  readonly best: string | null;
}

export interface BenchRow {
  readonly name: string;
  readonly depth: number;
  readonly with: BenchRun;
  readonly without: BenchRun;
}

/**
 * Posiciones de la medición. Profundidades elegidas para que la búsqueda sin
 * tabla tarde unos segundos en un contenedor de 4 núcleos.
 */
export const BENCH_POSITIONS: readonly BenchPosition[] = [
  { name: "Inicial", fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", depth: 6 },
  { name: "Kiwipete", fen: "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", depth: 5 },
  { name: "Medio juego (italiana)", fen: "r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 7", depth: 5 },
  { name: "Final de torres", fen: "8/5pk1/6p1/R7/5P2/6P1/r5K1/8 w - - 0 1", depth: 8 },
  { name: "Final de peones (Fine 70)", fen: "8/k7/3p4/p2P1p2/P2P1P2/8/8/K7 w - - 0 1", depth: 16 },
];

function run(fen: string, depth: number, table: TranspositionTable): BenchRun {
  const position = Position.fromFen(fen);
  const started = performance.now();
  const result = search(position, { maxDepth: depth }, { table });
  const ms = performance.now() - started;
  return { nodes: result.nodes, ms, depth: result.depth, best: result.best };
}

/** Busca una posición a profundidad fija, primero sin tabla y luego con una tabla nueva. */
export function benchPosition(p: BenchPosition): BenchRow {
  const without = run(p.fen, p.depth, new NoTable());
  const withTable = run(p.fen, p.depth, new TranspositionTable());
  return { name: p.name, depth: p.depth, with: withTable, without };
}

/** Entero con puntos de millar, como se escribe en español (1.234.567). */
const thousands = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const perSecond = (r: { nodes: number; ms: number }): string => (r.ms > 0 ? thousands((r.nodes * 1000) / r.ms) : "—");
const change = (after: number, before: number): string => {
  if (before === 0) return "—";
  const pct = Math.round((after / before - 1) * 100);
  return `${pct > 0 ? "+" : ""}${pct} %`;
};

/** Tabla en Markdown, lista para el README. */
export function formatBench(rows: readonly BenchRow[]): string {
  const lines = [
    "| Posición | Prof. | Nodos sin tabla | Nodos con tabla | Nodos | Tiempo sin tabla | Tiempo con tabla | Nodos/s sin tabla | Nodos/s con tabla |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  type Totals = { nodes: number; ms: number };
  const line = (name: string, depth: string, w: Totals, wo: Totals, rates: boolean): string =>
    `| ${name} | ${depth} | ${thousands(wo.nodes)} | ${thousands(w.nodes)} | ${change(w.nodes, wo.nodes)} | ${thousands(wo.ms)} ms | ${thousands(w.ms)} ms | ${rates ? perSecond(wo) : "—"} | ${rates ? perSecond(w) : "—"} |`;
  const total = { w: { nodes: 0, ms: 0 }, wo: { nodes: 0, ms: 0 } };
  for (const row of rows) {
    lines.push(line(row.name, String(row.depth), row.with, row.without, true));
    total.w.nodes += row.with.nodes;
    total.w.ms += row.with.ms;
    total.wo.nodes += row.without.nodes;
    total.wo.ms += row.without.ms;
  }
  // Los nodos/s del total mezclarían posiciones de coste por nodo muy distinto.
  lines.push(line("Total", "", total.w, total.wo, false));
  return lines.join("\n");
}
