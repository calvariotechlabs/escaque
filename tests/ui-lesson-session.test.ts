// Lección en marcha: pistas, intentos y cómo se aplica el veredicto al tablero.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Lesson, LessonCheck } from "../src/lessons/types.js";
import { checkLessonMove } from "../src/lessons/index.js";
import { LessonSession, type CheckLessonMove } from "../src/ui/lesson-session.js";
import { lessonPosition, hintButtonLabel, movesLabel, stateLabel, progressSentence, hintsUsed } from "../src/ui/lessons-text.js";

// Mate del pasillo: Te8#.
const LESSON: Lesson = {
  id: "pasillo",
  group: "tacticas",
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
    assert.deepEqual(result, { kind: "correcto", hints: 1, helped: false });
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

/** Torre que captura dos peones sin que el rival mueva (comprobación real de src/lessons). */
const ROOK: Lesson = {
  id: "torre",
  group: "primeros-pasos",
  number: 2,
  title: "La torre",
  summary: "Se mueve en línea recta.",
  fen: "k7/8/8/3p3p/8/8/8/K2R4 w - - 0 1",
  side: "w",
  goal: "Captura los dos peones negros con la torre.",
  hints: [{ text: "Sube por la columna d." }, { text: "Captura en d5.", marks: { from: "d1", to: "d5" } }],
  success: "La torre va en línea recta.",
  failure: "Esa jugada no captura ningún peón.",
  steps: [{ kind: "capture" }, { kind: "capture" }],
  helpPiece: "d1",
  counter: { one: "peón negro", many: "peones negros" },
};

/** Caballo que llega a f5, marcada. */
const KNIGHT: Lesson = {
  ...ROOK,
  id: "caballo",
  fen: "7k/8/8/8/3N4/8/P7/K7 w - - 0 1",
  steps: [{ kind: "reach", target: "f5", marked: true }],
  helpPiece: "d4",
};

describe("sesión de lección sin respuesta del rival", () => {
  it("tras una captura que no es la última, el turno vuelve al alumno y se queda la última jugada", () => {
    const s = new LessonSession(ROOK, checkLessonMove);
    const result = s.judge(s.game.play("d1", "d5")!);
    assert.deepEqual(result, { kind: "sigue", step: 2 });
    assert.equal(s.step, 2);
    assert.equal(s.game.turn, "w");
    assert.equal(s.game.pieceAt("d5")?.type, "r");
    assert.deepEqual(s.lastMove, { from: "d1", to: "d5" });
    assert.equal(s.captures, 1);
    assert.deepEqual(s.judge(s.game.play("d5", "h5")!), { kind: "correcto", hints: 0, helped: false });
    assert.equal(s.captures, 2);
  });

  it("un fallo tras un paso sin respuesta deshace solo la última jugada", () => {
    const s = new LessonSession(ROOK, checkLessonMove);
    s.judge(s.game.play("d1", "d5")!);
    const fen = s.game.fen;
    assert.deepEqual(s.judge(s.game.play("d5", "d4")!), { kind: "fallo", reason: ROOK.failure, attempt: 1 });
    assert.equal(s.game.fen, fen);
    assert.deepEqual(s.lastMove, { from: "d1", to: "d5" });
  });

  it("la ayuda enseña las casillas de la pieza, la sigue y deja la lección «con ayuda»", () => {
    const s = new LessonSession(ROOK, checkLessonMove);
    assert.equal(s.helpOn, false);
    assert.deepEqual(s.helpTargets(), []);
    s.toggleHelp();
    assert.equal(s.helpOn, true);
    assert.equal(s.helpSquare, "d1");
    assert.deepEqual(s.helpTargets(), ["b1", "c1", "d2", "d3", "d4", "d5", "e1", "f1", "g1", "h1"]);
    s.toggleHelp();
    assert.equal(s.helpOn, false);
    s.judge(s.game.play("d1", "d5")!);
    assert.equal(s.helpSquare, "d5");
    assert.deepEqual(s.judge(s.game.play("d5", "h5")!), { kind: "correcto", hints: 0, helped: true });
  });

  it("marca la casilla objetivo de un paso de llegada marcado", () => {
    const s = new LessonSession(KNIGHT, checkLessonMove);
    assert.equal(s.goalSquare(), "f5");
    assert.equal(new LessonSession(ROOK, checkLessonMove).goalSquare(), null);
    assert.deepEqual(s.judge(s.game.play("d4", "f5")!), { kind: "correcto", hints: 0, helped: false });
    assert.equal(s.goalSquare(), null);
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

describe("textos de los primeros pasos", () => {
  it("grupos, posición y estados con ayuda", async () => {
    const t = await import("../src/ui/lessons-text.js");
    assert.equal(t.GROUP_TITLE["primeros-pasos"], "Primeros pasos");
    assert.equal(t.GROUP_TITLE.tacticas, "Tácticas");
    assert.equal(t.groupLessonPosition("primeros-pasos", 5, 9), "Primeros pasos · lección 5 de 9");
    assert.equal(t.groupLessonLabel("tacticas", 1), "Tácticas, lección 1: ");
    assert.equal(t.groupListLabel("primeros-pasos"), "Lecciones de primeros pasos");
    assert.equal(t.groupDescription("tacticas", 6), "Seis posiciones para practicar jugadas clave: el enroque, la captura al paso, la coronación y los mates.");
    assert.equal(t.stateLabel("completada", 0, true), "Completada con ayuda.");
    assert.equal(t.stateLabel("completada", 2, true), "Completada con ayuda.");
    assert.equal(t.stateLabel("completada", 1, false), "Completada, con 1 pista.");
  });

  it("uso de pistas y de la ayuda al acertar", async () => {
    const t = await import("../src/ui/lessons-text.js");
    assert.equal(t.helpUsedSentence(0, false), "No has usado pistas ni casillas de ayuda.");
    assert.equal(t.helpUsedSentence(1, false), "Has usado 1 pista.");
    assert.equal(t.helpUsedSentence(0, true), "Has usado las casillas de ayuda.");
    assert.equal(t.helpUsedSentence(2, true), "Has usado 2 pistas y las casillas de ayuda.");
  });

  it("contador de capturas", async () => {
    const t = await import("../src/ui/lessons-text.js");
    const noun = { one: "un peón negro", many: "peones negros" };
    assert.deepEqual(t.counterSentence(0, 3, noun), { count: "Capturas: 0 de 3.", rest: "Quedan tres peones negros." });
    assert.deepEqual(t.counterSentence(1, 3, noun), { count: "Capturas: 1 de 3.", rest: "Quedan dos peones negros." });
    assert.deepEqual(t.counterSentence(2, 3, noun), { count: "Capturas: 2 de 3.", rest: "Queda un peón negro." });
    assert.deepEqual(t.counterSentence(3, 3, noun), { count: "Capturas: 3 de 3.", rest: "" });
  });

  it("anuncio de las casillas de ayuda", async () => {
    const t = await import("../src/ui/lessons-text.js");
    assert.equal(
      t.helpAnnouncement(["b3", "b5", "c2", "c6", "e2", "e6", "f3", "f5"], "f5"),
      "Casillas posibles marcadas: b3, b5, c2, c6, e2, e6, f3 y f5. La casilla objetivo es f5.",
    );
    assert.equal(t.helpAnnouncement(["d5"], null), "Casilla posible marcada: d5.");
    assert.equal(t.helpAnnouncement([], null), "Esta pieza no puede moverse ahora.");
  });
});
