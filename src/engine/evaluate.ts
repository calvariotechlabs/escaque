// Evaluación de Alfil Beta: material, tablas de valor por casilla, seguridad
// del rey y estructura de peones (B11).
//
// Devuelve centipeones desde el punto de vista del bando que mueve (positivo =
// le va bien a quien mueve), que es lo que necesita negamax. Es simétrica: la
// misma posición con los colores cambiados vale lo mismo para quien mueve.
import type { PieceType, Position } from "../core/index.js";

/** Valor de cada pieza en centipeones. El rey no se cuenta: nunca sale del tablero. */
export const PIECE_VALUES: Readonly<Record<PieceType, number>> = Object.freeze({
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
});

// Tablas de valor por casilla, vistas por las blancas: la primera fila es la
// 8.ª (a8…h8) y la última la 1.ª (a1…h1). Para las negras se refleja la fila.
// prettier-ignore
const PAWN = [
    0,   0,   0,   0,   0,   0,   0,   0,
   60,  60,  60,  60,  60,  60,  60,  60,
   15,  15,  25,  35,  35,  25,  15,  15,
    5,   5,  10,  25,  25,  10,   5,   5,
    0,   0,   5,  20,  20,   5,   0,   0,
    5,  -5,  -5,   5,   5,  -5,  -5,   5,
    5,  10,  10, -20, -20,  10,  10,   5,
    0,   0,   0,   0,   0,   0,   0,   0,
];
// prettier-ignore
const KNIGHT = [
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20,   0,   5,   5,   0, -20, -40,
  -30,   5,  10,  15,  15,  10,   5, -30,
  -30,   0,  15,  20,  20,  15,   0, -30,
  -30,   5,  15,  20,  20,  15,   5, -30,
  -30,   0,  10,  15,  15,  10,   0, -30,
  -40, -20,   0,   5,   5,   0, -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50,
];
// prettier-ignore
const BISHOP = [
  -20, -10, -10, -10, -10, -10, -10, -20,
  -10,   0,   0,   0,   0,   0,   0, -10,
  -10,   0,   5,  10,  10,   5,   0, -10,
  -10,   5,   5,  10,  10,   5,   5, -10,
  -10,   0,  10,  10,  10,  10,   0, -10,
  -10,  10,  10,  10,  10,  10,  10, -10,
  -10,   5,   0,   0,   0,   0,   5, -10,
  -20, -10, -10, -10, -10, -10, -10, -20,
];
// prettier-ignore
const ROOK = [
    0,   0,   0,   0,   0,   0,   0,   0,
    5,  10,  10,  10,  10,  10,  10,   5,
   -5,   0,   0,   0,   0,   0,   0,  -5,
   -5,   0,   0,   0,   0,   0,   0,  -5,
   -5,   0,   0,   0,   0,   0,   0,  -5,
   -5,   0,   0,   0,   0,   0,   0,  -5,
   -5,   0,   0,   0,   0,   0,   0,  -5,
    0,   0,   0,   5,   5,   0,   0,   0,
];
// prettier-ignore
const QUEEN = [
  -20, -10, -10,  -5,  -5, -10, -10, -20,
  -10,   0,   0,   0,   0,   0,   0, -10,
  -10,   0,   5,   5,   5,   5,   0, -10,
   -5,   0,   5,   5,   5,   5,   0,  -5,
    0,   0,   5,   5,   5,   5,   0,  -5,
  -10,   5,   5,   5,   5,   5,   0, -10,
  -10,   0,   5,   0,   0,   0,   0, -10,
  -20, -10, -10,  -5,  -5, -10, -10, -20,
];
// Rey en el medio juego: detrás de sus peones, mejor enrocado.
// prettier-ignore
const KING_MIDDLE = [
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -20, -30, -30, -40, -40, -30, -30, -20,
  -10, -20, -20, -20, -20, -20, -20, -10,
   20,  20,   0,   0,   0,   0,  20,  20,
   20,  30,  10,   0,   0,  10,  30,  20,
];
// Rey en el final: una pieza más, cuanto más al centro mejor.
// prettier-ignore
const KING_END = [
  -50, -40, -30, -20, -20, -30, -40, -50,
  -30, -20, -10,   0,   0, -10, -20, -30,
  -30, -10,  20,  30,  30,  20, -10, -30,
  -30, -10,  30,  40,  40,  30, -10, -30,
  -30, -10,  30,  40,  40,  30, -10, -30,
  -30, -10,  20,  30,  30,  20, -10, -30,
  -30, -30,   0,   0,   0,   0, -30, -30,
  -50, -30, -30, -30, -30, -30, -30, -50,
];


