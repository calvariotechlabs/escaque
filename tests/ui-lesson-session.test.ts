// Lección en marcha: pistas, intentos y cómo se aplica el veredicto al tablero.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Lesson, LessonCheck } from "../src/lessons/types.js";
import { LessonSession, type CheckLessonMove } from "../src/ui/lesson-session.js";
import { lessonPosition, hintButtonLabel, movesLabel, stateLabel, progressSentence, hintsUsed } from "../src/ui/lessons-text.js";

// Mate del pasillo: Te8#.
const LESSON: Lesson = {
  id: "pasillo",
  number: 4,
  title: "Mate del pasillo",
  summary: "Da mate en una jugada con la torre.",
  fen: "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
  side: "w",
  goal: "Da mate en una jugada.",
  hints: [{ text: "Mira la última fila negra." }, { text: "Usa la torre.", marks: { from: "e1", to: "e8" } }],
  success: "Te8# es jaque mate.",
  failure: "Esa jugada no da mate.",
  steps: [{ kind: "mate" }],
};

function session(check: CheckLessonMove): LessonSession {
  return new LessonSession(LESSON, check);
}

const wrong: CheckLessonMove = () => ({ kind: "fallo", reason: "No." });
const right: CheckLessonMove = () => ({ kind: "correcto" });

describe("sesión de lección", () => {
  it("un fallo deshace la jugada y cuenta el intento", () => {
    const s = session(wrong);
    const record = s.game.play("e1", "e2")!;
    assert.deepEqual(s.judge(record), { kind: "fallo", reason: "No.", attempt: 1 });
    assert.equal(s.game.fen, new LessonSession(LESSON, wrong).game.fen);
    const again = s.game.play("e1", "e3")!;
    assert.equal((s.judge(again) as { attempt: number }).attempt, 2);
  });

  it("un acierto resuelve la lección y no deja pedir más pistas", () => {
    const s = session(right);
    s.askHint();
    const result = s.judge(s.game.play("e1", "e8")!);
    assert.deepEqual(result, { kind: "correcto", hints: 1 });
    assert.equal(s.solved, true);
    assert.equal(s.askHint(), null);
  });

  it("las pistas salen de una en una y la última marca casillas", () => {
    const s = session(wrong);
    assert.equal(s.hintMarks(), null);
    assert.deepEqual(s.askHint(), { number: 1, text: "Mira la última fila negra." });
    assert.equal(s.hintMarks(), null);
    assert.deepEqual(s.askHint(), { number: 2, text: "Usa la torre." });
    assert.deepEqual(s.hintMarks(), { from: "e1", to: "e8" });
    assert.equal(s.askHint(), null);
    assert.equal(s.canAskHint, false);
  });

  it("las marcas de la pista se quitan al cambiar la posición", () => {
    const s = session(right);
    s.askHint();
    s.askHint();
    s.game.play("e1", "e2");
    assert.equal(s.hintMarks(), null);
  });

  it("un paso intermedio juega la respuesta del rival y pasa al siguiente paso", () => {
    const calls: string[][] = [];
    const check: CheckLessonMove = (_lesson, played, uci): LessonCheck => {
      calls.push([...played, uci]);
      return played.length === 0 ? { kind: "paso-intermedio", step: 2, reply: { uci: "g8h8", san: "Rh8" } } : { kind: "correcto" };
    };
    const s = session(check);
    const first = s.judge(s.game.play("e1", "e7")!);
    assert.deepEqual(first, { kind: "paso", step: 2, reply: { uci: "g8h8", san: "Rh8" } });
    assert.equal(s.step, 2);
    assert.equal(s.game.turn, "w");
    const second = s.judge(s.game.play("e7", "f7")!);
    assert.equal(second.kind, "correcto");
    assert.deepEqual(calls, [["e1e7"], ["e1e7", "g8h8", "e7f7"]]);
  });

  it("si la comprobación lanza un error, cuenta como fallo con el motivo genérico", () => {
    const s = session(() => {
      throw new Error("raro");
    });
    assert.deepEqual(s.judge(s.game.play("e1", "e2")!), { kind: "fallo", reason: LESSON.failure, attempt: 1 });
  });
});

describe("textos de lecciones", () => {
  it("jugadas, estados y progreso", () => {
    assert.equal(movesLabel(1), "Una jugada.");
    assert.equal(movesLabel(2), "Dos jugadas.");
    assert.equal(stateLabel("completada", 0), "Completada, sin pistas.");
    assert.equal(stateLabel("completada", 1), "Completada, con 1 pista.");
    assert.equal(stateLabel("completada", 2), "Completada, con 2 pistas.");
    assert.equal(stateLabel("en-curso", 0), "En curso.");
    assert.equal(stateLabel("sin-empezar", 0), "Sin empezar.");
    assert.deepEqual(progressSentence(2, 6), { count: "2 de 6", rest: "lecciones completadas." });
    assert.equal(lessonPosition(4, 6), "Lección 4 de 6");
  });

  it("botón de pistas y uso de pistas", () => {
    assert.equal(hintButtonLabel(0, 3), "Pedir pista 1 de 3");
    assert.equal(hintButtonLabel(2, 3), "Pedir pista 3 de 3");
    assert.equal(hintButtonLabel(3, 3), "No quedan más pistas");
    assert.equal(hintsUsed(0), "Sin pistas.");
    assert.equal(hintsUsed(1), "Has usado 1 pista.");
  });
});

describe("introducción de la lista", () => {
  it("escribe el número de ejercicios con letra", async () => {
    const { listIntro } = await import("../src/ui/lessons-text.js");
    assert.equal(listIntro(6), "Seis ejercicios cortos para practicar en el tablero. Elige el que quieras: el orden es libre.");
    assert.equal(listIntro(12).startsWith("12 ejercicios"), true);
  });
});
