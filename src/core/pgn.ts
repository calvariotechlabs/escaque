// PGN (Portable Game Notation): lectura y escritura de una partida.
//
// Se escribe a mano, sin dependencias, y funciona igual en Node y en el
// navegador. Al leer se toman las cabeceras, las jugadas de la línea principal
// en SAN y el resultado; se ignoran comentarios, variantes, NAG, anotaciones
// («!?») y números de jugada. El texto llega del usuario, así que todo tiene
// límites de tamaño y cualquier fallo es un `PgnError` con un mensaje en
// español que la interfaz puede mostrar tal cual.
import { FenError } from "./errors.js";
import { Position, START_FEN, moveToUci } from "./position.js";

export type PgnResult = "1-0" | "0-1" | "1/2-1/2" | "*";

/** Cabecera de PGN: nombre y valor, en el orden del texto. */
export type PgnTag = readonly [name: string, value: string];

/** Partida leída de un PGN. Las jugadas van en UCI («e2e4», «e7e8q»). */
export interface PgnGame {
  readonly tags: readonly PgnTag[];
  readonly startFen: string;
  readonly moves: readonly string[];
  readonly result: PgnResult;
}

/** Datos para escribir un PGN. Las jugadas, en UCI, deben ser legales desde `startFen`. */
export interface PgnInput {
  readonly tags?: readonly PgnTag[];
  readonly startFen?: string;
  readonly moves: readonly string[];
  readonly result?: PgnResult;
}

/** PGN que no se puede leer o partida que no se puede escribir. */
export class PgnError extends Error {
  override name = "PgnError";
}

/** Máximo de caracteres del texto: una partida larga anotada ocupa unas decenas de KB. */
export const PGN_MAX_LENGTH = 256 * 1024;
/** Máximo de medias jugadas (la partida oficial más larga tiene 538). */
export const PGN_MAX_PLIES = 1200;
const TAG_MAX_LENGTH = 255;
const MAX_TAGS = 64;
const LINE_WIDTH = 79;

const ROSTER = ["Event", "Site", "Date", "Round", "White", "Black", "Result"] as const;
const ROSTER_DEFAULTS: Record<(typeof ROSTER)[number], string> = {
  Event: "?",
  Site: "?",
  Date: "????.??.??",
  Round: "?",
  White: "?",
  Black: "?",
  Result: "*",
};
/** Cabeceras que se derivan de los datos al escribir, nunca se copian de `tags`. */
const DERIVED = new Set(["Result", "SetUp", "FEN"]);
const RESULTS: ReadonlySet<string> = new Set(["1-0", "0-1", "1/2-1/2", "*"]);
const TAG_NAME = /^[A-Za-z0-9_]+$/;

// --- Escritura ---------------------------------------------------------------

/**
 * Escribe la partida en PGN: las siete cabeceras obligatorias (con «?» si no
 * se dan), `SetUp` y `FEN` si no parte de la posición inicial, el resto de
 * cabeceras en su orden, y las jugadas en SAN en líneas de menos de 80
 * caracteres, terminadas por el resultado. Lanza `PgnError` si una jugada no
 * es legal o un nombre de cabecera no es válido.
 */
export function writePgn(input: PgnInput): string {
  const startFen = input.startFen ?? START_FEN;
  const result = input.result ?? "*";
  const given = new Map<string, string>();
  for (const [name, value] of input.tags ?? []) {
    if (!TAG_NAME.test(name)) throw new PgnError(`El nombre de cabecera «${name}» no es válido.`);
    if (!given.has(name)) given.set(name, value);
  }

  const lines: string[] = [];
  for (const name of ROSTER) {
    const value = name === "Result" ? result : (given.get(name) ?? ROSTER_DEFAULTS[name]);
    lines.push(tagLine(name, value));
  }
  if (startFen !== START_FEN) {
    lines.push(tagLine("SetUp", "1"), tagLine("FEN", startFen));
  }
  for (const [name, value] of given) {
    if (!(ROSTER as readonly string[]).includes(name) && !DERIVED.has(name)) lines.push(tagLine(name, value));
  }

  const tokens = sanTokens(startFen, input.moves);
  tokens.push(result);
  return `${lines.join("\n")}\n\n${wrap(tokens).join("\n")}\n`;
}

function tagLine(name: string, value: string): string {
  // Sin saltos de línea ni otros caracteres de control: una cabecera ocupa una línea.
  const clean = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `[${name} "${clean}"]`;
}

