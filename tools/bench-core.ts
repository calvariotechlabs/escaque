// Mide cuánto aporta la tabla de transposición: busca las mismas posiciones a
// la misma profundidad de tres maneras y compara nodos, tiempo y nodos por
// segundo:
// - sin tabla: una tabla que no recuerda nada;
// - solo la jugada: la tabla da la mejor jugada guardada para probarla
//   primero, pero nunca corta con la puntuación (separa lo que aporta ordenar
//   mejor de lo que aporta no repetir trabajo);
// - con tabla: la de Alfil Beta tal cual.
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

/** Tabla que solo sirve para ordenar: su profundidad nunca basta para usar la puntuación. */
export class MoveOnlyTable extends TranspositionTable {
  override depth(_index: number): number {
    return -1;
  }
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
  readonly moveOnly: BenchRun;
  readonly without: BenchRun;
}

/**
 * Posiciones de la medición. Profundidades elegidas para que la búsqueda sin
 * tabla tarde entre unos segundos y un minuto en un contenedor de 4 núcleos.
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

/**
 * Calienta el motor con las tres tablas antes de medir: así el compilador JIT
 * ya ha optimizado la búsqueda, y con las tres clases a la vez, cuando empieza
 * la primera medición, y ninguna variante paga el calentamiento por ir primero.
 */
export function warmUp(): void {
  for (let i = 0; i < 3; i++) {
    for (const make of [() => new NoTable(), () => new MoveOnlyTable(), () => new TranspositionTable()]) {
      run(BENCH_POSITIONS[0]!.fen, 4, make());
    }
  }
}

/** Busca una posición a profundidad fija con las tres tablas, cada una nueva. */
export function benchPosition(p: BenchPosition): BenchRow {
  const without = run(p.fen, p.depth, new NoTable());
  const moveOnly = run(p.fen, p.depth, new MoveOnlyTable());
  const withTable = run(p.fen, p.depth, new TranspositionTable());
  return { name: p.name, depth: p.depth, with: withTable, moveOnly, without };
}

/** Entero con puntos de millar, como se escribe en español (1.234.567). */
const thousands = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const perSecond = (r: Totals): string => (r.ms > 0 ? thousands((r.nodes * 1000) / r.ms) : "—");
/** Cambio en %, entero; con un decimal cerca de ±100 % para no dar «-100 %» si no es total. */
const change = (after: number, before: number): string => {
  if (before === 0) return "—";
  const pct = (after / before - 1) * 100;
  const nearTotal = Math.abs(pct) >= 99.5 && Math.abs(pct) < 100;
  const text = nearTotal ? Math.min(Math.abs(Math.round(pct * 10) / 10), 99.9).toFixed(1).replace(".", ",") : String(Math.abs(Math.round(pct)));
  return `${pct > 0 ? "+" : pct < 0 && text !== "0" ? "-" : ""}${text} %`;
};

type Totals = { nodes: number; ms: number };

/** Tabla en Markdown, lista para el README. */
export function formatBench(rows: readonly BenchRow[]): string {
  const lines = [
    "| Posición | Prof. | Nodos sin tabla | Solo la jugada de la tabla | Con tabla | Tiempo sin tabla | Tiempo con tabla | Nodos/s sin tabla | Nodos/s con tabla |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  const line = (name: string, depth: string, w: Totals, m: Totals, wo: Totals, rates: boolean): string =>
    `| ${name} | ${depth} | ${thousands(wo.nodes)} | ${thousands(m.nodes)} (${change(m.nodes, wo.nodes)}) | ${thousands(w.nodes)} (${change(w.nodes, wo.nodes)}) | ` +
    `${thousands(wo.ms)} ms | ${thousands(w.ms)} ms | ${rates ? perSecond(wo) : "—"} | ${rates ? perSecond(w) : "—"} |`;
  const total = { w: { nodes: 0, ms: 0 }, m: { nodes: 0, ms: 0 }, wo: { nodes: 0, ms: 0 } };
  const add = (into: Totals, r: BenchRun): void => {
    into.nodes += r.nodes;
    into.ms += r.ms;
  };
  for (const row of rows) {
    lines.push(line(row.name, String(row.depth), row.with, row.moveOnly, row.without, true));
    add(total.w, row.with);
    add(total.m, row.moveOnly);
    add(total.wo, row.without);
  }
  // Los nodos/s del total mezclarían posiciones de coste por nodo muy distinto.
  lines.push(line("Total", "", total.w, total.m, total.wo, false));
  return lines.join("\n");
}
