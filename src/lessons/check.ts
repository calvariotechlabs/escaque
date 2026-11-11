// Comprobación de las jugadas del alumno. Pura y síncrona: no usa el motor
// (las respuestas del rival son fijas en los datos y se verifican en los tests).
import { FenError, Position } from "../core/index.js";
import { spanishSan } from "../coach/index.js";
import type { Lesson, LessonCheck } from "./types.js";

/** Lección mal formada, jugada ilegal o jugadas previas que no siguen la lección. */
export class LessonError extends Error {
  override name = "LessonError";
}

/** Juega una jugada UCI legal o lanza `LessonError`. Devuelve su SAN inglesa. */
function play(position: Position, uci: string): string {
  const move = position.moveFromUci(uci);
  if (move === null) throw new LessonError(`Jugada ilegal en la lección: ${uci}`);
  const san = position.moveToSan(move);
  position.makeMove(move);
  return san;
}

/**
 * Comprueba la jugada `uci` del alumno.
 *
 * `played` son todas las jugadas UCI hechas desde `lesson.fen`, en orden: las
 * del alumno (ya aceptadas) y las respuestas del rival. La interfaz solo debe
 * pasar jugadas legales; si no, o si `played` no sigue la lección, lanza
 * `LessonError`.
 */
export function checkLessonMove(lesson: Lesson, played: readonly string[], uci: string): LessonCheck {
  let position: Position;
  try {
    position = Position.fromFen(lesson.fen);
  } catch (error) {
    if (error instanceof FenError) throw new LessonError(`FEN no válida en la lección «${lesson.id}»`);
    throw error;
  }
  if (played.length % 2 !== 0) throw new LessonError("Falta la respuesta del rival en las jugadas previas");
  const index = played.length / 2;
  const step = lesson.steps[index];
  if (step === undefined) throw new LessonError(`La lección «${lesson.id}» ya está resuelta`);

  // Repite los pasos anteriores comprobando que siguen la lección.
  for (let i = 0; i < index; i++) {
    const previous = lesson.steps[i]!;
    const mine = played[2 * i]!;
    const reply = played[2 * i + 1]!;
    if (previous.kind !== "moves" || previous.accept[mine] !== reply) {
      throw new LessonError("Las jugadas previas no siguen la lección");
    }
    play(position, mine);
    play(position, reply);
  }

  const fail = (): LessonCheck => ({ kind: "fallo", reason: lesson.mistakes[uci] ?? lesson.failure });
  play(position, uci);
  const last = index === lesson.steps.length - 1;

  if (step.kind === "mate") {
    if (!last) throw new LessonError(`El paso de mate debe ser el último en «${lesson.id}»`);
    const status = position.status();
    return status.kind === "checkmate" ? { kind: "correcto" } : fail();
  }

  if (!Object.hasOwn(step.accept, uci)) return fail();
  const reply = step.accept[uci]!;
  if (last) return { kind: "correcto" };
  if (reply === null) throw new LessonError(`Falta la respuesta del rival en «${lesson.id}»`);
  const san = play(position, reply);
  return { kind: "paso-intermedio", step: index + 2, reply: { uci: reply, san: spanishSan(san) } };
}