/** «1. e4», «e5», «2. Nf3»…; «N... x» si la primera jugada es de las negras. */
function sanTokens(startFen: string, moves: readonly string[]): string[] {
  const position = loadFen(startFen, "La posición inicial no es válida");
  let number = fullmoveOf(position);
  let white = position.toFen().split(" ")[1] === "w";
  const tokens: string[] = [];
  for (let i = 0; i < moves.length; i++) {
    const uci = moves[i]!;
    const move = position.moveFromUci(uci);
    if (move === null) throw new PgnError(`La jugada ${uci} no es legal en esa posición.`);
    const san = position.moveToSan(move);
    if (white) tokens.push(`${number}. ${san}`);
    else tokens.push(i === 0 ? `${number}... ${san}` : san);
    position.makeMove(move);
    if (!white) number++;
    white = !white;
  }
  return tokens;
}

function wrap(tokens: readonly string[]): string[] {
  const lines: string[] = [];
  let line = "";
  for (const token of tokens) {
    if (line === "") line = token;
    else if (line.length + 1 + token.length <= LINE_WIDTH) line += ` ${token}`;
    else {
      lines.push(line);
      line = token;
    }
  }
  if (line !== "") lines.push(line);
  return lines;
}

// --- Lectura -----------------------------------------------------------------

/**
 * Lee la primera partida del texto. Devuelve sus cabeceras, la posición de
 * partida (la de la cabecera `FEN` o la inicial), las jugadas de la línea
 * principal en UCI y el resultado (el de las jugadas o, si no lo hay, el de la
 * cabecera `Result`). Lanza `PgnError` si el texto no es un PGN válido o
 * alguna jugada no es legal.
 */
export function parsePgn(text: string): PgnGame {
  if (typeof text !== "string") throw new PgnError("El texto no contiene ninguna partida en PGN.");
  if (text.length > PGN_MAX_LENGTH) throw new PgnError("El PGN es demasiado largo.");
  const reader = new Reader(text.replace(/^﻿/, ""));

  const tags = reader.readTags();
  const fenTag = tags.find(([name]) => name === "FEN");
  const startFen = fenTag === undefined ? START_FEN : fenTag[1].trim();
  const position = loadFen(startFen, "La cabecera FEN no es válida");

  const moves: string[] = [];
  let result: PgnResult | null = null;
  let number = fullmoveOf(position);
  let white = position.toFen().split(" ")[1] === "w";
  for (;;) {
    const token = reader.nextMoveToken();
    if (token === null) break;
    if (RESULTS.has(token)) {
      result = token as PgnResult;
      break;
    }
    if (moves.length >= PGN_MAX_PLIES) throw new PgnError("La partida tiene demasiadas jugadas.");
    const move = position.moveFromSan(token);
    if (move === null) {
      const shown = token.length > 20 ? `${token.slice(0, 20)}…` : token;
      throw new PgnError(`La jugada ${number}${white ? "." : "..."} ${shown} no es legal en esa posición.`);
    }
    moves.push(moveToUci(move));
    position.makeMove(move);
    if (!white) number++;
    white = !white;
  }

  if (tags.length === 0 && moves.length === 0 && result === null) {
    throw new PgnError("El texto no contiene ninguna partida en PGN.");
  }
  if (result === null) {
    const tagged = tags.find(([name]) => name === "Result")?.[1];
    result = tagged !== undefined && RESULTS.has(tagged) ? (tagged as PgnResult) : "*";
  }
  return { tags, startFen, moves, result };
}

function loadFen(fen: string, message: string): Position {
  try {
    return Position.fromFen(fen);
  } catch (error) {
    if (error instanceof FenError) throw new PgnError(`${message}: ${error.message}.`);
    throw error;
  }
}

function fullmoveOf(position: Position): number {
  const value = Number(position.toFen().split(" ")[5]);
  return Number.isInteger(value) && value > 0 ? value : 1;
}

const isSpace = (c: string): boolean => c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f" || c === "\v";
/** Caracteres que cortan una palabra de las jugadas. */
const DELIMITERS = new Set(["{", "}", "(", ")", ";", "[", "]", "$"]);

/** Recorre el texto carácter a carácter. */
class Reader {
  private i = 0;
  private lineStart = true;

  constructor(private readonly text: string) {}

