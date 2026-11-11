// Comprobación de las jugadas del alumno. Pura y síncrona: no usa el motor
// (las respuestas del rival son fijas en los datos y se verifican en los tests).
import { FenError, Position } from "../core/index.js";
import type { Move } from "../core/index.js";
// Directo de text.js, no del índice del coach: así no se carga el motor en el hilo principal.
import { spanishSan } from "../coach/text.js";
import type { Lesson, LessonCheck } from "./types.js";

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
  const position = start(lesson);
  if (played.length % 2 !== 0) throw new LessonError("Falta la respuesta del rival en las jugadas previas");
  const index = played.length / 2;
  const step = lesson.steps[index];
  if (step === undefined) throw new LessonError(`La lección «${lesson.id}» ya está resuelta`);

  // Repite los pasos anteriores comprobando que siguen la lección.
  for (let i = 0; i < index; i++) {
    const previous = lesson.steps[i]!;
    const mine = played[2 * i]!;
    const reply = played[2 * i + 1]!;
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
  play(position, uci);
  const last = index === lesson.steps.length - 1;

  if (step.kind === "mate") {
    if (!last) throw new LessonError(`El paso de mate debe ser el último en «${lesson.id}»`);
    return position.status().kind === "checkmate" ? { kind: "correcto" } : fail();
  }

  if (!Object.hasOwn(step.accept, uci)) return fail();
  const reply = step.accept[uci]!;
  if (last !== (reply === null)) throw new LessonError(`Respuesta del rival mal puesta en «${lesson.id}»`);
  if (reply === null) return { kind: "correcto" };
  const move = legal(position, reply);
  const san = spanishSan(position.moveToSan(move));
  return { kind: "paso-intermedio", step: index + 2, reply: { uci: reply, san } };
}
