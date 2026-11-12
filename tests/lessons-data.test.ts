// Lecciones: los datos son correctos según el núcleo y Alfil Beta.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Position } from "../src/core/index.js";
import { MATE_SCORE, scoreMoves, search } from "../src/engine/index.js";
import { LESSONS, checkLessonMove, lessonById } from "../src/lessons/index.js";
import type { Lesson } from "../src/lessons/index.js";

const SQUARE = /^[a-h][1-8]$/;
/** Frase completa: empieza en mayúscula (o signo de apertura) y acaba en punto. */
const SENTENCE = /^[¿¡A-ZÁÉÍÓÚÑ].*\.$/s;
const sentences = (text: string): number => text.split(/\.(?:\s|$)/).filter((s) => s.trim() !== "").length;

/** Posición tras jugar una lista de jugadas UCI. */
function positionAfter(lesson: Lesson, moves: readonly string[]): Position {
  const position = Position.fromFen(lesson.fen);
  for (const uci of moves) {
    const move = position.moveFromUci(uci);
    assert.ok(move, `${lesson.id}: ${uci} debe ser legal tras ${moves.join(" ")}`);
    position.makeMove(move);
  }
  return position;
}

/** Jugadas que fuerzan mate en `n` jugadas propias (búsqueda de 2n − 1 medias jugadas). */
function forcedMates(position: Position, n: number): string[] {
  const plies = 2 * n - 1;
  return scoreMoves(position, plies)
    .filter((m) => m.score >= MATE_SCORE - plies)
    .map((m) => m.uci)
    .sort();
}

const endsInMate = (lesson: Lesson): boolean => lesson.steps[lesson.steps.length - 1]?.kind === "mate";

/** Recorre todas las ramas aceptadas: llama a `visit` en cada paso con las jugadas previas. */
function walk(lesson: Lesson, visit: (played: readonly string[], index: number) => void, played: string[] = []): void {
  const index = played.length / 2;
  const step = lesson.steps[index];
  if (step === undefined) return;
  visit(played, index);
  if (step.kind === "moves") {
    for (const [uci, reply] of Object.entries(step.accept)) {
      if (reply !== null) walk(lesson, visit, [...played, uci, reply]);
    }
  }
}

describe("lista de lecciones", () => {
  it("tiene entre 5 y 6 lecciones numeradas en orden", () => {
    assert.ok(LESSONS.length >= 5 && LESSONS.length <= 6);
    LESSONS.forEach((lesson, i) => assert.equal(lesson.number, i + 1));
  });

  it("usa ids estables, únicos y en minúsculas", () => {
    const ids = LESSONS.map((l) => l.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) assert.match(id, /^[a-z0-9-]+$/);
  });

  it("encuentra cada lección por su id", () => {
    for (const lesson of LESSONS) assert.equal(lessonById(lesson.id), lesson);
    assert.equal(lessonById("no-existe"), undefined);
  });
});

