// Búsqueda de Alfil Beta.
//
// - Negamax con poda alfa-beta: cada bando maximiza su puntuación, que es la
//   del rival cambiada de signo.
// - Profundización iterativa: se busca a profundidad 1, 2, 3… hasta agotar la
//   profundidad máxima o el tiempo. Si el tiempo se acaba a media iteración,
//   vale la última iteración completa. La profundidad 1 siempre se termina.
// - Búsqueda de quietud: en las hojas se siguen las capturas y coronaciones a
//   dama, para no valorar una posición en mitad de un cambio de piezas.
// - Extensión de jaque: estando en jaque se busca una media jugada más.
// - Orden de jugadas: la mejor según la tabla de transposición, luego capturas
//   por MVV-LVA (víctima más valiosa, atacante menos valioso), luego coronaciones.
// - Mates puntuados por distancia: mate en n medias jugadas = MATE_SCORE − n.
// - Tablas dentro de la búsqueda (repetición, 50 jugadas, material
//   insuficiente) valen 0. Una posición que ya apareció cuenta como repetida.
import { moveToUci } from "../core/index.js";
import type { Move, Position, PromotionPiece } from "../core/index.js";
import { evaluate, PIECE_VALUES } from "./evaluate.js";
import { BOUND_EXACT, BOUND_LOWER, BOUND_UPPER, TranspositionTable } from "./transposition.js";

/** Puntuación de dar mate ya. Un mate en n medias jugadas vale MATE_SCORE − n. */
export const MATE_SCORE = 30_000;
/** Cualquier puntuación por encima (en valor absoluto) es un mate. */
const MATE_BOUND = MATE_SCORE - 1_000;
const INFINITY = 32_000;
/** Profundidad máxima de una búsqueda (y de la variante principal). */
export const MAX_DEPTH = 64;
/** Tope de medias jugadas desde la raíz, contando la quietud y las extensiones. */
const MAX_PLY = 128;
/** Cada cuántos nodos se mira el reloj. */
const CLOCK_INTERVAL = 1024;

export interface SearchLimits {
  /** Profundidad máxima, de 1 a MAX_DEPTH. Por defecto, MAX_DEPTH. */
  readonly maxDepth?: number;
  /** Tiempo máximo en milisegundos. Por defecto, sin límite (entonces hace falta `maxDepth`). */
  readonly timeMs?: number;
}

export interface SearchOptions {
  /** Tabla de transposición para reutilizar entre búsquedas. Por defecto, una nueva. */
  readonly table?: TranspositionTable;
  /** Reloj en milisegundos. Por defecto, `performance.now`. */
  readonly now?: () => number;
}

export interface SearchResult {
  /** Mejor jugada en UCI, o `null` si no hay jugadas legales. */
  readonly best: string | null;
  /** Puntuación en centipeones para el bando que mueve (mates: ±(MATE_SCORE − n)). */
  readonly score: number;
  /** Última profundidad completada. */
  readonly depth: number;
  /** Nodos visitados. */
  readonly nodes: number;
  /** Variante principal en UCI, empezando por `best`. */
  readonly pv: readonly string[];
}

const PROMOTION_CODE: Readonly<Record<PromotionPiece, number>> = { q: 1, r: 2, b: 3, n: 4 };

/** Jugada codificada para la tabla de transposición (nunca 0). */
const encode = (move: Move): number =>
  1 + move.from + (move.to << 7) + ((move.promotion === null ? 0 : PROMOTION_CODE[move.promotion]) << 14);

/** ¿Es una puntuación de mate? Se guardan en la tabla relativas a la posición, no a la raíz. */
const toTable = (score: number, ply: number): number =>
  score > MATE_BOUND ? score + ply : score < -MATE_BOUND ? score - ply : score;
const fromTable = (score: number, ply: number): number =>
  score > MATE_BOUND ? score - ply : score < -MATE_BOUND ? score + ply : score;

