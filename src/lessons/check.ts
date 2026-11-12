// Comprobación de las jugadas del alumno. Pura y síncrona: no usa el motor
// (las respuestas del rival son fijas en los datos y se verifican en los tests).
import { FenError, Position } from "../core/index.js";
import type { Move } from "../core/index.js";
// Directo de text.js, no del índice del coach: así no se carga el motor en el hilo principal.
import { spanishSan } from "../coach/text.js";
import type { Color } from "../core/index.js";
import type { FreeStep, Lesson, LessonCheck, Step } from "./types.js";

/** Jugada nula en `played`: el rival no mueve (como «0000» en UCI). */
export const PASS = "0000";

/**
 * FEN con el turno devuelto a `side` (el rival «pasa»). Quita la casilla al
 * paso, que solo valía para la jugada del rival.
 */
export function passTurn(fen: string, side: Color): string {
  const fields = fen.trim().split(/\s+/);
  if (fields[1] === side) return fields.join(" ");
  fields[1] = side;
  fields[3] = "-";
  return fields.join(" ");
}

const isFree = (step: Step): step is FreeStep => step.kind === "reach" || step.kind === "capture" || step.kind === "check";

/** ¿La jugada `move` cumple el paso? `captured`: si capturaba algo; `after`: la posición tras jugarla. */
function meetsFree(step: FreeStep, move: Move, captured: boolean, after: Position): boolean {
  switch (step.kind) {
    case "reach":
      return squareName(move.to) === step.target;
    case "capture":
      return captured;
    case "check":
      return after.isCheck();
  }
}

/** ¿Captura `move` en `position` (antes de jugarla)? */
const captures = (position: Position, move: Move): boolean => position.pieceAt(move.to) !== null || isEnPassant(position, move);

const FILES = "abcdefgh";
function squareName(square: number): string {
  return `${FILES[square & 7]!}${(square >> 4) + 1}`;
}

/** Un peón que cambia de columna hacia una casilla vacía solo puede estar capturando al paso. */
function isEnPassant(position: Position, move: Move): boolean {
  return position.pieceAt(move.from)?.type === "p" && (move.from & 7) !== (move.to & 7) && position.pieceAt(move.to) === null;
}

/** El rival no mueve: misma posición con el turno del alumno. */
function pass(position: Position, side: Color, id: string): Position {
  try {
    return Position.fromFen(passTurn(position.toFen(), side));
  } catch (error) {
    if (error instanceof FenError) throw new LessonError(`En «${id}» el rival no puede pasar: ${error.message}`);
    throw error;
  }
}

/** Lección mal formada, jugada ilegal o jugadas previas que no siguen la lección. */
export class LessonError extends Error {
  override name = "LessonError";
}

/** Jugada UCI legal en `position`, o lanza `LessonError`. */
function legal(position: Position, uci: string): Move {
  const move = position.moveFromUci(uci);
  if (move === null) throw new LessonError(`Jugada ilegal en la lección: ${uci}`);
  return move;
}

const play = (position: Position, uci: string): void => position.makeMove(legal(position, uci));

function start(lesson: Lesson): Position {
  let position: Position;
  try {
    position = Position.fromFen(lesson.fen);
  } catch (error) {
    if (error instanceof FenError) throw new LessonError(`FEN no válida en la lección «${lesson.id}»`);
    throw error;
  }
  if (position.turn !== lesson.side) throw new LessonError(`En «${lesson.id}» la FEN no da el turno al alumno`);
  return position;
}

/**
 * Comprueba la jugada `uci` del alumno.
 *
 * `played` son todas las jugadas UCI hechas desde `lesson.fen`, en orden: las
 * del alumno (ya aceptadas) y las respuestas del rival. La interfaz solo debe
 * pasar jugadas legales; si no, si `played` no sigue la lección o si la
 * lección está mal formada, lanza `LessonError`.
 */
export function checkLessonMove(lesson: Lesson, played: readonly string[], uci: string): LessonCheck {
  let position = start(lesson);
  if (played.length % 2 !== 0) throw new LessonError("Falta la respuesta del rival en las jugadas previas");
  const index = played.length / 2;
  const step = lesson.steps[index];
  if (step === undefined) throw new LessonError(`La lección «${lesson.id}» ya está resuelta`);

  // Repite los pasos anteriores comprobando que siguen la lección.
  for (let i = 0; i < index; i++) {
    const previous = lesson.steps[i]!;
    const mine = played[2 * i]!;
    const reply = played[2 * i + 1]!;
    if (isFree(previous)) {
      const done = legal(position, mine);
      const captured = captures(position, done);
      position.makeMove(done);
      if (reply !== PASS || !meetsFree(previous, done, captured, position)) throw new LessonError("Las jugadas previas no siguen la lección");
      position = pass(position, lesson.side, lesson.id);
      continue;
    }
    if (previous.kind !== "moves" || !Object.hasOwn(previous.accept, mine) || previous.accept[mine] !== reply) {
      throw new LessonError("Las jugadas previas no siguen la lección");
    }
    play(position, mine);
    play(position, reply);
  }

  const fail = (): LessonCheck => ({
    kind: "fallo",
    reason: (step.mistakes && Object.hasOwn(step.mistakes, uci) ? step.mistakes[uci] : undefined) ?? lesson.failure,
  });
  const move = legal(position, uci);
  const captured = captures(position, move);
  position.makeMove(move);
  const last = index === lesson.steps.length - 1;

  if (isFree(step)) {
    if (!meetsFree(step, move, captured, position)) return fail();
    if (last) return { kind: "correcto" };
    pass(position, lesson.side, lesson.id); // comprueba que el rival puede pasar (no queda en jaque)
    return { kind: "sigue", step: index + 2 };
  }

  if (step.kind === "mate") {
    if (!last) throw new LessonError(`El paso de mate debe ser el último en «${lesson.id}»`);
    return position.status().kind === "checkmate" ? { kind: "correcto" } : fail();
  }

  if (!Object.hasOwn(step.accept, uci)) return fail();
  const reply = step.accept[uci]!;
  if (last !== (reply === null)) throw new LessonError(`Respuesta del rival mal puesta en «${lesson.id}»`);
  if (reply === null) return { kind: "correcto" };
  const san = spanishSan(position.moveToSan(legal(position, reply)));
  return { kind: "paso-intermedio", step: index + 2, reply: { uci: reply, san } };
}
