// Una lección en marcha, sin DOM: la partida de la lección, las pistas pedidas,
// los intentos y qué pasa tras cada jugada. La validación la hace `src/lessons`
// (`checkLessonMove`); aquí solo se aplica su veredicto al tablero.
import type { Lesson, LessonCheck, LessonReply as LessonMove } from "../lessons/types.js";
import { PASS, passTurn } from "../lessons/check.js";
import type { PromotionPiece } from "../core/index.js";
import { Game, type MoveRecord } from "./game.js";

export type CheckLessonMove = (lesson: Lesson, played: readonly string[], uci: string) => LessonCheck;

export type Feedback =
  /** La lección está resuelta: el tablero se bloquea. `helped`: se usó «Ver a dónde puede ir». */
  | { readonly kind: "correcto"; readonly hints: number; readonly helped: boolean }
  /** Jugada buena que pide otra: la respuesta fija del rival ya está en el tablero. */
  | { readonly kind: "paso"; readonly step: number; readonly reply: LessonMove }
  /** Jugada buena que pide otra sin respuesta del rival: vuelve a jugar el alumno. */
  | { readonly kind: "sigue"; readonly step: number }
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
  /** Pasos de captura ya hechos (contador de capturas). */
  captures = 0;
  /** «Ver a dónde puede ir» está encendido. */
  helpOn = false;
  /** Se ha encendido alguna vez en esta vez: la lección queda «completada con ayuda». */
  helpUsed = false;
  /** Casilla de la pieza que enseña la ayuda; sigue a la pieza cuando se mueve. */
  helpSquare: string | null;
  /** Última jugada aceptada antes de un paso sin respuesta (la partida se rehace y la perdería). */
  private passedMove: { readonly from: string; readonly to: string } | null = null;
  /** Jugadas aceptadas desde la FEN de la lección, con las respuestas del rival o `PASS`. */
  private readonly played: string[] = [];
  /** Casilla de origen y destino de la última pista, mientras la posición no cambie. */
  private marksPly = "";
  /** Cuántas veces se ha rehecho la partida (pasos sin respuesta): con la media jugada, distingue cada posición. */
  private version = 0;

  private get positionKey(): string {
    return `${this.version}:${this.game.ply}`;
  }

  constructor(
    readonly lesson: Lesson,
    private readonly check: CheckLessonMove,
  ) {
    this.game = new Game(lesson.fen);
    this.helpSquare = lesson.helpPiece ?? null;
  }

  /** La última jugada de la lección, para marcarla en el tablero. */
  get lastMove(): { readonly from: string; readonly to: string } | null {
    return this.game.lastMove ?? this.passedMove;
  }

  /** Enciende o apaga «Ver a dónde puede ir». Encenderla deja la lección «con ayuda». */
  toggleHelp(): void {
    if (this.helpSquare === null || this.solved) return;
    this.helpOn = !this.helpOn;
    if (this.helpOn) this.helpUsed = true;
  }

  /** Casillas a las que puede ir la pieza de la ayuda, si está encendida (en orden alfabético). */
  helpTargets(): string[] {
    if (!this.helpOn || this.helpSquare === null || this.solved) return [];
    return [...new Set(this.game.targets(this.helpSquare))].sort();
  }

  /** Casilla objetivo que el tablero debe señalar en el paso actual, o `null`. */
  goalSquare(): string | null {
    if (this.solved) return null;
    const step = this.lesson.steps[this.step - 1];
    return step?.kind === "reach" && step.marked ? step.target : null;
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
    this.marksPly = hint.marks === undefined ? "" : this.positionKey;
    return { number: this.hintsShown, text: hint.text };
  }

  /** Casillas que marca la última pista si es la que marca, y la posición no ha cambiado desde que se pidió. */
  hintMarks(): { readonly from: string; readonly to: string } | null {
    // Las marcas son de la jugada del primer paso (la de la última pista).
    if (this.hintsShown === 0 || this.step !== 1 || this.marksPly !== this.positionKey) return null;
    return this.lesson.hints[this.hintsShown - 1]?.marks ?? null;
  }

  /**
   * Comprueba la jugada que la persona acaba de hacer en `game`. Si falla, la
   * deshace; si pide otra, juega la respuesta del rival.
   */
  judge(record: MoveRecord): Feedback {
    const uci = uciOf(record);
    let result: LessonCheck;
    try {
      result = this.check(this.lesson, this.played, uci);
    } catch {
      result = { kind: "fallo", reason: this.lesson.failure };
    }
    if (result.kind === "fallo") return this.fail(result.reason);
    switch (result.kind) {
      case "correcto":
        this.accept(record);
        this.solved = true;
        this.helpOn = false;
        return { kind: "correcto", hints: this.hintsShown, helped: this.helpUsed };
      case "paso-intermedio": {
        const reply = result.reply.uci;
        const played = this.game.play(reply.slice(0, 2), reply.slice(2, 4), (reply[4] as PromotionPiece | undefined) ?? undefined);
        // Respuesta imposible (datos mal hechos): se deshace la jugada del alumno, sin contarla.
        if (played === null) return this.fail(this.lesson.failure);
        this.accept(record);
        this.played.push(uci, reply);
        this.step = result.step;
        return { kind: "paso", step: result.step, reply: result.reply };
      }
      case "sigue":
        // El rival no mueve: la partida sigue desde la misma posición con el turno del alumno.
        this.accept(record);
        this.version++;
        this.played.push(uci, PASS);
        this.passedMove = { from: record.from, to: record.to };
        this.game = new Game(passTurn(this.game.fen, this.lesson.side));
        this.step = result.step;
        return { kind: "sigue", step: result.step };
    }
  }

  /** Apunta la jugada aceptada: capturas y la casilla de la pieza que sigue la ayuda. */
  private accept(record: MoveRecord): void {
    if (this.lesson.steps[this.step - 1]?.kind === "capture") this.captures++;
    if (record.from === this.helpSquare) this.helpSquare = record.to;
  }

  private fail(reason: string): Feedback {
    this.game.undo();
    this.attempts++;
    return { kind: "fallo", reason, attempt: this.attempts };
  }
}