const FULL_PHASE = 24;

// --- Seguridad del rey y estructura de peones (B11) -----------------------------------
//
// Todo se calcula para cada bando con la misma regla, así que la valoración sigue
// siendo simétrica. La seguridad del rey pesa en el medio juego (se escala con la
// fase) y la del peón pasado, sobre todo en el final.

/** Peón del escudo que falta delante del rey (columnas del rey y vecinas). */
const SHIELD_MISSING = 22;
/** Peón del escudo adelantado una fila: protege, pero menos. */
const SHIELD_ADVANCED = 8;
/** Columna sin peones propios junto al rey; sin peones de nadie, peor. */
const KING_SEMI_OPEN = 15;
const KING_OPEN = 25;
/** Penalización según las unidades de ataque (crece deprisa: varios atacantes son mucho peor que uno). */
const ATTACK_PENALTY = [0, 0, 4, 9, 15, 22, 30, 40, 52, 65, 80, 95, 110, 125, 140, 150];
const DOUBLED = 15;
const ISOLATED = 15;
/** Peón pasado según las filas que ha avanzado (0 = sin mover, 5 = en séptima): medio juego y final. */
const PASSED_MIDDLE = [0, 5, 10, 20, 35, 60];
const PASSED_END = [0, 10, 25, 45, 75, 120];
const BISHOP_PAIR = 30;
/**
 * Movilidad: casillas a las que llega cada pieza (vacías o con una pieza rival),
 * por encima de una cifra «normal» para su tipo; por debajo, resta. Así una dama
 * encerrada o una pieza sin desarrollar valen menos (H-14: …Dxa1 deja la dama atrapada).
 * Índices: tipo interno (2 caballo, 3 alfil, 4 torre, 5 dama). Medio juego y final.
 */
const MOBILITY_BASE = [0, 0, 4, 6, 6, 12, 0];
const MOBILITY_MIDDLE = [0, 0, 4, 4, 2, 1, 0];
const MOBILITY_END = [0, 0, 4, 4, 4, 2, 0];
/** Unidades de ataque que resta cada pieza propia cerca del rey. */
const DEFENDER_UNITS = 2;
/** Rey que ha salido de sus dos primeras filas con la dama rival en el tablero, por fila. */
const KING_EXPOSED = 30;
const ROOK_OPEN_FILE = 20;
const ROOK_SEMI_OPEN_FILE = 10;

const KNIGHT_STEPS = [33, 31, 18, 14, -14, -18, -31, -33];
const KING_STEPS = [17, 16, 15, 1, -1, -15, -16, -17];
const DIAGONALS = [17, 15, -15, -17];
const LINES = [16, 1, -1, -16];

