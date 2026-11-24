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
  /**
   * Nodos máximos, además de los límites: como el reloj, pero determinista (el
   * mismo resultado en cualquier equipo). Igual que con el reloj, la profundidad 1
   * siempre se termina. Por defecto, sin límite.
   */
  readonly maxNodes?: number;
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

function checkLimits(limits: SearchLimits, maxNodes = Infinity): { maxDepth: number; timeMs: number; maxNodes: number } {
  const { maxDepth = MAX_DEPTH, timeMs = Infinity } = limits;
  if (!Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > MAX_DEPTH) {
    throw new RangeError(`Profundidad no válida: ${maxDepth}`);
  }
  if (typeof timeMs !== "number" || Number.isNaN(timeMs) || timeMs <= 0) {
    throw new RangeError(`Tiempo no válido: ${timeMs}`);
  }
  if (typeof maxNodes !== "number" || Number.isNaN(maxNodes) || maxNodes < 1) {
    throw new RangeError(`Nodos no válidos: ${maxNodes}`);
  }
  if (limits.maxDepth === undefined && timeMs === Infinity && maxNodes === Infinity) {
    throw new RangeError("Hace falta una profundidad, un tiempo o unos nodos máximos");
  }
  return { maxDepth, timeMs, maxNodes };
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
  const { maxDepth, timeMs, maxNodes } = checkLimits(limits, options.maxNodes);
  return makeSearcher(position, options).run(maxDepth, timeMs, maxNodes);
}

function makeSearcher(position: Position, options: SearchOptions): Searcher {
  return new Searcher(position, options.table ?? new TranspositionTable(), options.now ?? (() => performance.now()));
}

/** Puntuación de una jugada de la raíz (ver `scoreMoves`). */
export interface ScoredMove {
  readonly uci: string;
  readonly score: number;
}

/**
 * Puntúa cada jugada legal con una búsqueda de ventana completa a la
 * profundidad dada (más la quietud), sin límite de tiempo. Sirve para el
 * azar controlado del nivel fácil, que necesita la puntuación de todas las
 * jugadas y no solo la mejor. Misma advertencia que `search` sobre `position`.
 */
export function scoreMoves(position: Position, depth: number, options: SearchOptions = {}): ScoredMove[] {
  checkLimits({ maxDepth: depth });
  return makeSearcher(position, options).scoreRoot(depth);
}

/** Margen de la ventana de aspiración alrededor de la puntuación anterior (centipeones). */
const ASPIRATION_CP = 40;
/** Claves de orden: jugada de la tabla > capturas y coronación a dama > asesinas > historial. */
const KEY_TT = 1 << 30;
const KEY_CAPTURE = 1 << 28;
const KEY_KILLER_1 = 1 << 27;
const KEY_KILLER_2 = KEY_KILLER_1 - 1;
/** El historial se mantiene por debajo de las asesinas. */
const HISTORY_MAX = 1 << 26;

class Searcher {
  private nodes = 0;
  private deadline = Infinity;
  private maxNodes = Infinity;
  /** El reloj solo puede cortar la búsqueda cuando ya hay una profundidad completa. */
  private canStop = false;
  private stopped = false;
  /** Variante principal triangular: pv[ply] es la mejor línea desde ese ply (UCI solo al terminar). */
  private readonly pv: Move[][] = Array.from({ length: MAX_PLY + 1 }, () => []);
  /** Dos jugadas «asesinas» por ply: tranquilas que produjeron un corte beta (codificadas). */
  private readonly killers = new Int32Array((MAX_PLY + 1) * 2);
  /** Historial: cuánto han cortado las jugadas tranquilas, por bando, origen y destino. */
  private readonly history = new Int32Array(2 * 128 * 128);
  /** Mejor jugada de la raíz terminada en la iteración en curso (vale aunque se corte). */
  private rootMove: Move | null = null;
  private rootScore = 0;
  private rootPv: Move[] = [];

  constructor(
    private readonly position: Position,
    private readonly table: TranspositionTable,
    private readonly now: () => number,
  ) {}

