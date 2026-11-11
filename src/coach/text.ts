// Textos en español del coach. Sin DOM: la interfaz solo los pinta.
// Estilo del diseño aprobado: español de tú, sin exclamaciones y con punto final.
import type { Color, PieceType } from "../core/index.js";

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

const feminine = (type: PieceType): boolean => NAMES[type].feminine;

/** «caballo», «torre»… */
export const pieceName = (type: PieceType): string => NAMES[type].name;

/** «el caballo», «la torre»… */
export const withArticle = (type: PieceType): string => `${feminine(type) ? "la" : "el"} ${pieceName(type)}`;

/** «del caballo», «de la torre»… */
export const ofPiece = (type: PieceType): string => (feminine(type) ? `de la ${pieceName(type)}` : `del ${pieceName(type)}`);

/** Pronombre de objeto: «lo» o «la». */
export const pronoun = (type: PieceType): string => (feminine(type) ? "la" : "lo");

/** Concuerda un participio o adjetivo con la pieza: «atacad» → «atacado» / «atacada». */
export const agree = (stem: string, type: PieceType): string => stem + (feminine(type) ? "a" : "o");

/** «el caballo negro de f6», «la dama blanca de h5». */
export const pieceOn = (type: PieceType, color: Color, square: string): string =>
  `${withArticle(type)} ${color === "w" ? agree("blanc", type) : agree("negr", type)} de ${square}`;

/** «las blancas» o «las negras». */
export const side = (color: Color): string => (color === "w" ? "las blancas" : "las negras");

/** Une frases cortas: «a», «a y b», «a, b y c». */
export function joinPhrases(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]!}`;
}

/** Peones con una cifra decimal y coma: 30 → «0,3»; −580 → «5,8» (sin signo). */
export const pawns = (cp: number): string => (Math.round(Math.abs(cp) / 10) / 10).toFixed(1).replace(".", ",");
