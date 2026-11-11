// Perft: cuenta las posiciones hoja alcanzables a una profundidad dada.
// Es la prueba de referencia de un generador de jugadas: si el conteo no
// coincide con los valores publicados, hay un fallo en las reglas.
//
// El módulo es genérico (no conoce el tablero) para poder probarlo por sí
// mismo y para que la herramienta de línea de órdenes lo reutilice.

/** Lo mínimo que perft necesita de una posición: listar, hacer y deshacer jugadas. */
export interface PerftTarget<M> {
  legalMoves(): M[];
  makeMove(move: M): void;
  unmakeMove(): void;
}

export interface DivideEntry {
  readonly move: string;
  readonly nodes: number;
}

export interface DivideResult {
  /** Una entrada por jugada inicial, ordenadas por nombre de jugada. */
  readonly moves: readonly DivideEntry[];
  readonly total: number;
}

/** Diferencia entre nuestro desglose y el de referencia. `null` = la jugada no aparece. */
export interface DivideMismatch {
  readonly move: string;
  readonly ours: number | null;
  readonly reference: number | null;
}

function checkDepth(depth: number, min: number): void {
  if (!Number.isInteger(depth) || depth < min) {
    throw new RangeError(`Profundidad de perft no válida: ${depth} (mínimo ${min})`);
  }
}

function count<M>(position: PerftTarget<M>, depth: number): number {
  if (depth === 0) return 1;
  const moves = position.legalMoves();
  // Las jugadas son legales: a profundidad 1 basta con contarlas.
  if (depth === 1) return moves.length;
  let nodes = 0;
  for (const move of moves) {
    position.makeMove(move);
    nodes += count(position, depth - 1);
    position.unmakeMove();
  }
  return nodes;
}

export function perft<M>(position: PerftTarget<M>, depth: number): number {
  checkDepth(depth, 0);
  return count(position, depth);
}

/** Perft dividido: hojas por cada jugada inicial. Sirve para localizar la rama con el fallo. */
export function perftDivide<M>(
  position: PerftTarget<M>,
  depth: number,
  moveName: (move: M) => string,
): DivideResult {
  checkDepth(depth, 1);
  const moves: DivideEntry[] = [];
  let total = 0;
  for (const move of position.legalMoves()) {
    const name = moveName(move);
    position.makeMove(move);
    const nodes = count(position, depth - 1);
    position.unmakeMove();
    moves.push({ move: name, nodes });
    total += nodes;
  }
  moves.sort((a, b) => (a.move < b.move ? -1 : a.move > b.move ? 1 : 0));
  return { moves, total };
}

/** Mismo formato que `go perft N` de Stockfish, para comparar línea a línea. */
export function formatDivide(result: DivideResult): string {
  const lines = result.moves.map((m) => `${m.move}: ${m.nodes}`);
  return `${lines.join("\n")}\n\nNodes searched: ${result.total}\n`;
}

const DIVIDE_LINE = /^([a-h][1-8][a-h][1-8][qrbn]?)\s*:?\s+(\d+)\s*$/;

/**
 * Lee un desglose de otra herramienta. Acepta «e2e4: 20» (Stockfish) y
 * «e2e4 20» (perftree, qperft); ignora el resto de líneas.
 */
export function parseDivide(text: string): Map<string, number> {
  const result = new Map<string, number>();
  for (const raw of text.split(/\r?\n/)) {
    const match = DIVIDE_LINE.exec(raw.trim());
    if (!match) continue;
    const move = match[1]!;
    if (result.has(move)) throw new Error(`Jugada repetida en el desglose: ${move}`);
    result.set(move, Number(match[2]));
  }
  return result;
}

/** Jugadas cuyo conteo no coincide, ordenadas por nombre. Vacío si todo cuadra. */
export function compareDivide(
  ours: ReadonlyMap<string, number>,
  reference: ReadonlyMap<string, number>,
): DivideMismatch[] {
  const names = [...new Set([...ours.keys(), ...reference.keys()])].sort();
  const mismatches: DivideMismatch[] = [];
  for (const move of names) {
    const a = ours.get(move) ?? null;
    const b = reference.get(move) ?? null;
    if (a !== b) mismatches.push({ move, ours: a, reference: b });
  }
  return mismatches;
}