  run(maxDepth: number, timeMs: number, maxNodes = Infinity): SearchResult {
    const position = this.position;
    this.deadline = this.now() + timeMs;
    this.maxNodes = maxNodes;
    if (position.legalMoves().length === 0) {
      return { best: null, score: position.isCheck() ? -MATE_SCORE : 0, depth: 0, nodes: 0, pv: [] };
    }

    let result: SearchResult | null = null;
    for (let depth = 1; depth <= maxDepth; depth++) {
      this.rootMove = null;
      const raw = this.aspiration(depth, result?.score ?? 0);
      if (this.stopped) {
        // Iteración cortada: si ya terminó de mirar una jugada de la raíz que supera a la
        // anterior, esa es mejor información que la iteración pasada.
        // Su variante es la guardada en la raíz al encontrarla; su puntuación puede ser
        // solo una cota inferior, y la profundidad que se da es la de la última iteración completa.
        if (result !== null && this.rootMove !== null && moveToUci(this.rootMove) !== result.best && this.rootScore > result.score) {
          const pv = this.rootPv.map(moveToUci);
          result = { best: pv[0]!, score: this.rootScore, depth: result.depth, nodes: this.nodes, pv };
        }
        break;
      }
      const score = raw === 0 ? 0 : raw; // sin -0
      const pv = this.pv[0]!.map(moveToUci);
      result = { best: pv[0] ?? null, score, depth, nodes: this.nodes, pv };
      this.canStop = true;
      // Un mate dentro de la profundidad buscada es el más corto: no hace falta seguir.
      // (Las extensiones de jaque pueden ver mates más largos; esos se siguen afinando.)
      if (Math.abs(score) > MATE_BOUND && MATE_SCORE - Math.abs(score) <= depth) break;
      if (this.now() >= this.deadline || this.nodes >= this.maxNodes) break;
    }
    // La profundidad 1 nunca se corta, así que siempre hay resultado.
    return { ...result!, nodes: this.nodes };
  }

  /**
   * Ventana de aspiración: desde la profundidad 4 se busca primero cerca de la
   * puntuación anterior; si la real queda fuera, se repite con la ventana abierta por ese lado.
   */
  private aspiration(depth: number, previous: number): number {
    if (depth < 4 || Math.abs(previous) > MATE_BOUND) return this.negamax(depth, 0, -INFINITY, INFINITY, true);
    let delta = ASPIRATION_CP;
    let alpha = previous - delta;
    let beta = previous + delta;
    for (;;) {
      const score = this.negamax(depth, 0, alpha, beta, true);
      if (this.stopped) return score;
      if (score <= alpha) alpha = delta > 500 ? -INFINITY : Math.max(-INFINITY, score - delta);
      else if (score >= beta) beta = delta > 500 ? INFINITY : Math.min(INFINITY, score + delta);
      else return score;
      delta *= 3;
    }
  }

  scoreRoot(depth: number): ScoredMove[] {
    const position = this.position;
    const scored: ScoredMove[] = [];
    for (const move of position.legalMoves()) {
      position.makeMove(move);
      const score = -this.negamax(depth - 1, 1, -INFINITY, INFINITY, true);
      position.unmakeMove();
      scored.push({ uci: moveToUci(move), score: score === 0 ? 0 : score });
    }
    return scored;
  }