// Códigos de `Position.copyBoard`: 0 vacío; tipo 1 peón, 2 caballo, 3 alfil, 4 torre,
// 5 dama, 6 rey; más 8 si es negra.
const TABLE_BY_INDEX: readonly (readonly number[])[] = [[], PAWN, KNIGHT, BISHOP, ROOK, QUEEN, []];
/** Unidades de ataque por pieza que alcanza la zona del rey. */
const UNITS_BY_INDEX = [0, 0, 2, 2, 3, 5, 0];
const VALUE_BY_INDEX = [0, PIECE_VALUES.p, PIECE_VALUES.n, PIECE_VALUES.b, PIECE_VALUES.r, PIECE_VALUES.q, 0];
/** Peso de cada pieza en la fase de la partida: 24 con todas las piezas, 0 sin ninguna. */
const PHASE_BY_INDEX = [0, 0, 1, 1, 2, 4, 0];

// Memoria de trabajo reutilizada en cada llamada: la evaluación no crea objetos.
/** Tablero 0x88 local, copiado con `copyBoard`. */
const board = new Uint8Array(128);
/** Peones por columna de cada bando: [blancas 0-7, negras 8-15]. */
const pawnFiles = new Int32Array(16);
/** Casillas de los peones y de las piezas (sin reyes) de cada bando. */
const pawnSquares = [new Int32Array(64), new Int32Array(64)] as const;
const pawnTotal = new Int32Array(2);
const pieceSquares = [new Int32Array(64), new Int32Array(64)] as const;
const pieceTotal = new Int32Array(2);
/** Zona del rey marcada con un sello distinto en cada uso (no hay que borrarla). */
const zone = new Int32Array(128);
let zoneStamp = 0;

/** Marca la zona del rey: el rey, sus vecinas y las tres casillas dos filas por delante. */
function markZone(king: number, forward: number): void {
  // El sello cabe siempre en el Int32Array: al llegar al tope se vacía la zona.
  if (++zoneStamp > 0x3fffffff) {
    zone.fill(0);
    zoneStamp = 1;
  }
  zone[king] = zoneStamp;
  for (const step of KING_STEPS) {
    const sq = king + step;
    if ((sq & 0x88) === 0) zone[sq] = zoneStamp;
  }
  for (let df = -1; df <= 1; df++) {
    const sq = king + 2 * forward + df;
    if ((sq & 0x88) === 0) zone[sq] = zoneStamp;
  }
}

/** Cuántas casillas de la zona marcada ataca la pieza de `from` (las deslizantes se paran en la primera pieza). */
function zoneHits(type: number, from: number): number {
  let hits = 0;
  if (type === 2) {
    for (const step of KNIGHT_STEPS) {
      const sq = from + step;
      if ((sq & 0x88) === 0 && zone[sq] === zoneStamp) hits++;
    }
    return hits;
  }
  if (type === 3 || type === 5) {
    for (const dir of DIAGONALS) {
      for (let sq = from + dir; (sq & 0x88) === 0; sq += dir) {
        if (zone[sq] === zoneStamp) hits++;
        if (board[sq] !== 0) break;
      }
    }
  }
  if (type === 4 || type === 5) {
    for (const dir of LINES) {
      for (let sq = from + dir; (sq & 0x88) === 0; sq += dir) {
        if (zone[sq] === zoneStamp) hits++;
        if (board[sq] !== 0) break;
      }
    }
  }
  return hits;
}

/** Casillas a las que llega la pieza de `from` del bando `color` (vacías o con pieza rival). */
function mobility(type: number, from: number, color: number): number {
  let count = 0;
  const ownColor = color << 3;
  if (type === 2) {
    for (const step of KNIGHT_STEPS) {
      const sq = from + step;
      if ((sq & 0x88) !== 0) continue;
      const target = board[sq]!;
      if (target === 0 || (target & 8) !== ownColor) count++;
    }
    return count;
  }
  if (type === 3 || type === 5) {
    for (const dir of DIAGONALS) {
      for (let sq = from + dir; (sq & 0x88) === 0; sq += dir) {
        const target = board[sq]!;
        if (target === 0) count++;
        else {
          if ((target & 8) !== ownColor) count++;
          break;
        }
      }
    }
  }
  if (type === 4 || type === 5) {
    for (const dir of LINES) {
      for (let sq = from + dir; (sq & 0x88) === 0; sq += dir) {
        const target = board[sq]!;
        if (target === 0) count++;
        else {
          if ((target & 8) !== ownColor) count++;
          break;
        }
      }
    }
  }
  return count;
}