for (const lesson of LESSONS) {
  describe(`lección ${lesson.number}: ${lesson.title}`, () => {
    it("parte de una FEN válida con el turno del alumno y sin partida terminada", () => {
      const position = Position.fromFen(lesson.fen);
      assert.equal(position.turn, lesson.side);
      assert.equal(position.status().kind, "ongoing");
    });

    it("tiene textos completos con punto final y una explicación de como mucho 2 frases", () => {
      assert.ok(lesson.title.length > 0 && !lesson.title.endsWith("."));
      for (const text of [lesson.summary, lesson.goal, lesson.success, lesson.failure, ...lesson.steps.flatMap((step) => Object.values(step.mistakes ?? {}))]) {
        assert.match(text, SENTENCE);
      }
      for (const hint of lesson.hints) assert.match(hint.text, SENTENCE);
      assert.ok(sentences(lesson.success) <= 2, `explicación demasiado larga: ${lesson.success}`);
    });

    it("tiene de 1 a 2 pasos y el de mate, si lo hay, es el último", () => {
      assert.ok(lesson.steps.length >= 1 && lesson.steps.length <= 2);
      lesson.steps.forEach((step, i) => {
        if (step.kind === "mate") assert.equal(i, lesson.steps.length - 1);
        else if (step.kind === "moves") {
          const replies = Object.values(step.accept);
          assert.ok(replies.length > 0);
          const last = i === lesson.steps.length - 1;
          for (const reply of replies) assert.equal(reply === null, last);
        }
      });
    });

    it("tiene de 2 a 3 pistas y la última marca una jugada que resuelve el primer paso", () => {
      assert.ok(lesson.hints.length >= 2 && lesson.hints.length <= 3);
      lesson.hints.slice(0, -1).forEach((hint) => assert.equal(hint.marks, undefined));
      const marks = lesson.hints[lesson.hints.length - 1]!.marks;
      assert.ok(marks, "la última pista marca casillas");
      assert.match(marks.from, SQUARE);
      assert.match(marks.to, SQUARE);
      const uci = marks.from + marks.to + (marks.promotion ?? "");
      assert.ok(Position.fromFen(lesson.fen).moveFromUci(uci), `${uci} es legal`);
      assert.notEqual(checkLessonMove(lesson, [], uci).kind, "fallo", "la jugada marcada resuelve el primer paso");
    });

    it("las jugadas típicas de cada paso son legales ahí y fallan con su motivo", () => {
      walk(lesson, (played, index) => {
        const position = positionAfter(lesson, played);
        for (const [uci, reason] of Object.entries(lesson.steps[index]!.mistakes ?? {})) {
          assert.ok(position.moveFromUci(uci), `${uci} es legal en el paso ${index + 1}`);
          assert.deepEqual(checkLessonMove(lesson, played, uci), { kind: "fallo", reason });
        }
      });
    });

    it("cada respuesta del rival es legal y es su mejor defensa según el motor", () => {
      walk(lesson, (played, index) => {
        const step = lesson.steps[index]!;
        if (step.kind !== "moves") return;
        for (const [uci, reply] of Object.entries(step.accept)) {
          if (reply === null) continue;
          const position = positionAfter(lesson, [...played, uci]);
          assert.ok(position.moveFromUci(reply), `${reply} es legal`);
          if (endsInMate(lesson)) {
            // Todas las defensas pierden: la respuesta debe ser de las que más aguantan.
            const scores = scoreMoves(position, 2 * (lesson.steps.length - index - 1));
            const best = Math.max(...scores.map((s) => s.score));
            assert.equal(scores.find((s) => s.uci === reply)?.score, best, `${reply} aguanta lo máximo tras ${uci}`);
          } else {
            assert.equal(search(position, { maxDepth: 4 }).best, reply, `${reply} es la elección del motor tras ${uci}`);
          }
        }
      });
    });

    if (endsInMate(lesson)) {
      it("acepta exactamente las jugadas que fuerzan el mate en las jugadas que quedan", () => {
        walk(lesson, (played, index) => {
          const position = positionAfter(lesson, played);
          const remaining = lesson.steps.length - index;
          const step = lesson.steps[index]!;
          const expected = forcedMates(position, remaining);
          assert.ok(expected.length > 0, "hay solución");
          if (step.kind === "moves") {
            assert.deepEqual(Object.keys(step.accept).sort(), expected);
            assert.equal(forcedMates(position, 1).length, 0, "no hay un mate más corto que la lección rechazaría");
          }
          for (const uci of expected) assert.notEqual(checkLessonMove(lesson, played, uci).kind, "fallo");
        });
      });
    }
  });
}

describe("comprobaciones propias de cada lección", () => {
  const get = (id: string): Lesson => {
    const lesson = lessonById(id);
    assert.ok(lesson, id);
    return lesson;
  };

  it("enroque: el corto es legal y el largo no, porque el rey pasaría por d1, atacada", () => {
    const position = Position.fromFen(get("enroque").fen);
    assert.ok(position.moveFromUci("e1g1"));
    assert.equal(position.moveFromUci("e1c1"), null);
    assert.deepEqual(checkLessonMove(get("enroque"), [], "e1g1"), { kind: "correcto" });
  });

  it("captura al paso: la captura quita el peón de d5 y es la mejor jugada", () => {
    const lesson = get("captura-al-paso");
    const position = positionAfter(lesson, ["e5d6"]);
    assert.equal(position.pieceAt(0x33), null, "d5 queda vacía");
    assert.equal(search(Position.fromFen(lesson.fen), { maxDepth: 5 }).best, "e5d6");
  });

  it("corona sin ahogar: coronar a dama ahoga al rey negro", () => {
    const position = positionAfter(get("corona-sin-ahogar"), ["c7c8q"]);
    assert.equal(position.status().kind, "stalemate");
  });

  it("horquilla: el jaque de caballo es la mejor jugada y acaba ganando la dama", () => {
    const lesson = get("horquilla");
    assert.equal(search(Position.fromFen(lesson.fen), { maxDepth: 4 }).best, "b5c7");
    const end = positionAfter(lesson, ["b5c7", "e8d7", "c7d5"]);
    const queens = [...Array(128).keys()].filter((sq) => (sq & 0x88) === 0 && end.pieceAt(sq)?.type === "q");
    assert.equal(queens.length, 0, "la dama negra ha caído");
  });
});