  /**
   * Negamax con alfa-beta y búsqueda de variante principal (PVS): la primera
   * jugada se mira con la ventana completa y las demás con ventana nula, que
   * solo prueba si superan a alfa; si lo hacen, se repiten con la ventana completa.
   * Las jugadas tranquilas tardías se miran primero con una profundidad menos (LMR).
   */
  private negamax(depth: number, ply: number, alpha: number, beta: number, pvNode: boolean, allowNull = true): number {
    const position = this.position;
    this.pv[ply]!.length = 0;
    if (this.tick()) return 0;

    if (ply > 0) {
      if (position.repetitions() > 0 || position.isInsufficientMaterial()) return 0;
      // 50 jugadas: tablas, salvo que la jugada que llega a 100 dé mate (manda el mate).
      if (position.halfmoveClock >= 100) {
        return position.isCheck() && position.legalMoves().length === 0 ? -MATE_SCORE + ply : 0;
      }
      if (ply >= MAX_PLY) return evaluate(position);
    }

    const inCheck = position.isCheck();
    if (inCheck) depth++;
    if (depth <= 0) return this.quiesce(ply, alpha, beta);

    // Tabla de transposición: puede cortar aquí (salvo en la raíz y en la variante
    // principal, para no perder la línea) y da la jugada a probar primero.
    const hi = position.hashHi;
    const lo = position.hashLo;
    let ttMove = 0;
    const entry = this.table.find(hi, lo);
    if (entry !== -1) {
      ttMove = this.table.move(entry);
      if (ply > 0 && !pvNode && this.table.depth(entry) >= depth) {
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

    // Poda de jugada nula: si aun pasando el turno (y mirando menos) el rival no
    // llega a beta, la posición es tan buena que no hace falta mirarla entera.
    // No en jaque, ni en la variante principal, ni sin piezas (zugzwang en finales de peones);
    // después de ver que hay jugadas, para no tapar un ahogado.
    if (
      allowNull &&
      !pvNode &&
      !inCheck &&
      ply > 0 &&
      depth >= 3 &&
      Math.abs(beta) < MATE_BOUND &&
      this.hasPieces() &&
      evaluate(position) >= beta
    ) {
      const reduction = depth >= 6 ? 3 : 2;
      position.makeNullMove();
      const score = -this.negamax(depth - 1 - reduction, ply + 1, -beta, -beta + 1, false, false);
      position.unmakeNullMove();
      if (this.stopped) return 0;
      if (score >= beta) return beta;
    }

    const quiet = this.order(moves, ttMove, ply);

    const startAlpha = alpha;
    let bestScore = -INFINITY;
    let bestMove = 0;
    const side = position.turn === "w" ? 0 : 1;
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i]!;
      const isQuiet = quiet[i]!;
      position.makeMove(move);
      let score: number;
      if (i === 0) {
        score = -this.negamax(depth - 1, ply + 1, -beta, -alpha, pvNode);
      } else {
        // LMR: jugada tranquila tardía, sin jaque de por medio y con profundidad de sobra.
        let reduction = 0;
        if (isQuiet && depth >= 3 && i >= 3 && !inCheck && !position.isCheck()) {
          reduction = i >= 8 && depth >= 5 ? 2 : 1;
        }
        score = -this.negamax(depth - 1 - reduction, ply + 1, -alpha - 1, -alpha, false);
        if (!this.stopped && score > alpha && reduction > 0) {
          score = -this.negamax(depth - 1, ply + 1, -alpha - 1, -alpha, false);
        }
        if (!this.stopped && score > alpha && score < beta) {
          score = -this.negamax(depth - 1, ply + 1, -beta, -alpha, true);
        }
      }
      position.unmakeMove();
      if (this.stopped) return 0;
      if (score > bestScore) {
        bestScore = score;
        bestMove = encode(move);
        if (score > alpha) {
          alpha = score;
          this.updatePv(ply, move);
          if (ply === 0) {
            this.rootMove = move;
            this.rootScore = score;
            this.rootPv = this.pv[0]!.slice();
          }
          if (alpha >= beta) {
            if (isQuiet) this.rememberCutoff(move, ply, depth, side);
            break;
          }
        }
      }
    }

    const bound = bestScore >= beta ? BOUND_LOWER : bestScore <= startAlpha ? BOUND_UPPER : BOUND_EXACT;
    this.table.store(hi, lo, depth, bound, toTable(bestScore, ply), bestMove);
    return bestScore;
  }

  /** ¿Tiene el bando que mueve alguna pieza que no sea peón ni rey? */
  private hasPieces(): boolean {
    const position = this.position;
    const turn = position.turn;
    for (let sq = 0; sq < 128; sq++) {
      if ((sq & 0x88) !== 0) {
        sq += 7;
        continue;
      }
      const piece = position.pieceAt(sq);
      if (piece !== null && piece.color === turn && piece.type !== "p" && piece.type !== "k") return true;
    }
    return false;
  }