function checkLimits(limits: SearchLimits): { maxDepth: number; timeMs: number } {
  const { maxDepth = MAX_DEPTH, timeMs = Infinity } = limits;
  if (!Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > MAX_DEPTH) {
    throw new RangeError(`Profundidad no válida: ${maxDepth}`);
  }
  if (typeof timeMs !== "number" || Number.isNaN(timeMs) || timeMs <= 0) {
    throw new RangeError(`Tiempo no válido: ${timeMs}`);
  }
  if (limits.maxDepth === undefined && timeMs === Infinity) {
    throw new RangeError("Hace falta una profundidad máxima o un tiempo máximo");
  }
  return { maxDepth, timeMs };
}

/**
 * Busca la mejor jugada para el bando que mueve.
 *
 * Usa `position` como espacio de trabajo: hace y deshace jugadas y la deja
 * como estaba, pero las listas obtenidas antes con `legalMoves()` dejan de
 * valer para `makeMove`. Las jugadas hechas antes en `position` cuentan para
 * las repeticiones.
 */
export function search(position: Position, limits: SearchLimits, options: SearchOptions = {}): SearchResult {
  const { maxDepth, timeMs } = checkLimits(limits);
  return new Searcher(position, options.table ?? new TranspositionTable(), options.now ?? (() => performance.now())).run(
    maxDepth,
    timeMs,
  );
}

class Searcher {
  private nodes = 0;
  private deadline = Infinity;
  /** El reloj solo puede cortar la búsqueda cuando ya hay una profundidad completa. */
  private canStop = false;
  private stopped = false;
  /** Variante principal triangular: pv[ply] es la mejor línea desde ese ply. */
  private readonly pv: string[][] = Array.from({ length: MAX_PLY + 1 }, () => []);

  constructor(
    private readonly position: Position,
    private readonly table: TranspositionTable,
    private readonly now: () => number,
  ) {}

  run(maxDepth: number, timeMs: number): SearchResult {
    const position = this.position;
    this.deadline = this.now() + timeMs;
    if (position.legalMoves().length === 0) {
      return { best: null, score: position.isCheck() ? -MATE_SCORE : 0, depth: 0, nodes: 0, pv: [] };
    }

    let result: SearchResult | null = null;
    for (let depth = 1; depth <= maxDepth; depth++) {
      const raw = this.negamax(depth, 0, -INFINITY, INFINITY);
      if (this.stopped) break;
      const score = raw === 0 ? 0 : raw; // sin -0
      const pv = this.pv[0]!.slice();
      result = { best: pv[0] ?? null, score, depth, nodes: this.nodes, pv };
      this.canStop = true;
      // Un mate dentro de la profundidad buscada es el más corto: no hace falta seguir.
      // (Las extensiones de jaque pueden ver mates más largos; esos se siguen afinando.)
      if (Math.abs(score) > MATE_BOUND && MATE_SCORE - Math.abs(score) <= depth) break;
      if (this.now() >= this.deadline) break;
    }
    // La profundidad 1 nunca se corta, así que siempre hay resultado.
    return { ...result!, nodes: this.nodes };
  }

