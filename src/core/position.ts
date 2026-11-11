// Posición de ajedrez: tablero 0x88, FEN, generador de jugadas legales y
// hacer/deshacer jugada.
//
// Representación
// - Tablero 0x88: 128 casillas, índice = 16 * fila + columna. Una casilla está
//   fuera del tablero si `índice & 0x88` no es 0, lo que permite detectar los
//   bordes con una sola operación al recorrer rayos.
// - Pieza: tipo (1..6) en los 3 bits bajos y color en el bit 3 (0 = blancas,
//   8 = negras). 0 es casilla vacía.
//
// Legalidad: se generan las jugadas pseudolegales, se aplica cada una, se
// comprueba si el rey propio queda atacado y se deshace (decisión del proyecto).

import { FenError } from "./errors.js";
import type { PerftTarget } from "./perft.js";
import type { Color, GameStatus, Move, PromotionPiece, Square } from "./types.js";

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// --- Piezas ------------------------------------------------------------------

const EMPTY = 0;
const PAWN = 1;
const KNIGHT = 2;
const BISHOP = 3;
const ROOK = 4;
const QUEEN = 5;
const KING = 6;

const WHITE = 0;
const BLACK = 1;
type Side = typeof WHITE | typeof BLACK;

const COLOR_BIT = 8;
const TYPE_MASK = 7;

const makePiece = (side: Side, type: number): number => type | (side === BLACK ? COLOR_BIT : 0);
const typeOf = (piece: number): number => piece & TYPE_MASK;
const sideOf = (piece: number): Side => ((piece & COLOR_BIT) === 0 ? WHITE : BLACK);
const opposite = (side: Side): Side => (side === WHITE ? BLACK : WHITE);

const FEN_TO_TYPE: Readonly<Record<string, number>> = { p: PAWN, n: KNIGHT, b: BISHOP, r: ROOK, q: QUEEN, k: KING };
const TYPE_TO_FEN = ["", "p", "n", "b", "r", "q", "k"] as const;
const PROMOTION_TO_TYPE: Readonly<Record<PromotionPiece, number>> = { q: QUEEN, r: ROOK, b: BISHOP, n: KNIGHT };
const PROMOTIONS: readonly PromotionPiece[] = ["q", "r", "b", "n"];

// --- Casillas ----------------------------------------------------------------

const offBoard = (sq: number): boolean => (sq & 0x88) !== 0;
const fileOf = (sq: Square): number => sq & 7;
const rankOf = (sq: Square): number => sq >> 4;
const squareName = (sq: Square): string => "abcdefgh"[fileOf(sq)]! + String(rankOf(sq) + 1);

const A1 = 0, B1 = 1, C1 = 2, D1 = 3, E1 = 4, F1 = 5, G1 = 6, H1 = 7;
const A8 = 112, B8 = 113, C8 = 114, D8 = 115, E8 = 116, F8 = 117, G8 = 118, H8 = 119;

const KNIGHT_OFFSETS = [33, 31, 18, 14, -14, -18, -31, -33] as const;
const KING_OFFSETS = [1, -1, 16, -16, 15, 17, -15, -17] as const;
const BISHOP_DIRS = [15, 17, -15, -17] as const;
const ROOK_DIRS = [1, -1, 16, -16] as const;

// --- Derechos de enroque -----------------------------------------------------

const CASTLE_WK = 1;
const CASTLE_WQ = 2;
const CASTLE_BK = 4;
const CASTLE_BQ = 8;

/** Derechos que sobreviven a que una jugada salga de (o llegue a) cada casilla. */
const CASTLING_MASK = new Uint8Array(128).fill(15);
CASTLING_MASK[E1] = 15 & ~(CASTLE_WK | CASTLE_WQ);
CASTLING_MASK[H1] = 15 & ~CASTLE_WK;
CASTLING_MASK[A1] = 15 & ~CASTLE_WQ;
CASTLING_MASK[E8] = 15 & ~(CASTLE_BK | CASTLE_BQ);
CASTLING_MASK[H8] = 15 & ~CASTLE_BK;
CASTLING_MASK[A8] = 15 & ~CASTLE_BQ;

// --- Jugadas -----------------------------------------------------------------

const FLAG_NORMAL = 0;
const FLAG_DOUBLE_PUSH = 1;
const FLAG_EN_PASSANT = 2;
const FLAG_CASTLE = 3;

/** Jugada con los datos internos que necesita `makeMove`. Fuera del núcleo es un `Move` opaco. */
interface CoreMove extends Move {
  readonly flags: number;
}


