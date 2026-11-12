// Lecciones: comprobación de las jugadas del alumno (con lecciones de prueba).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LessonError, PASS, checkLessonMove, passTurn } from "../src/lessons/index.js";
import type { Lesson } from "../src/lessons/index.js";

const base = {
  group: "tacticas",
  number: 1,
  title: "Prueba",
  summary: "Lección de prueba.",
  side: "w",
  goal: "Haz la jugada.",
  hints: [{ text: "Pista." }, { text: "Mueve la torre.", marks: { from: "d1", to: "d8" } }],
  success: "Bien hecho.",
  failure: "Esa no es.",
} as const;

/** Mate del pasillo: solo Td8 da mate. */
const mateIn1: Lesson = {
  ...base,
  id: "mate-1",
  fen: "6k1/5ppp/8/8/8/8/r4PPP/3R2K1 w - - 0 1",
  steps: [{ kind: "mate", mistakes: { g2g4: "El peón no ataca al rey." } }],
};

/** Horquilla: Cc7+, Rd7 (fija), Cxd5. */
const fork: Lesson = {
  ...base,
  id: "fork",
  fen: "4k3/pp3ppp/8/1N1q4/8/8/PPP2PPP/4K3 w - - 0 1",
  steps: [
    { kind: "moves", accept: { b5c7: "e8d7" }, mistakes: { b5d6: "No ataca a la dama." } },
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
    assert.deepEqual(checkLessonMove(fork, [], "b5a7"), { kind: "fallo", reason: "Esa no es." });
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

  it("usa los motivos propios solo en su paso", () => {
    assert.deepEqual(checkLessonMove(fork, [], "b5d6"), { kind: "fallo", reason: "No ataca a la dama." });
    assert.deepEqual(checkLessonMove(fork, ["b5c7", "e8d7"], "c7e6"), { kind: "fallo", reason: "Esa no es." });
  });

  it("lanza LessonError si el turno de la FEN no es el del alumno", () => {
    assert.throws(() => checkLessonMove({ ...mateIn1, side: "b" }, [], "d1d8"), LessonError);
  });

  it("lanza LessonError si el último paso trae respuesta del rival", () => {
    const broken: Lesson = { ...fork, steps: [{ kind: "moves", accept: { b5c7: "e8d7" } }] };
    assert.throws(() => checkLessonMove(broken, [], "b5c7"), LessonError);
  });

  it("lanza LessonError si la lección ya está resuelta", () => {
    assert.throws(() => checkLessonMove(mateIn1, ["d1d8"], "g8h8"), LessonError);
  });
});

/** Torre que captura tres peones; el rival no mueve entre capturas. */
const rookCaptures: Lesson = {
  ...base,
  id: "torre",
  fen: "k7/8/8/3p3p/8/8/7p/K2R4 w - - 0 1",
  steps: [{ kind: "capture" }, { kind: "capture" }, { kind: "capture", mistakes: { h5h4: "Así no capturas." } }],
};

/** Caballo que llega a f5, con la casilla marcada. */
const knightReach: Lesson = {
  ...base,
  id: "caballo",
  fen: "7k/8/8/8/3N4/8/P7/K7 w - - 0 1",
  steps: [{ kind: "reach", target: "f5", marked: true, mistakes: { d4e6: "Esa no es la casilla objetivo." } }],
};

/** Peón: avanza a e3 y luego captura en f4. */
const pawnTwoSteps: Lesson = {
  ...base,
  id: "peon",
  fen: "7k/8/8/8/5n2/8/4P3/K7 w - - 0 1",
  steps: [{ kind: "reach", target: "e3", marked: false }, { kind: "capture" }],
};

/** Torre que da jaque. */
const giveCheck: Lesson = {
  ...base,
  id: "jaque",
  fen: "4k3/8/8/8/8/8/8/R3K3 w - - 0 1",
  steps: [{ kind: "check" }],
};

describe("checkLessonMove con objetivos de casilla, capturas y jaque", () => {
  it("acepta la jugada que llega a la casilla objetivo", () => {
    assert.deepEqual(checkLessonMove(knightReach, [], "d4f5"), { kind: "correcto" });
  });

  it("rechaza una jugada que no llega a la casilla objetivo, con su motivo", () => {
    assert.deepEqual(checkLessonMove(knightReach, [], "d4e6"), { kind: "fallo", reason: "Esa no es la casilla objetivo." });
    assert.deepEqual(checkLessonMove(knightReach, [], "d4b5"), { kind: "fallo", reason: "Esa no es." });
  });

  it("tras una captura que no es la última, sigue sin respuesta del rival", () => {
    assert.deepEqual(checkLessonMove(rookCaptures, [], "d1d5"), { kind: "sigue", step: 2 });
    assert.deepEqual(checkLessonMove(rookCaptures, ["d1d5", PASS], "d5h5"), { kind: "sigue", step: 3 });
    assert.deepEqual(checkLessonMove(rookCaptures, ["d1d5", PASS, "d5h5", PASS], "h5h2"), { kind: "correcto" });
  });

  it("rechaza una jugada que no captura en un paso de captura", () => {
    assert.deepEqual(checkLessonMove(rookCaptures, [], "d1h1"), { kind: "fallo", reason: "Esa no es." });
    assert.deepEqual(checkLessonMove(rookCaptures, ["d1d5", PASS, "d5h5", PASS], "h5h4"), { kind: "fallo", reason: "Así no capturas." });
  });

  it("encadena una llegada y una captura", () => {
    assert.deepEqual(checkLessonMove(pawnTwoSteps, [], "e2e3"), { kind: "sigue", step: 2 });
    assert.deepEqual(checkLessonMove(pawnTwoSteps, [], "e2e4"), { kind: "fallo", reason: "Esa no es." });
    assert.deepEqual(checkLessonMove(pawnTwoSteps, ["e2e3", PASS], "e3f4"), { kind: "correcto" });
  });

  it("acepta una jugada que da jaque y rechaza la que no", () => {
    assert.deepEqual(checkLessonMove(giveCheck, [], "a1a8"), { kind: "correcto" });
    assert.deepEqual(checkLessonMove(giveCheck, [], "a1a7"), { kind: "fallo", reason: "Esa no es." });
  });

  it("lanza LessonError si las jugadas previas no siguen un paso sin respuesta", () => {
    assert.throws(() => checkLessonMove(rookCaptures, ["d1h1", PASS], "h1h2"), LessonError);
    assert.throws(() => checkLessonMove(rookCaptures, ["d1d5", "a8b8"], "d5h5"), LessonError);
  });
});

describe("passTurn", () => {
  it("devuelve el turno al bando que acaba de mover y quita la casilla al paso", () => {
    assert.equal(passTurn("7k/8/8/8/4P3/8/8/K7 b - e3 0 1", "w"), "7k/8/8/8/4P3/8/8/K7 w - - 0 1");
  });

  it("no cambia una FEN que ya da el turno a ese bando", () => {
    assert.equal(passTurn("7k/8/8/8/8/8/P7/K7 w - - 3 9", "w"), "7k/8/8/8/8/8/P7/K7 w - - 3 9");
  });
});