  private negamax(depth: number, ply: number, alpha: number, beta: number): number {
    const position = this.position;
    this.pv[ply]!.length = 0;
    if (this.tick()) return 0;

    if (ply > 0) {
      if (position.halfmoveClock >= 100 || position.repetitions() > 0 || position.isInsufficientMaterial()) return 0;
      if (ply >= MAX_PLY) return evaluate(position);
    }

    const inCheck = position.isCheck();
    if (inCheck) depth++;
    if (depth <= 0) return this.quiesce(ply, alpha, beta);

    // Tabla de transposición: puede cortar aquí (salvo en la raíz) y da la jugada a probar primero.
    const hi = position.hashHi;
    const lo = position.hashLo;
    let ttMove = 0;
    const entry = this.table.find(hi, lo);
    if (entry !== -1) {
      ttMove = this.table.move(entry);
      if (ply > 0 && this.table.depth(entry) >= depth) {
        const score = fromTable(this.table.score(entry), ply);
        const bound = this.table.bound(entry);
        if (
          bound === BOUND_EXACT ||
          (bound === BOUND_LOWER && score >= beta) ||
          (bound === BOUND_UPPER && score <= alpha)
        ) {
          return score;
        }
      }
    }

    const moves = position.legalMoves();
    if (moves.length === 0) return inCheck ? -MATE_SCORE + ply : 0;
    this.order(moves, ttMove);

    const startAlpha = alpha;
    let bestScore = -INFINITY;
    let bestMove = 0;
    for (const move of moves) {
      position.makeMove(move);
      const score = -this.negamax(depth - 1, ply + 1, -beta, -alpha);
      position.unmakeMove();
      if (this.stopped) return 0;
      if (score > bestScore) {
        bestScore = score;
        bestMove = encode(move);
        if (score > alpha) {
          alpha = score;
          this.updatePv(ply, move);
          if (alpha >= beta) break;
        }
      }
    }

    const bound = bestScore >= beta ? BOUND_LOWER : bestScore <= startAlpha ? BOUND_UPPER : BOUND_EXACT;
    this.table.store(hi, lo, depth, bound, toTable(bestScore, ply), bestMove);
    return bestScore;
  }

  /** Quietud: solo capturas y coronaciones a dama, con la valoración estática como suelo. */
  private quiesce(ply: number, alpha: number, beta: number): number {
    const position = this.position;
    this.pv[ply]!.length = 0;
    if (this.tick()) return 0;

    const standPat = evaluate(position);
    if (ply >= MAX_PLY || standPat >= beta) return standPat;
    if (standPat > alpha) alpha = standPat;

    const moves = position.legalMoves().filter((move) => this.isNoisy(move));
    this.order(moves, 0);
    for (const move of moves) {
      position.makeMove(move);
      const score = -this.quiesce(ply + 1, -beta, -alpha);
      position.unmakeMove();
      if (this.stopped) return 0;
      if (score > alpha) {
        if (score >= beta) return score;
        alpha = score;
        this.updatePv(ply, move);
      }
    }
    return alpha;
  }

  /** Cuenta el nodo y mira el reloj de vez en cuando. Devuelve `true` si hay que parar. */
  private tick(): boolean {
    this.nodes++;
    if (this.canStop && this.nodes % CLOCK_INTERVAL === 0 && this.now() >= this.deadline) this.stopped = true;
    return this.stopped;
  }

  private updatePv(ply: number, move: Move): void {
    const line = this.pv[ply]!;
    line.length = 0;
    line.push(moveToUci(move));
    for (const next of this.pv[ply + 1]!) line.push(next);
  }

  /** Captura (también al paso) o coronación a dama. */
  private isNoisy(move: Move): boolean {
    return move.promotion === "q" || this.victimValue(move) > 0;
  }

  /** Valor de la pieza capturada, o 0 si no captura. */
  private victimValue(move: Move): number {
    const target = this.position.pieceAt(move.to);
    if (target !== null) return PIECE_VALUES[target.type];
    // Captura al paso: un peón que cambia de columna hacia una casilla vacía.
    const mover = this.position.pieceAt(move.from);
    return mover !== null && mover.type === "p" && (move.from & 7) !== (move.to & 7) ? PIECE_VALUES.p : 0;
  }

  /** Ordena en el sitio: jugada de la tabla, capturas MVV-LVA, coronaciones, resto. */
  private order(moves: Move[], ttMove: number): void {
    const keys = new Map<Move, number>();
    for (const move of moves) {
      let key = 0;
      if (ttMove !== 0 && encode(move) === ttMove) key = 1_000_000;
      else {
        const victim = this.victimValue(move);
        if (victim > 0) {
          const attacker = this.position.pieceAt(move.from)!;
          key = 100_000 + victim * 10 - PIECE_VALUES[attacker.type] / 10;
        }
        if (move.promotion !== null) key += move.promotion === "q" ? 90_000 : 1_000;
      }
      keys.set(move, key);
    }
    moves.sort((a, b) => keys.get(b)! - keys.get(a)!);
  }
}
