// Lecciones: comprobación de las jugadas del alumno (con lecciones de prueba).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LessonError, checkLessonMove } from "../src/lessons/index.js";
import type { Lesson } from "../src/lessons/index.js";

const base = {
  number: 1,
  title: "Prueba",
  summary: "Lección de prueba.",
  side: "w",
  goal: "Haz la jugada.",
  hints: [{ text: "Pista." }, { text: "Mueve la torre.", marks: { from: "d1", to: "d8" } }],
  success: "Bien hecho.",
  failure: "Esa no es.",
  mistakes: {},
} as const;

/** Mate del pasillo: solo Td8 da mate. */
const mateIn1: Lesson = {
  ...base,
  id: "mate-1",
  fen: "6k1/5ppp/8/8/8/8/r4PPP/3R2K1 w - - 0 1",
  mistakes: { g2g4: "El peón no ataca al rey." },
  steps: [{ kind: "mate" }],
};

/** Horquilla: Cc7+, Rd7 (fija), Cxd5. */
const fork: Lesson = {
  ...base,
  id: "fork",
  fen: "4k3/pp3ppp/8/1N1q4/8/8/PPP2PPP/4K3 w - - 0 1",
  steps: [
    { kind: "moves", accept: { b5c7: "e8d7" } },
    { kind: "moves", accept: { c7d5: null } },
  ],
};

/** Negras juegan: mate del pasillo con colores invertidos. */
const blackMate: Lesson = {
  ...base,
  id: "black-mate",
  side: "b",
  fen: "3r2k1/r4ppp/8/8/8/8/5PPP/6K1 b - - 0 1",
  steps: [{ kind: "mate" }],
};

describe("checkLessonMove", () => {
  it("acepta una jugada que da mate en un paso de mate", () => {
    assert.deepEqual(checkLessonMove(mateIn1, [], "d1d8"), { kind: "correcto" });
  });

  it("rechaza con el motivo genérico una jugada que no da mate", () => {
    assert.deepEqual(checkLessonMove(mateIn1, [], "g1f1"), { kind: "fallo", reason: "Esa no es." });
  });

  it("rechaza con el motivo propio una jugada típica", () => {
    assert.deepEqual(checkLessonMove(mateIn1, [], "g2g4"), { kind: "fallo", reason: "El peón no ataca al rey." });
  });

  it("devuelve la respuesta fija del rival en un paso intermedio, en SAN española", () => {
    assert.deepEqual(checkLessonMove(fork, [], "b5c7"), {
      kind: "paso-intermedio",
      step: 2,
      reply: { uci: "e8d7", san: "Rd7" },
    });
  });

  it("acepta el último paso tras la respuesta del rival", () => {
    assert.deepEqual(checkLessonMove(fork, ["b5c7", "e8d7"], "c7d5"), { kind: "correcto" });
  });

  it("rechaza una jugada fuera de la lista en un paso de jugadas", () => {
    assert.deepEqual(checkLessonMove(fork, [], "b5d6"), { kind: "fallo", reason: "Esa no es." });
  });

  it("funciona con el alumno llevando negras", () => {
    assert.deepEqual(checkLessonMove(blackMate, [], "d8d1"), { kind: "correcto" });
  });

  it("lanza LessonError con una jugada ilegal", () => {
    assert.throws(() => checkLessonMove(mateIn1, [], "d1d9"), LessonError);
    assert.throws(() => checkLessonMove(mateIn1, [], "e1e2"), LessonError);
  });

  it("lanza LessonError si las jugadas previas no siguen la lección", () => {
    assert.throws(() => checkLessonMove(fork, ["b5d6", "e8d7"], "c7d5"), LessonError);
    assert.throws(() => checkLessonMove(fork, ["b5c7", "e8f8"], "c7d5"), LessonError);
    assert.throws(() => checkLessonMove(fork, ["b5c7"], "c7d5"), LessonError);
  });

  it("lanza LessonError si la lección ya está resuelta", () => {
    assert.throws(() => checkLessonMove(mateIn1, ["d1d8"], "g8h8"), LessonError);
  });
});
