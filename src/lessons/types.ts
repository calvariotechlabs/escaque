// Tipos públicos de las lecciones guiadas. Sin DOM: la interfaz solo los pinta.
import type { Color, PromotionPiece } from "../core/index.js";

/** Casilla en notación algebraica («e4»). */
export type SquareName = string;

/**
 * Pista. La última de cada lección marca casillas: la pieza a mover y su
 * destino, y la pieza a la que corona si la solución es una coronación.
 */
export interface Hint {
  readonly text: string;
  readonly marks?: { readonly from: SquareName; readonly to: SquareName; readonly promotion?: PromotionPiece };
}

/** Motivos de fallo de las jugadas típicas de un paso (UCI → frase completa). */
export type Mistakes = Readonly<Record<string, string>>;

/**
 * Lo que se acepta en un paso del alumno.
 *
 * - `moves`: solo las jugadas listadas (UCI). Cada una lleva la respuesta fija
 *   del rival (UCI) si quedan pasos, o `null` en el último paso.
 * - `mate`: cualquier jugada que dé jaque mate. Solo puede ser el último paso.
 *
 * `mistakes` da un motivo propio a jugadas típicas de ese paso; el resto falla
 * con el motivo genérico de la lección.
 */
export type Step =
  | { readonly kind: "moves"; readonly accept: Readonly<Record<string, string | null>>; readonly mistakes?: Mistakes }
  | { readonly kind: "mate"; readonly mistakes?: Mistakes }
  /** Cualquier jugada que lleve una pieza a `target`. `marked`: el tablero la señala como casilla objetivo. */
  | { readonly kind: "reach"; readonly target: SquareName; readonly marked: boolean; readonly mistakes?: Mistakes }
  /** Cualquier jugada que capture una pieza. */
  | { readonly kind: "capture"; readonly mistakes?: Mistakes }
  /** Cualquier jugada que dé jaque. */
  | { readonly kind: "check"; readonly mistakes?: Mistakes };

/**
 * Pasos sin respuesta del rival: si no son el último, el rival no mueve y el
 * alumno vuelve a jugar (en `played` se anota `PASS`). Son los ejercicios de
 * «Primeros pasos», donde solo importa cómo se mueve la pieza del alumno.
 */
export type FreeStep = Extract<Step, { readonly kind: "reach" | "capture" | "check" }>;

/** Grupos de la lista de lecciones, en este orden. */
export type LessonGroup = "primeros-pasos" | "tacticas";

export interface Lesson {
  /** Identificador estable (clave del progreso guardado). */
  readonly id: string;
  readonly group: LessonGroup;
  /** Orden recomendado dentro de su grupo, desde 1. */
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
  /** Pasos del alumno; su número es `steps.length`. */
  readonly steps: readonly Step[];
  /** Tarjeta «Cómo se mueve» (lecciones de primeros pasos). */
  readonly howItMoves?: string;
  /** Casilla de la pieza cuyas jugadas enseña «Ver a dónde puede ir»; la ayuda la sigue cuando se mueve. */
  readonly helpPiece?: SquareName;
  /** Contador de capturas: qué se captura, en singular y en plural («peón negro», «peones negros»). */
  readonly counter?: { readonly one: string; readonly many: string };
}

/** Respuesta del rival en UCI y en SAN española («Rd7»). */
export interface LessonReply {
  readonly uci: string;
  readonly san: string;
}

/** Resultado de comprobar una jugada del alumno. */
export type LessonCheck =
  | { readonly kind: "correcto" }
  | { readonly kind: "paso-intermedio"; readonly step: number; readonly reply: LessonReply }
  /** Jugada buena que pide otra sin respuesta del rival: vuelve a jugar el alumno. */
  | { readonly kind: "sigue"; readonly step: number }
  | { readonly kind: "fallo"; readonly reason: string };
