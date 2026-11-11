// Textos en español del coach. Sin DOM: la interfaz solo los pinta.
import type { PieceType } from "../core/index.js";

/** Letras inglesas de PGN → letras españolas (la interfaz hace lo mismo en `ui/notation.ts`). */
const SPANISH_LETTER: Readonly<Record<string, string>> = { N: "C", B: "A", R: "T", Q: "D", K: "R" };

/** SAN inglesa → SAN española: «Nf3» → «Cf3», «e8=Q+» → «e8=D+». */
export function spanishSan(san: string): string {
  return san
    .replace(/^[NBRQK]/, (letter) => SPANISH_LETTER[letter]!)
    .replace(/=([NBRQ])/, (_, letter: string) => `=${SPANISH_LETTER[letter]!}`);
}

const NAMES: Readonly<Record<PieceType, { readonly name: string; readonly feminine: boolean }>> = {
  p: { name: "peón", feminine: false },
  n: { name: "caballo", feminine: false },
  b: { name: "alfil", feminine: false },
  r: { name: "torre", feminine: true },
  q: { name: "dama", feminine: true },
  k: { name: "rey", feminine: false },
};

/** «caballo», «torre»… */
export const pieceName = (type: PieceType): string => NAMES[type].name;

/** «el caballo», «la torre»… */
export const withArticle = (type: PieceType): string => `${NAMES[type].feminine ? "la" : "el"} ${NAMES[type].name}`;

/** «defendido» o «defendida», según la pieza. */
export const defended = (type: PieceType): string => (NAMES[type].feminine ? "defendida" : "defendido");
