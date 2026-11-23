// Mide la tabla de transposición de Alfil Beta: misma búsqueda, con tabla y sin ella.
//
//   npm run bench
//
// Imprime una tabla en Markdown con nodos, tiempo y nodos por segundo (unos 3 min).
import { BENCH_POSITIONS, benchPosition, formatBench, warmUp } from "./bench-core.js";
import type { BenchRow } from "./bench-core.js";
import { nodeProcess } from "./node.js";

const proc = nodeProcess();
proc.stderr.write("Calentando…\n");
warmUp();
const rows: BenchRow[] = [];
for (const p of BENCH_POSITIONS) {
  proc.stderr.write(`${p.name} (profundidad ${p.depth})…\n`);
  const row = benchPosition(p);
  if (row.with.best !== row.without.best) {
    proc.stderr.write(`  Aviso: mejor jugada distinta con tabla (${row.with.best}) y sin ella (${row.without.best})\n`);
  }
  rows.push(row);
}
proc.stdout.write(`${formatBench(rows)}\n`);
