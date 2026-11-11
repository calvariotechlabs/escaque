// Tipos públicos de las lecciones guiadas. Sin DOM: la interfaz solo los pinta.
import type { Color } from "../core/index.js";

/** Casilla en notación algebraica («e4»). */
export type SquareName = string;

/** Pista. La última de cada lección marca casillas: la pieza a mover y su destino. */
export interface Hint {
  readonly text: string;
  readonly marks?: { readonly from: SquareName; readonly to: SquareName };
}

/**
 * Lo que se acepta en un paso del alumno.
 *
 * - `moves`: solo las jugadas listadas (UCI). Cada una lleva la respuesta fija
 *   del rival (UCI) si quedan pasos, o `null` en el último paso.
 * - `mate`: cualquier jugada que dé jaque mate. Solo puede ser el último paso.
 */
export type Step =
  | { readonly kind: "moves"; readonly accept: Readonly<Record<string, string | null>> }
  | { readonly kind: "mate" };

export interface Lesson {
  /** Identificador estable (clave del progreso guardado). */
  readonly id: string;
  /** Orden recomendado, desde 1. */
  readonly number: number;
  readonly title: string;
  /** Una frase para la lista de lecciones. */
  readonly summary: string;
  /** Posición de salida. */
  readonly fen: string;
  /** Bando del alumno; el tablero se orienta hacia él. */
  readonly side: Color;
  /** Objetivo en una frase imperativa («Da mate en una jugada.»). */
  readonly goal: string;
  /** De 2 a 3, de vaga a concreta. */
  readonly hints: readonly Hint[];
  /** Explicación del acierto, como mucho 2 frases. */
  readonly success: string;
  /** Motivo de fallo genérico, frase completa. */
  readonly failure: string;
  /** Motivo de fallo para jugadas típicas (UCI → frase completa). */
  readonly mistakes: Readonly<Record<string, string>>;
  /** Pasos del alumno; su número es `steps.length`. */
  readonly steps: readonly Step[];
}

/** Jugada en UCI y en SAN española («Rd7»). */
export interface PlayedMove {
  readonly uci: string;
  readonly san: string;
}

/** Resultado de comprobar una jugada del alumno. */
export type LessonCheck =
  | { readonly kind: "correcto" }
  | { readonly kind: "paso-intermedio"; readonly step: number; readonly reply: PlayedMove }
  | { readonly kind: "fallo"; readonly reason: string };
