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

/** Una jugada de la lista: SAN en español y la media jugada (ply) a la que lleva. */
export interface MoveListEntry {
  readonly san: string;
  /** Número de jugadas hechas desde el principio tras esta; sirve para `goTo`. */
  readonly ply: number;
}

/** Fila de la lista de jugadas: número y jugada de cada bando (o `null`). */
export interface MoveListRow {
  readonly number: number;
  readonly white: MoveListEntry | null;
  readonly black: MoveListEntry | null;
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
  /** Jugadas deshechas que se pueden rehacer; la siguiente, al final. */
  private readonly future: MoveRecord[] = [];
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

  /** Jugadas hechas hasta la posición actual. */
  get history(): readonly MoveRecord[] {
    return this.records;
  }

  /** Medias jugadas hechas hasta la posición actual. */
  get ply(): number {
    return this.records.length;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
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
    const record = this.apply(from, to, promotion ?? null);
    // Una jugada nueva abre otra línea: lo que se podía rehacer ya no vale.
    if (record !== null) this.future.length = 0;
    return record;
  }

  /** Rehace la última jugada deshecha. Devuelve su registro, o `null` si no había. */
  redo(): MoveRecord | null {
    const next = this.future.pop();
    if (next === undefined) return null;
    return this.apply(next.from, next.to, next.promotion);
  }

  /** Va a la posición tras `ply` medias jugadas, deshaciendo o rehaciendo (se ajusta a lo que hay). */
  goTo(ply: number): void {
    while (this.records.length > ply && this.undo() !== null);
    while (this.records.length < ply && this.redo() !== null);
  }

  private apply(from: string, to: string, promotion: PromotionPiece | null): MoveRecord | null {
    if (this.isOver) return null;
    const move = this.findMove(from, to).find((m) => m.promotion === promotion);
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
    this.future.push(record);
    this.position.unmakeMove();
    this.refresh();
    return record;
  }

  /** Lista de jugadas por número, con SAN en español; incluye las que se pueden rehacer. */
  moveList(): MoveListRow[] {
    const all = [...this.records, ...[...this.future].reverse()];
    const rows: MoveListRow[] = [];
    // Media jugada 0 es la del bando que empezó; las blancas van en las pares si empezaron ellas.
    const offset = this.startTurn === "w" ? 0 : 1;
    all.forEach((record, index) => {
      const half = index + offset;
      const entry: MoveListEntry = { san: sanToSpanish(record.san), ply: index + 1 };
      const number = this.startFullmove + Math.floor(half / 2);
      if (half % 2 === 0) rows.push({ number, white: entry, black: null });
      else if (index === 0) rows.push({ number, white: null, black: entry });
      else rows[rows.length - 1] = { ...rows[rows.length - 1]!, black: entry };
    });
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
