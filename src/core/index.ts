// Punto de entrada público del núcleo de reglas.
export { FenError } from "./errors.js";
export { START_FEN, Position, moveToUci } from "./position.js";
export { createRandom } from "./random.js";
export { perft, perftDivide, formatDivide, parseDivide, compareDivide } from "./perft.js";
export type { PerftTarget, DivideEntry, DivideResult, DivideMismatch } from "./perft.js";
export type { Color, Piece, PieceType, PromotionPiece, Square, Move, GameStatus } from "./types.js";
