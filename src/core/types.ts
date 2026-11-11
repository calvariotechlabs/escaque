// Tipos públicos del núcleo de reglas. Los usan el motor, el coach y la interfaz.

export type Color = "w" | "b";

/** Peón, caballo, alfil, torre, dama, rey (letras de FEN en minúscula). */
export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";

export type PromotionPiece = "q" | "r" | "b" | "n";

/** Casilla en la representación 0x88: índice = 16 * fila + columna (a1 = 0, h8 = 119). */
export type Square = number;

/**
 * Jugada generada por `Position.legalMoves()`.
 *
 * Es un dato opaco para quien la usa: solo debe pasarse a `makeMove` de la
 * misma posición de la que salió, y leerse con `moveToUci`. El bloque 2 puede
 * añadirle campos internos (pieza capturada, banderas de enroque o al paso…).
 */
export interface Move {
  readonly from: Square;
  readonly to: Square;
  /** Pieza a la que corona un peón; `null` si la jugada no es una coronación. */
  readonly promotion: PromotionPiece | null;
}

/**
 * Estado de la partida en la posición actual.
 *
 * - `checkmate`: el bando que mueve no tiene jugadas y está en jaque; gana `winner`.
 * - `stalemate`: el bando que mueve no tiene jugadas y no está en jaque (tablas).
 * - `insufficient-material`: ningún bando puede dar mate (ver `isInsufficientMaterial`).
 * - `fifty-move`: 100 medias jugadas seguidas sin mover un peón ni capturar.
 * - `threefold-repetition`: la misma posición (mismo bando al mover, enroques y
 *   capturas al paso posibles) ha aparecido tres veces.
 *
 * Las dos tablas son automáticas: no hace falta reclamarlas.
 */
export type GameStatus =
  | { readonly kind: "ongoing" }
  | { readonly kind: "checkmate"; readonly winner: Color }
  | { readonly kind: "stalemate" }
  | { readonly kind: "insufficient-material" }
  | { readonly kind: "fifty-move" }
  | { readonly kind: "threefold-repetition" };