/** Valoración estática de la posición en centipeones, para el bando que mueve. */
export function evaluate(position: Position): number {
  let white = 0;
  let black = 0;
  let phase = 0;
  const kingIndex = [-1, -1];
  const kingSq = [-1, -1];
  const bishops = [0, 0];
  pawnFiles.fill(0);
  pawnTotal[0] = pawnTotal[1] = 0;
  pieceTotal[0] = pieceTotal[1] = 0;

  position.copyBoard(board);
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const sq = rank * 16 + file;
      const code = board[sq]!;
      if (code === 0) continue;
      const color = code >> 3;
      const type = code & 7;
      // Índice de la tabla: blancas leen la fila reflejada (la tabla empieza en la 8.ª).
      const index = color === 0 ? (7 - rank) * 8 + file : rank * 8 + file;
      phase += PHASE_BY_INDEX[type]!;
      if (type === 6) {
        kingIndex[color] = index;
        kingSq[color] = sq;
        continue;
      }
      if (type === 1) {
        pawnFiles[color * 8 + file]!++;
        pawnSquares[color]![pawnTotal[color]!++] = sq;
      } else {
        pieceSquares[color]![pieceTotal[color]!++] = sq;
        if (type === 3) bishops[color]!++;
      }
      const value = VALUE_BY_INDEX[type]! + TABLE_BY_INDEX[type]![index]!;
      if (color === 0) white += value;
      else black += value;
    }
  }

  // El rey pasa de la tabla del medio juego a la del final según el material que queda.
  const middle = Math.min(phase, FULL_PHASE);
  const king = (index: number): number =>
    Math.trunc((KING_MIDDLE[index]! * middle + KING_END[index]! * (FULL_PHASE - middle)) / FULL_PHASE);
  white += king(kingIndex[0]!);
  black += king(kingIndex[1]!);

  // Términos que dependen de la fase: se acumulan aparte para escalar una sola vez.
  let middleTerms = 0; // blancas − negras, pesa con `middle`
  let endTerms = 0; // blancas − negras, pesa con el resto

  for (let color = 0; color < 2; color++) {
    const sign = color === 0 ? 1 : -1;
    const them = 1 - color;
    const forward = color === 0 ? 16 : -16;
    const own = color * 8;
    const enemy = them * 8;

    // Estructura de peones.
    for (let file = 0; file < 8; file++) {
      const n = pawnFiles[own + file]!;
      if (n === 0) continue;
      if (n > 1) white -= sign * DOUBLED * (n - 1);
      if ((file === 0 || pawnFiles[own + file - 1] === 0) && (file === 7 || pawnFiles[own + file + 1] === 0)) white -= sign * ISOLATED * n;
    }
    const ownPawns = pawnSquares[color]!;
    const enemyPawns = pawnSquares[them]!;
    for (let i = 0; i < pawnTotal[color]!; i++) {
      const sq = ownPawns[i]!;
      const file = sq & 7;
      const rank = sq >> 4;
      let passed = true;
      for (let j = 0; j < pawnTotal[them]!; j++) {
        const enemySq = enemyPawns[j]!;
        const ef = enemySq & 7;
        if (ef < file - 1 || ef > file + 1) continue;
        const er = enemySq >> 4;
        if (color === 0 ? er > rank : er < rank) {
          passed = false;
          break;
        }
      }
      if (!passed) continue;
      const advanced = color === 0 ? rank - 1 : 6 - rank;
      middleTerms += sign * PASSED_MIDDLE[advanced]!;
      endTerms += sign * PASSED_END[advanced]!;
    }

    // Torres en columna abierta o semiabierta.
    const ownPieces = pieceSquares[color]!;
    for (let i = 0; i < pieceTotal[color]!; i++) {
      const sq = ownPieces[i]!;
      if ((board[sq]! & 7) !== 4) continue;
      const file = sq & 7;
      if (pawnFiles[own + file] === 0) white += sign * (pawnFiles[enemy + file] === 0 ? ROOK_OPEN_FILE : ROOK_SEMI_OPEN_FILE);
    }

    // Movilidad de las piezas.
    for (let i = 0; i < pieceTotal[color]!; i++) {
      const sq = ownPieces[i]!;
      const type = board[sq]! & 7;
      const extra = mobility(type, sq, color) - MOBILITY_BASE[type]!;
      middleTerms += sign * extra * MOBILITY_MIDDLE[type]!;
      endTerms += sign * extra * MOBILITY_END[type]!;
    }

    // Seguridad del rey (solo cuenta en el medio juego).
    const ksq = kingSq[color]!;
    if (ksq < 0) continue;
    let enemyQueen = false;
    for (let i = 0; i < pieceTotal[them]!; i++) {
      if ((board[pieceSquares[them]![i]!]! & 7) === 5) enemyQueen = true;
    }
    const kingFile = ksq & 7;
    const ownPawn = 1 + (color << 3);
    let danger = 0;
    const kingRank = color === 0 ? ksq >> 4 : 7 - (ksq >> 4);
    if (enemyQueen && kingRank > 1) danger += KING_EXPOSED * (kingRank - 1);
    for (let file = Math.max(0, kingFile - 1); file <= Math.min(7, kingFile + 1); file++) {
      // Escudo: el peón propio de esa columna en la fila de delante del rey, o en la siguiente.
      const one = ksq + forward + (file - kingFile);
      const two = one + forward;
      if ((one & 0x88) === 0 && board[one] === ownPawn) {
        // bien
      } else if ((two & 0x88) === 0 && board[two] === ownPawn) danger += SHIELD_ADVANCED;
      else danger += SHIELD_MISSING;
      if (pawnFiles[own + file] === 0) danger += pawnFiles[enemy + file] === 0 ? KING_OPEN : KING_SEMI_OPEN;
    }
    // Piezas rivales que atacan la zona del rey.
    markZone(ksq, forward);
    let units = 0;
    let attackers = 0;
    const enemyPieces = pieceSquares[them]!;
    for (let i = 0; i < pieceTotal[them]!; i++) {
      const sq = enemyPieces[i]!;
      const type = board[sq]! & 7;
      const hits = zoneHits(type, sq);
      if (hits === 0) continue;
      attackers++;
      units += UNITS_BY_INDEX[type]! + Math.min(hits - 1, 2);
    }
    // Defensores: piezas propias (caballo, alfil, dama) a dos casillas o menos del rey.
    const ownList = pieceSquares[color]!;
    for (let i = 0; i < pieceTotal[color]!; i++) {
      const sq = ownList[i]!;
      const type = board[sq]! & 7;
      if (type === 4) continue;
      if (Math.abs((sq & 7) - kingFile) <= 2 && Math.abs((sq >> 4) - (ksq >> 4)) <= 2) units -= DEFENDER_UNITS;
    }
    if (units < 0) units = 0;
    if (attackers >= 2 || (enemyQueen && attackers >= 1 && kingRank > 1)) danger += ATTACK_PENALTY[Math.min(units, ATTACK_PENALTY.length - 1)]!;
    middleTerms -= sign * danger;
  }

  const phased = Math.trunc((middleTerms * middle + endTerms * (FULL_PHASE - middle)) / FULL_PHASE);
  if (bishops[0]! >= 2) white += BISHOP_PAIR;
  if (bishops[1]! >= 2) black += BISHOP_PAIR;

  const score = white - black + phased;
  return position.turn === "w" ? score : 0 - score; // «0 - x» evita devolver -0
}
