// Tabla de transposición: recuerda lo aprendido de cada posición (por su clave
// Zobrist) para no volver a buscarla y para probar primero su mejor jugada.
// Arrays tipados de tamaño fijo: no crea objetos durante la búsqueda.

export const BOUND_EXACT = 0;
export const BOUND_LOWER = 1; // la puntuación real es al menos esta (corte beta)
export const BOUND_UPPER = 2; // la puntuación real es como mucho esta (no superó alfa)

export class TranspositionTable {
  private readonly mask: number;
  private readonly keyHi: Uint32Array;
  private readonly keyLo: Uint32Array;
  private readonly moves: Int32Array;
  private readonly scores: Int16Array;
  private readonly depths: Int8Array;
  private readonly bounds: Uint8Array;

  /** `bits`: la tabla tiene 2^bits entradas (18 → 262.144 entradas, unos 4 MB). */
  constructor(bits = 18) {
    if (!Number.isInteger(bits) || bits < 4 || bits > 24) throw new RangeError(`Tamaño de tabla no válido: ${bits}`);
    const size = 1 << bits;
    this.mask = size - 1;
    this.keyHi = new Uint32Array(size);
    this.keyLo = new Uint32Array(size);
    this.moves = new Int32Array(size);
    this.scores = new Int16Array(size);
    this.depths = new Int8Array(size).fill(-1);
    this.bounds = new Uint8Array(size);
  }

  /** Índice de la entrada de la clave, o -1 si no está guardada. */
  find(hi: number, lo: number): number {
    const index = lo & this.mask;
    return this.depths[index]! >= 0 && this.keyHi[index] === hi && this.keyLo[index] === lo ? index : -1;
  }

  move(index: number): number {
    return this.moves[index]!;
  }
  score(index: number): number {
    return this.scores[index]!;
  }
  depth(index: number): number {
    return this.depths[index]!;
  }
  bound(index: number): number {
    return this.bounds[index]!;
  }

  /** Guarda (siempre reemplaza). `move` es la jugada codificada, 0 si no hay. */
  store(hi: number, lo: number, depth: number, bound: number, score: number, move: number): void {
    const index = lo & this.mask;
    this.keyHi[index] = hi;
    this.keyLo[index] = lo;
    this.depths[index] = Math.min(depth, 127);
    this.bounds[index] = bound;
    this.scores[index] = score;
    this.moves[index] = move;
  }

  clear(): void {
    this.depths.fill(-1);
  }
}
