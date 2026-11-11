// Una lección en marcha, sin DOM: la partida de la lección, las pistas pedidas,
// los intentos y qué pasa tras cada jugada. La validación la hace `src/lessons`
// (`checkLessonMove`); aquí solo se aplica su veredicto al tablero.
import type { Lesson, LessonCheck, PlayedMove as LessonMove } from "../lessons/types.js";
import type { PromotionPiece } from "../core/index.js";
import { Game, type MoveRecord } from "./game.js";

export type CheckLessonMove = (lesson: Lesson, played: readonly string[], uci: string) => LessonCheck;

export type Feedback =
  /** La lección está resuelta: el tablero se bloquea. */
  | { readonly kind: "correcto"; readonly hints: number }
  /** Jugada buena que pide otra: la respuesta fija del rival ya está en el tablero. */
  | { readonly kind: "paso"; readonly step: number; readonly reply: LessonMove }
  /** La jugada se ha deshecho; `attempt` cuenta los fallos de esta vez. */
  | { readonly kind: "fallo"; readonly reason: string; readonly attempt: number };

export function uciOf(record: { readonly from: string; readonly to: string; readonly promotion: PromotionPiece | null }): string {
  return `${record.from}${record.to}${record.promotion ?? ""}`;
}

export class LessonSession {
  game: Game;
  /** Pistas enseñadas, de la primera a la última. */
  hintsShown = 0;
  attempts = 0;
  /** Paso del alumno en el que está, desde 1. */
  step = 1;
  solved = false;
  /** Casilla de origen y destino de la última pista, mientras la posición no cambie. */
  private marksPly = -1;

  constructor(
    readonly lesson: Lesson,
    private readonly check: CheckLessonMove,
  ) {
    this.game = new Game(lesson.fen);
  }

  get totalSteps(): number {
    return this.lesson.steps.length;
  }

  /** ¿Quedan pistas por pedir? */
  get canAskHint(): boolean {
    return !this.solved && this.hintsShown < this.lesson.hints.length;
  }

  /** Enseña la siguiente pista, o `null` si ya no quedan. */
  askHint(): { readonly number: number; readonly text: string } | null {
    if (!this.canAskHint) return null;
    const hint = this.lesson.hints[this.hintsShown]!;
    this.hintsShown++;
    this.marksPly = hint.marks === undefined ? -1 : this.game.ply;
    return { number: this.hintsShown, text: hint.text };
  }

  /** Casillas que marca la última pista si es la que marca, y la posición no ha cambiado desde que se pidió. */
  hintMarks(): { readonly from: string; readonly to: string } | null {
    if (this.hintsShown === 0 || this.marksPly !== this.game.ply) return null;
    return this.lesson.hints[this.hintsShown - 1]?.marks ?? null;
  }

  /**
   * Comprueba la jugada que la persona acaba de hacer en `game`. Si falla, la
   * deshace; si pide otra, juega la respuesta del rival.
   */
  judge(record: MoveRecord): Feedback {
    const uci = uciOf(record);
    const before = this.game.history.slice(0, this.game.ply - 1).map(uciOf);
    let result: LessonCheck;
    try {
      result = this.check(this.lesson, before, uci);
    } catch {
      result = { kind: "fallo", reason: this.lesson.failure };
    }
    switch (result.kind) {
      case "correcto":
        this.solved = true;
        return { kind: "correcto", hints: this.hintsShown };
      case "paso-intermedio": {
        const reply = result.reply.uci;
        const played = this.game.play(reply.slice(0, 2), reply.slice(2, 4), (reply[4] as PromotionPiece | undefined) ?? undefined);
        if (played === null) return this.fail(this.lesson.failure);
        this.step = result.step;
        return { kind: "paso", step: result.step, reply: result.reply };
      }
      case "fallo":
        return this.fail(result.reason);
    }
  }

  private fail(reason: string): Feedback {
    this.game.undo();
    this.attempts++;
    return { kind: "fallo", reason, attempt: this.attempts };
  }
}