  /** Cabeceras `[Nombre "valor"]` del principio, con las escapes `\"` y `\\`. */
  readTags(): PgnTag[] {
    const tags: PgnTag[] = [];
    for (;;) {
      this.skipSpaceAndEscapes();
      // Comentarios antes de las cabeceras (o entre ellas), como los que añaden algunos programas.
      if (this.peek() === "{") {
        this.skipComment();
        continue;
      }
      if (this.peek() === ";") {
        this.skipLine();
        continue;
      }
      if (this.peek() !== "[") return tags;
      this.i++;
      this.skipInlineSpace();
      const nameStart = this.i;
      while (this.i < this.text.length && /[A-Za-z0-9_]/.test(this.text[this.i]!)) this.i++;
      const name = this.text.slice(nameStart, this.i);
      if (name.length > TAG_MAX_LENGTH) throw new PgnError("Hay una cabecera demasiado larga.");
      this.skipInlineSpace();
      if (name === "" || this.peek() !== '"') throw new PgnError("Hay una cabecera mal escrita.");
      this.i++;
      let value = "";
      for (;;) {
        const c = this.text[this.i++];
        if (c === undefined || c === "\n" || c === "\r") throw new PgnError("Hay una cabecera mal escrita.");
        if (c === '"') break;
        const next = this.text[this.i];
        if (c === "\\" && (next === '"' || next === "\\")) {
          value += next;
          this.i++;
        } else {
          value += c;
        }
        if (value.length > TAG_MAX_LENGTH) throw new PgnError("Hay una cabecera demasiado larga.");
      }
      this.skipInlineSpace();
      if (this.peek() !== "]") throw new PgnError("Hay una cabecera mal escrita.");
      this.i++;
      if (tags.length >= MAX_TAGS) throw new PgnError("Hay demasiadas cabeceras.");
      tags.push([name, value]);
    }
  }

  /**
   * Siguiente jugada o resultado de la línea principal, sin el número de
   * jugada; `null` al acabar el texto o al empezar la siguiente partida.
   */
  nextMoveToken(): string | null {
    for (;;) {
      this.skipSpaceAndEscapes();
      const c = this.peek();
      if (c === undefined || c === "[") return null;
      if (c === "{") this.skipComment();
      else if (c === ";") this.skipLine();
      else if (c === "(") this.skipVariation();
      else if (c === ")") throw new PgnError("Hay un paréntesis de cierre sin abrir.");
      else if (c === "}") throw new PgnError("Hay un cierre de comentario sin abrir.");
      else if (c === "]") throw new PgnError("Hay una cabecera mal escrita.");
      else {
        const word = this.readWord();
        // NAG ($1), número de jugada («12.», «12...») pegado o no a la jugada.
        if (word.startsWith("$")) continue;
        const move = RESULTS.has(word) ? word : word.replace(/^\d*\.+/, "").replace(/^\d+$/, "");
        if (move !== "") return move;
      }
    }
  }

  private peek(): string | undefined {
    return this.text[this.i];
  }

  private readWord(): string {
    const start = this.i;
    // «$» solo empieza palabra (NAG); dentro de una palabra la corta.
    if (this.peek() === "$") this.i++;
    while (this.i < this.text.length) {
      const c = this.text[this.i]!;
      if (isSpace(c) || DELIMITERS.has(c)) break;
      this.i++;
    }
    this.lineStart = false;
    return this.text.slice(start, this.i);
  }

  private skipInlineSpace(): void {
    while (this.i < this.text.length && (this.text[this.i] === " " || this.text[this.i] === "\t")) this.i++;
  }

  /** Espacios y líneas de escape («%» al principio de una línea). */
  private skipSpaceAndEscapes(): void {
    while (this.i < this.text.length) {
      const c = this.text[this.i]!;
      if (c === "\n") {
        this.lineStart = true;
        this.i++;
      } else if (isSpace(c)) {
        this.i++;
      } else if (c === "%" && this.lineStart) {
        this.skipLine();
      } else {
        this.lineStart = false;
        return;
      }
    }
  }

  private skipLine(): void {
    while (this.i < this.text.length && this.text[this.i] !== "\n") this.i++;
  }

  private skipComment(): void {
    const end = this.text.indexOf("}", this.i);
    if (end === -1) throw new PgnError("Hay un comentario sin cerrar.");
    this.i = end + 1;
  }

  /** Salta una variante entera, con las que lleve anidadas y sus comentarios. */
  private skipVariation(): void {
    let depth = 0;
    while (this.i < this.text.length) {
      const c = this.text[this.i]!;
      if (c === "{") {
        this.skipComment();
        continue;
      }
      if (c === ";") {
        this.skipLine();
        continue;
      }
      this.i++;
      if (c === "(") depth++;
      else if (c === ")" && --depth === 0) return;
    }
    throw new PgnError("Hay una variante sin cerrar.");
  }
}