  /** Una jugada tranquila cortó: pasa a ser asesina en este ply y gana historial. */
  private rememberCutoff(move: Move, ply: number, depth: number, side: number): void {
    const code = encode(move);
    const k = ply * 2;
    if (this.killers[k] !== code) {
      this.killers[k + 1] = this.killers[k]!;
      this.killers[k] = code;
    }
    const h = (side << 14) | (move.from << 7) | move.to;
    const value = this.history[h]! + depth * depth;
    if (value >= HISTORY_MAX) {
      for (let i = 0; i < this.history.length; i++) this.history[i] = this.history[i]! >> 1;
      this.history[h] = value >> 1;
    } else {
      this.history[h] = value;
    }
  }

  /**
   * Quietud: solo capturas y coronaciones a dama, con la valoración estática
   * como suelo. Quien está en jaque no puede quedarse quieto: se miran todas
   * sus respuestas, y si no tiene ninguna es mate.
   */
  private quiesce(ply: number, alpha: number, beta: number): number {
    const position = this.position;
    this.pv[ply]!.length = 0;
    if (this.tick()) return 0;
    if (ply >= MAX_PLY) return evaluate(position);

    const inCheck = position.isCheck();
    let moves: Move[];
    if (inCheck) {
      moves = position.legalMoves();
      if (moves.length === 0) return -MATE_SCORE + ply;
    } else {
      const standPat = evaluate(position);
      if (standPat >= beta) return standPat;
      if (standPat > alpha) alpha = standPat;
      // Solo se generan (y se comprueban) las capturas y coronaciones: es el grueso de los nodos.
      moves = position.noisyMoves().filter((move) => this.isNoisy(move));
    }
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
    if (this.canStop && (this.nodes >= this.maxNodes || (this.nodes % CLOCK_INTERVAL === 0 && this.now() >= this.deadline))) this.stopped = true;
    return this.stopped;
  }

  private updatePv(ply: number, move: Move): void {
    const line = this.pv[ply]!;
    line.length = 0;
    line.push(move);
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

  /**
   * Ordena en el sitio: jugada de la tabla, capturas MVV-LVA y coronación a
   * dama, asesinas del ply, resto por historial. Devuelve, en el nuevo orden,
   * qué jugadas son tranquilas (ni captura ni coronación).
   */
  private order(moves: Move[], ttMove: number, ply = -1): boolean[] {
    const n = moves.length;
    const keys = new Array<number>(n);
    const quiet = new Array<boolean>(n);
    const k1 = ply >= 0 ? this.killers[ply * 2]! : 0;
    const k2 = ply >= 0 ? this.killers[ply * 2 + 1]! : 0;
    const side = this.position.turn === "w" ? 0 : 1;
    for (let i = 0; i < n; i++) {
      const move = moves[i]!;
      const code = encode(move);
      const victim = this.victimValue(move);
      quiet[i] = victim === 0 && move.promotion === null;
      let key = 0;
      if (ttMove !== 0 && code === ttMove) key = KEY_TT;
      else if (victim > 0) {
        const attacker = this.position.pieceAt(move.from)!;
        key = KEY_CAPTURE + victim * 10 - PIECE_VALUES[attacker.type] / 10 + (move.promotion === "q" ? 9_000 : 0);
      } else if (move.promotion === "q") key = KEY_CAPTURE + 8_000;
      else if (move.promotion !== null) key = 1_000;
      else if (code === k1) key = KEY_KILLER_1;
      else if (code === k2) key = KEY_KILLER_2;
      else if (ply >= 0) key = this.history[(side << 14) | (move.from << 7) | move.to]!;
      keys[i] = key;
    }
    // Ordenación por inserción, estable: las listas son cortas.
    for (let i = 1; i < n; i++) {
      const move = moves[i]!;
      const key = keys[i]!;
      const q = quiet[i]!;
      let j = i - 1;
      while (j >= 0 && keys[j]! < key) {
        moves[j + 1] = moves[j]!;
        keys[j + 1] = keys[j]!;
        quiet[j + 1] = quiet[j]!;
        j--;
      }
      moves[j + 1] = move;
      keys[j + 1] = key;
      quiet[j + 1] = q;
    }
    return quiet;
  }
}
