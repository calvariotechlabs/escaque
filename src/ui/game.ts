// Controlador de partida para la interfaz: envuelve `Position` del núcleo y
// habla en casillas algebraicas («e4»), que es lo que maneja el tablero.
// Sin DOM: se prueba en Node.
import { Position, START_FEN } from "../core/index.js";
import type { Color, GameStatus, Move, PieceType, PromotionPiece, Square } from "../core/index.js";
import { sanToSpanish, type Piece, type PlayedMove } from "./notation.js";

/** Jugada hecha en la partida, con lo necesario para anunciarla y listarla. */
export interface MoveRecord extends PlayedMove {
  /** FEN de la posición después de la jugada. */
  readonly fenAfter: string;
}

/** Fila de la lista de jugadas: número y SAN en español de cada bando (o `null`). */
export interface MoveListRow {
  readonly number: number;
  readonly white: string | null;
  readonly black: string | null;
}

const FILES = "abcdefgh";
const SQUARE_NAME = /^[a-h][1-8]$/;

/** «e4» → índice 0x88, o -1 si no es una casilla. */
function toSquare(name: string): Square {
  if (typeof name !== "string" || !SQUARE_NAME.test(name)) return -1;
  return (name.charCodeAt(1) - 49) * 16 + FILES.indexOf(name[0]!);
}

function squareName(square: Square): string {
  return `${FILES[square & 7]!}${(square >> 4) + 1}`;
}

/** Piezas por casilla a partir del primer campo de la FEN. */
function parsePlacement(fen: string): Map<string, Piece> {
  const pieces = new Map<string, Piece>();
  const ranks = fen.split(" ")[0]!.split("/");
  ranks.forEach((row, index) => {
    const rank = 8 - index;
    let file = 0;
    for (const char of row) {
      if (char >= "1" && char <= "8") {
        file += Number(char);
        continue;
      }
      const lower = char.toLowerCase();
      pieces.set(`${FILES[file]!}${rank}`, { color: char === lower ? "b" : "w", type: lower as PieceType });
      file++;
    }
  });
  return pieces;
}

export class Game {
  private readonly position: Position;
  private readonly startFullmove: number;
  private readonly startTurn: Color;
  private readonly records: MoveRecord[] = [];
  private pieces: Map<string, Piece>;
  private legal: Move[];
  private currentStatus: GameStatus;
  private currentFen: string;

  /** Lanza `FenError` si la FEN no es válida. */
  constructor(fen: string = START_FEN) {
    this.position = Position.fromFen(fen);
    this.currentFen = this.position.toFen();
    this.startTurn = this.position.turn;
    this.startFullmove = Number(this.currentFen.split(" ")[5]);
    this.pieces = parsePlacement(this.currentFen);
    this.legal = this.position.legalMoves();
    this.currentStatus = this.position.status();
  }

  get fen(): string {
    return this.currentFen;
  }

  get turn(): Color {
    return this.position.turn;
  }

  get status(): GameStatus {
    return this.currentStatus;
  }

  get isOver(): boolean {
    return this.currentStatus.kind !== "ongoing";
  }

  get inCheck(): boolean {
    return this.position.isCheck();
  }

  /** Casilla del rey en jaque del bando que mueve, o `null`. */
  get checkSquare(): string | null {
    if (!this.inCheck) return null;
    for (const [square, piece] of this.pieces) {
      if (piece.type === "k" && piece.color === this.turn) return square;
    }
    return null;
  }

  get history(): readonly MoveRecord[] {
    return this.records;
  }

  get lastMove(): { readonly from: string; readonly to: string } | null {
    const last = this.records[this.records.length - 1];
    return last === undefined ? null : { from: last.from, to: last.to };
  }

  pieceAt(square: string): Piece | null {
    return this.pieces.get(square) ?? null;
  }

  /** Casillas a las que puede ir la pieza de `from`, ordenadas; vacío si no le toca o la partida ha terminado. */
  targets(from: string): string[] {
    if (this.isOver) return [];
    const origin = toSquare(from);
    const found = new Set<string>();
    for (const move of this.legal) {
      if (move.from === origin) found.add(squareName(move.to));
    }
    return [...found].sort();
  }

  /** ¿Es `from`→`to` una coronación legal? Entonces `play` necesita la pieza. */
  isPromotion(from: string, to: string): boolean {
    return this.findMove(from, to).some((move) => move.promotion !== null);
  }

  /**
   * Juega de `from` a `to`. En una coronación hay que pasar la pieza; en otra
   * jugada, no. Devuelve el registro, o `null` si la jugada no es legal (y
   * entonces no cambia nada).
   */
  play(from: string, to: string, promotion?: PromotionPiece): MoveRecord | null {
    if (this.isOver) return null;
    const move = this.findMove(from, to).find((m) => m.promotion === (promotion ?? null));
    if (move === undefined) return null;

    const piece = this.pieces.get(from)!;
    const target = this.pieces.get(to);
    // Un peón que cambia de columna sin pieza en el destino captura al paso.
    const captured = target !== undefined ? target.type : piece.type === "p" && from[0] !== to[0] ? "p" : null;
    const san = this.position.moveToSan(move);
    this.position.makeMove(move);
    this.refresh();

    const record: MoveRecord = {
      color: piece.color,
      san,
      from,
      to,
      piece: piece.type,
      captured,
      promotion: move.promotion,
      fenAfter: this.currentFen,
    };
    this.records.push(record);
    return record;
  }

  /** Deshace la última jugada. Devuelve su registro, o `null` si no había. */
  undo(): MoveRecord | null {
    const record = this.records.pop();
    if (record === undefined) return null;
    this.position.unmakeMove();
    this.refresh();
    return record;
  }

  /** Lista de jugadas por número, con SAN en español. */
  moveList(): MoveListRow[] {
    const rows: MoveListRow[] = [];
    let number = this.startFullmove;
    let white: string | null = null;
    let index = 0;
    if (this.startTurn === "b" && this.records.length > 0) {
      rows.push({ number: number++, white: null, black: sanToSpanish(this.records[0]!.san) });
      index = 1;
    }
    for (; index < this.records.length; index++) {
      const san = sanToSpanish(this.records[index]!.san);
      if (white === null) {
        white = san;
      } else {
        rows.push({ number: number++, white, black: san });
        white = null;
      }
    }
    if (white !== null) rows.push({ number, white, black: null });
    return rows;
  }

  private findMove(from: string, to: string): Move[] {
    const origin = toSquare(from);
    const destination = toSquare(to);
    if (origin < 0 || destination < 0) return [];
    return this.legal.filter((move) => move.from === origin && move.to === destination);
  }

  private refresh(): void {
    this.currentFen = this.position.toFen();
    this.pieces = parsePlacement(this.currentFen);
    this.legal = this.position.legalMoves();
    this.currentStatus = this.position.status();
  }
}