/** Estado que una jugada destruye y que `unmakeMove` necesita para volver atrás. */
interface Undo {
  readonly move: CoreMove;
  readonly captured: number;
  readonly castling: number;
  readonly epSquare: number;
  readonly halfmove: number;
}

// --- SAN ---------------------------------------------------------------------

/** La SAN más larga posible es «Qa1xh8+» o «exd8=Q#»; se deja margen para «!?». */
const SAN_MAX_LENGTH = 16;

/**
 * Quita jaque, mate, anotaciones («!?») y el «e.p.» de la captura al paso, y
 * unifica el enroque con ceros y la coronación sin «=».
 */
function normalizeSan(text: string): string {
  let san = text.trim().replace(/\s*e\.p\.$/, "").replace(/[+#!?]+$/, "");
  if (san === "0-0") san = "O-O";
  else if (san === "0-0-0") san = "O-O-O";
  return san.replace(/^([a-h](?:x[a-h])?[18])([QRBN])$/, "$1=$2");
}

/** Jugada de pieza con origen opcional, para aceptar desambiguación de más: «Ngf3», «N1f3», «Ng1f3». */
const SAN_PIECE = /^([NBRQK])([a-h])?([1-8])?(x)?([a-h][1-8])$/;

/** ¿Son la misma jugada? Origen, destino y coronación la determinan en una posición dada. */
const sameMove = (a: Move, b: Move): boolean => a.from === b.from && a.to === b.to && a.promotion === b.promotion;

// --- FEN ---------------------------------------------------------------------

const CLOCK = /^\d+$/;

function parseClock(text: string, label: string, min: number): number {
  if (!CLOCK.test(text)) throw new FenError(`${label} no válido: «${text}»`);
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < min) throw new FenError(`${label} no válido: «${text}»`);
  return value;
}

export class Position implements PerftTarget<Move> {
  private readonly board = new Uint8Array(128);
  private side: Side = WHITE;
  private castling = 0;
  /** Casilla de captura al paso, o -1. */
  private epSquare = -1;
  private halfmove = 0;
  private fullmove = 1;
  private readonly kings: [number, number] = [-1, -1];
  private readonly history: Undo[] = [];
  /**
   * Listas devueltas por `legalMoves()`, indexadas por ply (longitud de `history`).
   * `makeMove` solo acepta jugadas de la lista del ply actual (por identidad):
   * así una jugada de otra posición, antigua o construida a mano no puede
   * corromper el tablero. La lista de un ply sigue valiendo al volver a él con
   * `unmakeMove` o al rehacer la misma jugada, y se descarta cuando se llega a
   * ese ply con otra jugada. Las jugadas internas (legalidad, jaque, SAN,
   * repetición) no la tocan.
   */
  private readonly generated: Move[][] = [];
  /**
   * Línea de jugadas hechas con `makeMove`, incluidas las deshechas con
   * `unmakeMove`. `history` es siempre un prefijo de ella, y `generated[ply]`
   * solo existe para posiciones de esta línea.
   */
  private readonly line: Move[] = [];

  private constructor() {}

  /**
   * Carga una posición en notación FEN.
   * Acepta FEN de 6 campos y también de 4 (sin relojes: se toman «0 1»).
   * Lanza `FenError` si la FEN está mal formada.
   */
  static fromFen(fen: string): Position {
    const fields = fen.trim().split(/\s+/);
    if (fields.length !== 4 && fields.length !== 6) {
      throw new FenError(`La FEN debe tener 4 o 6 campos y tiene ${fields[0] === "" ? 0 : fields.length}`);
    }
    const [placement, turn, castling, ep, half = "0", full = "1"] = fields as [string, string, string, string, string?, string?];
    const p = new Position();

    // 1. Piezas, de la fila 8 a la 1.
    const rows = placement.split("/");
    if (rows.length !== 8) throw new FenError(`La FEN debe tener 8 filas y tiene ${rows.length}`);
    const kingCount = [0, 0];
    for (let i = 0; i < 8; i++) {
      const rank = 7 - i;
      let file = 0;
      for (const ch of rows[i]!) {
        if (ch >= "1" && ch <= "8") {
          file += Number(ch);
        } else {
          // Solo letras ASCII: toLowerCase() convertiría el signo Kelvin (U+212A) en «k».
          const type = /^[pnbrqkPNBRQK]$/.test(ch) ? FEN_TO_TYPE[ch.toLowerCase()] : undefined;
          if (type === undefined) throw new FenError(`Pieza desconocida en la FEN: «${ch}»`);
          if (file > 7) throw new FenError(`La fila ${rank + 1} tiene más de 8 casillas`);
          const side: Side = ch === ch.toLowerCase() ? BLACK : WHITE;
          if (type === PAWN && (rank === 0 || rank === 7)) {
            throw new FenError(`Peón en la fila ${rank + 1}`);
          }
          const sq = rank * 16 + file;
          p.board[sq] = makePiece(side, type);
          if (type === KING) {
            kingCount[side]!++;
            p.kings[side] = sq;
          }
          file++;
        }
        if (file > 8) throw new FenError(`La fila ${rank + 1} tiene más de 8 casillas`);
      }
      if (file !== 8) throw new FenError(`La fila ${rank + 1} tiene ${file} casillas`);
    }
    if (kingCount[WHITE] !== 1 || kingCount[BLACK] !== 1) {
      throw new FenError("Cada bando debe tener exactamente un rey");
    }

    // 2. Turno.
    if (turn !== "w" && turn !== "b") throw new FenError(`Turno no válido: «${turn}»`);
    p.side = turn === "w" ? WHITE : BLACK;

    // 3. Derechos de enroque.
    if (castling !== "-") {
      if (!/^[KQkq]{1,4}$/.test(castling)) throw new FenError(`Derechos de enroque no válidos: «${castling}»`);
      for (const ch of castling) {
        const bit = ch === "K" ? CASTLE_WK : ch === "Q" ? CASTLE_WQ : ch === "k" ? CASTLE_BK : CASTLE_BQ;
        if ((p.castling & bit) !== 0) throw new FenError(`Derecho de enroque repetido: «${castling}»`);
        p.castling |= bit;
      }
      // Un derecho solo es posible con el rey y esa torre en sus casillas de salida.
      const required: Array<[number, number, number, Side]> = [
        [CASTLE_WK, E1, H1, WHITE],
        [CASTLE_WQ, E1, A1, WHITE],
        [CASTLE_BK, E8, H8, BLACK],
        [CASTLE_BQ, E8, A8, BLACK],
      ];
      for (const [bit, king, rook, side] of required) {
        if ((p.castling & bit) === 0) continue;
        if (p.board[king] !== makePiece(side, KING) || p.board[rook] !== makePiece(side, ROOK)) {
          throw new FenError(`Derecho de enroque «${castling}» sin el rey y la torre en su sitio`);
        }
      }
    }

    // 4. Casilla al paso: fila 6 si mueven blancas, fila 3 si mueven negras.
    if (ep !== "-") {
      const match = /^([a-h])([36])$/.exec(ep);
      const expectedRank = p.side === WHITE ? "6" : "3";
      if (match === null || match[2] !== expectedRank) throw new FenError(`Casilla al paso no válida: «${ep}»`);
      const sq = (Number(match[2]) - 1) * 16 + "abcdefgh".indexOf(match[1]!);
      // Tras un avance doble, el peón rival está delante de la casilla al paso
      // y tanto esa casilla como la de salida del peón están vacías. Sin esto,
      // el generador podría «capturar al paso» una casilla vacía.
      const mover = opposite(p.side);
      const pawnDir = p.side === WHITE ? -16 : 16;
      if (
        p.board[sq] !== EMPTY ||
        p.board[sq - pawnDir] !== EMPTY ||
        p.board[sq + pawnDir] !== makePiece(mover, PAWN)
      ) {
        throw new FenError(`Casilla al paso «${ep}» sin un peón que acabe de avanzar dos casillas`);
      }
      p.epSquare = sq;
    }

    // 5 y 6. Relojes.
    p.halfmove = parseClock(half, "Reloj de 50 jugadas", 0);
    p.fullmove = parseClock(full, "Número de jugada", 1);

    // El bando que no mueve no puede estar en jaque: su rey ya habría sido capturado.
    const other = opposite(p.side);
    if (p.isAttacked(p.kings[other], p.side)) {
      throw new FenError("El bando que no mueve está en jaque");
    }
    return p;
  }

  /**
   * FEN de 6 campos de la posición actual. La casilla al paso se escribe
   * siempre tras un avance doble de peón, haya o no captura posible (como
   * en la especificación de FEN), y «-» en el resto de casos.
   */
  toFen(): string {
    const rows: string[] = [];
    for (let rank = 7; rank >= 0; rank--) {
      let row = "";
      let empty = 0;
      for (let file = 0; file < 8; file++) {
        const piece = this.board[rank * 16 + file]!;
        if (piece === EMPTY) {
          empty++;
          continue;
        }
        if (empty > 0) row += String(empty);
        empty = 0;
        const letter = TYPE_TO_FEN[typeOf(piece)]!;
        row += sideOf(piece) === WHITE ? letter.toUpperCase() : letter;
      }
      if (empty > 0) row += String(empty);
      rows.push(row);
    }
    let castling = "";
    if (this.castling & CASTLE_WK) castling += "K";
    if (this.castling & CASTLE_WQ) castling += "Q";
    if (this.castling & CASTLE_BK) castling += "k";
    if (this.castling & CASTLE_BQ) castling += "q";
    return [
      rows.join("/"),
      this.side === WHITE ? "w" : "b",
      castling === "" ? "-" : castling,
      this.epSquare === -1 ? "-" : squareName(this.epSquare),
      String(this.halfmove),
      String(this.fullmove),
    ].join(" ");
  }

  /** Bando al que le toca mover. */
  get turn(): Color {
    return this.side === WHITE ? "w" : "b";
  }

  /** Todas las jugadas legales del bando que mueve (incluye enroques, al paso y las 4 coronaciones). */
  legalMoves(): Move[] {
    const legal = this.computeLegalMoves();
    this.generated[this.history.length] = legal;
    return legal.slice();
  }

  /**
   * Jugada en notación algebraica estándar (SAN), con las letras inglesas de
   * PGN: «e4», «Nbd2», «exd6», «O-O», «e8=Q+», «Qxf7#». La jugada debe ser
   * legal en esta posición; si no, lanza un error. No cambia la posición ni
   * invalida las jugadas de `legalMoves()` de la posición actual.
   */
  moveToSan(move: Move): string {
    // Reutiliza la lista del ply actual si existe: formatear todas las jugadas no la regenera.
    const legal = (this.generated[this.history.length] as CoreMove[] | undefined) ?? this.computeLegalMoves();
    const own = legal.find((m) => m.from === move.from && m.to === move.to && m.promotion === move.promotion);
    if (own === undefined) throw new Error(`moveToSan: ${moveToUci(move)} no es legal en esta posición`);
    return this.san(own, legal, true);
  }

  /**
   * Busca entre las jugadas legales la que corresponde a una jugada en SAN.
   * Tolera el jaque o el mate de más o de menos, anotaciones como «!?», «0-0»
   * con ceros y la coronación sin «=» («e8Q»). Devuelve `null` si la jugada no
   * es legal, es ambigua o no es SAN.
   */
  moveFromSan(text: string): Move | null {
    if (typeof text !== "string" || text.length > SAN_MAX_LENGTH) return null;
    const wanted = normalizeSan(text);
    if (wanted === "") return null;
    const legal = this.currentMoves();
    for (const move of legal) {
      if (this.san(move, legal, false) === wanted) return move;
    }
    // Desambiguación de más: vale si deja una única jugada legal.
    const match = SAN_PIECE.exec(wanted);
    if (match === null) return null;
    const [, letter, file, rank, capture, target] = match as unknown as [
      string,
      string,
      string | undefined,
      string | undefined,
      string | undefined,
      string,
    ];
    const type = FEN_TO_TYPE[letter.toLowerCase()];
    const candidates = legal.filter((m) => {
      const from = squareName(m.from);
      return (
        m.flags !== FLAG_CASTLE &&
        squareName(m.to) === target &&
        typeOf(this.board[m.from]!) === type &&
        // Una pieza (no un peón) solo captura lo que hay en el destino: con «x» debe haber algo, y sin «x», nada.
        (this.board[m.to] !== EMPTY) === (capture !== undefined) &&
        (file === undefined || from[0] === file) &&
        (rank === undefined || from[1] === rank)
      );
    });
    return candidates.length === 1 ? candidates[0]! : null;
  }

  /**
   * Lista del ply actual: la ya entregada por `legalMoves()` si existe, o una
   * nueva que se guarda. Así buscar una jugada no invalida las que ya tiene el
   * llamador, y la jugada encontrada vale para `makeMove`.
   */
  private currentMoves(): CoreMove[] {
    const ply = this.history.length;
    const existing = this.generated[ply];
    if (existing !== undefined) return existing as CoreMove[];
    const legal = this.computeLegalMoves();
    this.generated[ply] = legal;
    return legal;
  }

  /** Jugadas legales sin guardarlas en `generated`. */
  private computeLegalMoves(): CoreMove[] {
    const us = this.side;
    const them = opposite(us);
    const legal: CoreMove[] = [];
    // Misma comprobación que isLegal(), escrita en línea: es el bucle caliente de perft.
    for (const move of this.pseudoLegalMoves()) {
      this.applyMove(move);
      if (!this.isAttacked(this.kings[us], them)) legal.push(move);
      this.unmakeMove();
    }
    return legal;
  }

  /**
   * Busca entre las jugadas legales la que corresponde a una jugada UCI
   * («e2e4», «e7e8q», «e1g1»). Devuelve `null` si no es legal aquí.
   */
  moveFromUci(uci: string): Move | null {
    for (const move of this.currentMoves()) {
      if (moveToUci(move) === uci) return move;
    }
    return null;
  }

  /** Aplica una jugada obtenida de `legalMoves()` de esta misma posición. */
  makeMove(move: Move): void {
    // Solo jugadas (por identidad) de la última lista de legalMoves() de esta posición.
    const legal = this.generated[this.history.length];
    if (legal === undefined || !legal.includes(move)) {
      throw new Error(`makeMove: ${moveToUci(move)} no procede de legalMoves() de esta posición`);
    }
    const ply = this.history.length;
    const next = this.line[ply];
    if (next === undefined || !sameMove(next, move)) {
      // Otra línea: las listas de los plies siguientes eran de posiciones que ya no se alcanzan.
      this.line.length = ply;
      this.line.push(move);
      if (this.generated.length > ply + 1) this.generated.length = ply + 1;
    }
    this.applyMove(move as CoreMove);
  }

  /** Deshace la última jugada aplicada y deja la posición exactamente como estaba. */
  unmakeMove(): void {
    const undo = this.history.pop();
    if (undo === undefined) throw new Error("unmakeMove: no hay jugadas que deshacer");
    const { move, captured } = undo;
    const board = this.board;

    this.side = opposite(this.side);
    const us = this.side;
    if (us === BLACK) this.fullmove--;
    this.castling = undo.castling;
    this.epSquare = undo.epSquare;
    this.halfmove = undo.halfmove;

    const moved = move.promotion !== null ? makePiece(us, PAWN) : board[move.to]!;
    board[move.from] = moved;
    if (typeOf(moved) === KING) this.kings[us] = move.from;

    if (move.flags === FLAG_EN_PASSANT) {
      board[move.to] = EMPTY;
      board[move.to + (us === WHITE ? -16 : 16)] = captured;
    } else {
      board[move.to] = captured;
      if (move.flags === FLAG_CASTLE) {
        if (move.to > move.from) {
          board[move.from + 3] = board[move.from + 1]!;
          board[move.from + 1] = EMPTY;
        } else {
          board[move.from - 4] = board[move.from - 1]!;
          board[move.from - 1] = EMPTY;
        }
      }
    }
  }

  /** ¿Está en jaque el rey del bando que mueve? */
  isCheck(): boolean {
    return this.isAttacked(this.kings[this.side], opposite(this.side));
  }

  /**
   * Material insuficiente: ningún bando puede dar mate con ninguna serie de
   * jugadas legales. Casos: rey contra rey; rey y alfil contra rey; rey y
   * caballo contra rey; y reyes con cualquier número de alfiles, todos en
   * casillas del mismo color. Cualquier peón, torre o dama lo descarta, y
   * también rey y alfil contra rey y caballo, o dos caballos (hay mates posibles).
   */
  isInsufficientMaterial(): boolean {
    let knights = 0;
    let bishops = 0;
    // Bit 0: hay alfiles en casillas oscuras; bit 1: en casillas claras.
    let bishopColors = 0;
    for (let sq = 0; sq < 128; sq++) {
      if (offBoard(sq)) continue;
      const piece = this.board[sq]!;
      switch (typeOf(piece)) {
        case EMPTY:
        case KING:
          break;
        case KNIGHT:
          knights++;
          break;
        case BISHOP:
          bishops++;
          bishopColors |= (fileOf(sq) + rankOf(sq)) % 2 === 0 ? 1 : 2;
          break;
        default:
          return false; // peón, torre o dama
      }
    }
    if (knights + bishops <= 1) return true;
    return knights === 0 && bishopColors !== 3;
  }

  /**
   * Estado de la partida. El orden importa: si la jugada que llega a 100
   * medias jugadas sin peón ni captura da mate o ahoga, manda el mate o el
   * ahogado (artículo 9.3 de las Leyes del Ajedrez de la FIDE).
   *
   * La regla de 50 jugadas y la triple repetición se aplican como tablas
   * automáticas, sin que nadie tenga que reclamarlas. La repetición solo mira
   * las jugadas hechas en este objeto: lo anterior a la FEN cargada no se conoce.
   *
   * No llama a `legalMoves()`: las jugadas obtenidas antes siguen valiendo
   * para `makeMove`, y `status()` no prepara ninguna lista nueva.
   */
  status(): GameStatus {
    if (!this.hasLegalMove()) {
      if (this.isCheck()) return { kind: "checkmate", winner: this.side === WHITE ? "b" : "w" };
      return { kind: "stalemate" };
    }
    if (this.isInsufficientMaterial()) return { kind: "insufficient-material" };
    // Antes que la repetición: así esta nunca recorre más de 99 medias jugadas.
    if (this.halfmove >= 100) return { kind: "fifty-move" };
    if (this.isThreefoldRepetition()) return { kind: "threefold-repetition" };
    return { kind: "ongoing" };
  }

  // --- Interno ---------------------------------------------------------------

  /**
   * ¿Ha aparecido la posición actual al menos tres veces en esta partida?
   *
   * Dos posiciones son la misma si tienen las mismas piezas en las mismas
   * casillas, el mismo bando al mover, los mismos derechos de enroque y las
   * mismas capturas al paso posibles (una casilla al paso sin captura legal no
   * cuenta). Solo se mira hacia atrás hasta la última jugada de peón o captura,
   * porque ninguna posición anterior puede repetirse.
   *
   * Recorre la historia deshaciendo jugadas y la vuelve a aplicar: la posición
   * queda igual que estaba. El motor usará más adelante claves Zobrist.
   */
  private isThreefoldRepetition(): boolean {
    const plies = Math.min(this.halfmove, this.history.length);
    // Con menos de 4 medias jugadas reversibles no cabe ninguna repetición.
    if (plies < 4) return false;
    const current = this.repetitionKey();
    // Se rehacen las mismas jugadas con applyMove, que no toca las listas de legalMoves().
    const undone: CoreMove[] = [];
    let seen = 1;
    try {
      for (let i = 0; i < plies && seen < 3; i++) {
        undone.push(this.history[this.history.length - 1]!.move);
        this.unmakeMove();
        // Solo las posiciones con el mismo bando al mover pueden coincidir.
        if (i % 2 === 1 && this.repetitionKey() === current) seen++;
      }
    } finally {
      for (let i = undone.length - 1; i >= 0; i--) this.applyMove(undone[i]!);
    }
    return seen >= 3;
  }

  /** ¿Tiene el bando que mueve alguna jugada legal? No toca las listas de `legalMoves()`. */
  private hasLegalMove(): boolean {
    for (const move of this.pseudoLegalMoves()) {
      if (this.isLegal(move)) return true;
    }
    return false;
  }

  /** ¿Deja la jugada pseudolegal al rey propio fuera de jaque? */
  private isLegal(move: CoreMove): boolean {
    const us = this.side;
    this.applyMove(move);
    const legal = !this.isAttacked(this.kings[us], opposite(us));
    this.unmakeMove();
    return legal;
  }

  /**
   * Identidad de la posición para la triple repetición: los cuatro primeros
   * campos de la FEN, con la casilla al paso solo si hay una captura al paso legal.
   */
  private repetitionKey(): string {
    const fields = this.toFen().split(" ", 4);
    if (this.epSquare !== -1 && !this.hasLegalEnPassant()) fields[3] = "-";
    return fields.join(" ");
  }

  /** ¿Puede el bando que mueve capturar al paso legalmente? Solo mira los dos peones posibles. */
  private hasLegalEnPassant(): boolean {
    const to = this.epSquare;
    if (to === -1) return false;
    const pawn = makePiece(this.side, PAWN);
    const behind = this.side === WHITE ? -16 : 16;
    for (const from of [to + behind - 1, to + behind + 1]) {
      if (offBoard(from) || this.board[from] !== pawn) continue;
      if (this.isLegal({ from, to, promotion: null, flags: FLAG_EN_PASSANT })) return true;
    }
    return false;
  }

  /**
   * SAN de una jugada legal. `legal` son todas las jugadas legales de la
   * posición, para saber si otra pieza igual llega a la misma casilla.
   * Con `suffix`, añade «+» o «#» aplicando y deshaciendo la jugada.
   */
  private san(move: CoreMove, legal: readonly CoreMove[], suffix: boolean): string {
    const { from, to } = move;
    const type = typeOf(this.board[from]!);
    let text: string;
    if (move.flags === FLAG_CASTLE) {
      text = to > from ? "O-O" : "O-O-O";
    } else {
      const capture = this.board[to] !== EMPTY || move.flags === FLAG_EN_PASSANT;
      const target = squareName(to);
      if (type === PAWN) {
        text = (capture ? "abcdefgh"[fileOf(from)]! + "x" : "") + target;
        if (move.promotion !== null) text += "=" + move.promotion.toUpperCase();
      } else {
        text = TYPE_TO_FEN[type]!.toUpperCase();
        // Otras piezas del mismo tipo que también pueden llegar a `to`.
        const rivals = legal.filter((m) => m.to === to && m.from !== from && typeOf(this.board[m.from]!) === type);
        if (rivals.length > 0) {
          const name = squareName(from);
          const fileName = name[0]!;
          const rankName = name[1]!;
          if (!rivals.some((m) => fileOf(m.from) === fileOf(from))) text += fileName;
          else if (!rivals.some((m) => rankOf(m.from) === rankOf(from))) text += rankName;
          else text += fileName + rankName;
        }
        text += (capture ? "x" : "") + target;
      }
    }
    if (suffix) {
      this.applyMove(move);
      if (this.isCheck()) text += this.hasLegalMove() ? "+" : "#";
      this.unmakeMove();
    }
    return text;
  }

  /** ¿Ataca algún pieza del bando `by` la casilla `sq`? */
  private isAttacked(sq: number, by: Side): boolean {
    const board = this.board;

    // Peones: un peón blanco ataca desde abajo (sq - 15, sq - 17); uno negro, desde arriba.
    const pawn = makePiece(by, PAWN);
    const pawnFrom = by === WHITE ? -16 : 16;
    const left = sq + pawnFrom - 1;
    const right = sq + pawnFrom + 1;
    if (!offBoard(left) && board[left] === pawn) return true;
    if (!offBoard(right) && board[right] === pawn) return true;

    const knight = makePiece(by, KNIGHT);
    for (const offset of KNIGHT_OFFSETS) {
      const from = sq + offset;
      if (!offBoard(from) && board[from] === knight) return true;
    }

    const king = makePiece(by, KING);
    for (const offset of KING_OFFSETS) {
      const from = sq + offset;
      if (!offBoard(from) && board[from] === king) return true;
    }

    const bishop = makePiece(by, BISHOP);
    const rook = makePiece(by, ROOK);
    const queen = makePiece(by, QUEEN);
    for (const dir of BISHOP_DIRS) {
      for (let from = sq + dir; !offBoard(from); from += dir) {
        const piece = board[from]!;
        if (piece === EMPTY) continue;
        if (piece === bishop || piece === queen) return true;
        break;
      }
    }
    for (const dir of ROOK_DIRS) {
      for (let from = sq + dir; !offBoard(from); from += dir) {
        const piece = board[from]!;
        if (piece === EMPTY) continue;
        if (piece === rook || piece === queen) return true;
        break;
      }
    }
    return false;
  }

  /** Jugadas que respetan el movimiento de cada pieza, sin mirar si dejan al rey en jaque. */
  private pseudoLegalMoves(): CoreMove[] {
    const board = this.board;
    const us = this.side;
    const them = opposite(us);
    const moves: CoreMove[] = [];
    const add = (from: number, to: number, flags: number): void => {
      moves.push({ from, to, promotion: null, flags });
    };
    const addPawn = (from: number, to: number, flags: number): void => {
      const lastRank = us === WHITE ? 7 : 0;
      if (rankOf(to) === lastRank) {
        for (const promotion of PROMOTIONS) moves.push({ from, to, promotion, flags });
      } else {
        add(from, to, flags);
      }
    };

    for (let from = 0; from < 128; from++) {
      if (offBoard(from)) {
        from += 7; // salta la mitad derecha de la fila (casillas fantasma)
        continue;
      }
      const piece = board[from]!;
      if (piece === EMPTY || sideOf(piece) !== us) continue;

      switch (typeOf(piece)) {
        case PAWN: {
          const forward = us === WHITE ? 16 : -16;
          const startRank = us === WHITE ? 1 : 6;
          const one = from + forward;
          if (!offBoard(one) && board[one] === EMPTY) {
            addPawn(from, one, FLAG_NORMAL);
            const two = one + forward;
            if (rankOf(from) === startRank && board[two] === EMPTY) add(from, two, FLAG_DOUBLE_PUSH);
          }
          for (let side = -1; side <= 1; side += 2) {
            const to = one + side;
            if (offBoard(to)) continue;
            const target = board[to]!;
            if (target !== EMPTY && sideOf(target) === them) addPawn(from, to, FLAG_NORMAL);
            else if (to === this.epSquare) add(from, to, FLAG_EN_PASSANT);
          }
          break;
        }
        case KNIGHT:
          this.addSteps(from, KNIGHT_OFFSETS, add);
          break;
        case KING:
          this.addSteps(from, KING_OFFSETS, add);
          break;
        case BISHOP:
          this.addSlides(from, BISHOP_DIRS, add);
          break;
        case ROOK:
          this.addSlides(from, ROOK_DIRS, add);
          break;
        case QUEEN:
          this.addSlides(from, BISHOP_DIRS, add);
          this.addSlides(from, ROOK_DIRS, add);
          break;
      }
    }

    this.addCastling(add);
    return moves;
  }

  private addSteps(from: number, offsets: readonly number[], add: (from: number, to: number, flags: number) => void): void {
    for (const offset of offsets) {
      const to = from + offset;
      if (offBoard(to)) continue;
      const target = this.board[to]!;
      if (target === EMPTY || sideOf(target) !== this.side) add(from, to, FLAG_NORMAL);
    }
  }

  private addSlides(from: number, dirs: readonly number[], add: (from: number, to: number, flags: number) => void): void {
    for (const dir of dirs) {
      for (let to = from + dir; !offBoard(to); to += dir) {
        const target = this.board[to]!;
        if (target === EMPTY) {
          add(from, to, FLAG_NORMAL);
          continue;
        }
        if (sideOf(target) !== this.side) add(from, to, FLAG_NORMAL);
        break;
      }
    }
  }

  /**
   * Enroques: el derecho existe, rey y torre están en su casilla, las casillas
   * entre ambos están vacías y el rey no está en jaque ni pasa por una casilla
   * atacada. Que acabe en una casilla atacada lo descarta la comprobación de
   * legalidad general, pero se mira aquí también por claridad.
   */
  private addCastling(add: (from: number, to: number, flags: number) => void): void {
    const us = this.side;
    const them = opposite(us);
    const rights = us === WHITE ? this.castling & (CASTLE_WK | CASTLE_WQ) : this.castling & (CASTLE_BK | CASTLE_BQ);
    if (rights === 0) return;

    const board = this.board;
    const [e, f, g, d, c, b, h, a] = us === WHITE ? [E1, F1, G1, D1, C1, B1, H1, A1] : [E8, F8, G8, D8, C8, B8, H8, A8];
    const rook = makePiece(us, ROOK);
    if (board[e] !== makePiece(us, KING) || this.isAttacked(e, them)) return;

    const kingSide = us === WHITE ? CASTLE_WK : CASTLE_BK;
    if (
      (rights & kingSide) !== 0 &&
      board[h] === rook &&
      board[f] === EMPTY &&
      board[g] === EMPTY &&
      !this.isAttacked(f, them) &&
      !this.isAttacked(g, them)
    ) {
      add(e, g, FLAG_CASTLE);
    }

    const queenSide = us === WHITE ? CASTLE_WQ : CASTLE_BQ;
    if (
      (rights & queenSide) !== 0 &&
      board[a] === rook &&
      board[d] === EMPTY &&
      board[c] === EMPTY &&
      board[b] === EMPTY &&
      !this.isAttacked(d, them) &&
      !this.isAttacked(c, them)
    ) {
      add(e, c, FLAG_CASTLE);
    }
  }

  /**
   * Aplica una jugada pseudolegal y guarda lo necesario para deshacerla. No
   * toca `generated` ni `line`: quien la use para mirar debe deshacerla.
   */
  private applyMove(move: CoreMove): void {
    const board = this.board;
    const us = this.side;
    const { from, to, flags } = move;
    const piece = board[from]!;

    let captured: number;
    if (flags === FLAG_EN_PASSANT) {
      const capturedSq = to + (us === WHITE ? -16 : 16);
      captured = board[capturedSq]!;
      board[capturedSq] = EMPTY;
    } else {
      captured = board[to]!;
    }

    this.history.push({ move, captured, castling: this.castling, epSquare: this.epSquare, halfmove: this.halfmove });

    board[to] = move.promotion !== null ? makePiece(us, PROMOTION_TO_TYPE[move.promotion]) : piece;
    board[from] = EMPTY;
    if (typeOf(piece) === KING) this.kings[us] = to;

    if (flags === FLAG_CASTLE) {
      if (to > from) {
        board[from + 1] = board[from + 3]!;
        board[from + 3] = EMPTY;
      } else {
        board[from - 1] = board[from - 4]!;
        board[from - 4] = EMPTY;
      }
    }

    this.castling &= CASTLING_MASK[from]! & CASTLING_MASK[to]!;
    this.epSquare = flags === FLAG_DOUBLE_PUSH ? (from + to) >> 1 : -1;
    this.halfmove = typeOf(piece) === PAWN || captured !== EMPTY ? 0 : this.halfmove + 1;
    if (us === BLACK) this.fullmove++;
    this.side = opposite(us);
  }
}

/** Jugada en notación UCI: casilla de origen, destino y pieza de coronación («e2e4», «e7e8q», «e1g1»). */
export function moveToUci(move: Move): string {
  return squareName(move.from) + squareName(move.to) + (move.promotion ?? "");
}
