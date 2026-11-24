// Repaso de la partida: jugadas, curva de evaluación, errores clave, resumen y textos (sin DOM).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { CoachReport, Verdict } from "../src/coach/index.js";
import { toEvaluation } from "../src/coach/index.js";
import { MATE_SCORE } from "../src/engine/index.js";
import { Game } from "../src/ui/game.js";
import {
  AnalysisGuard,
  curveLabel,
  curveNote,
  curveView,
  keyMoments,
  listMarker,
  nextToAnalyze,
  progressText,
  reviewIntro,
  reviewMoves,
  spokenPrefix,
  stepKeyError,
  tally,
} from "../src/ui/review.js";

function play(game: Game, moves: string[]): void {
  for (const m of moves) assert.ok(game.play(m.slice(0, 2), m.slice(2, 4), (m[4] as "q" | undefined) ?? undefined), m);
}

// Mate del pastor: 1.e4 e5 2.Ac4 Cc6 3.Dh5 Cf6 4.Dxf7#
const SCHOLAR = ["e2e4", "e7e5", "f1c4", "b8c6", "d1h5", "g8f6", "h5f7"];

/** Centipeones vistos por las blancas → evaluación; ±10 000 es mate en 1. */
const evaluation = (cp: number) => toEvaluation(Math.abs(cp) >= 10_000 ? Math.sign(cp) * (MATE_SCORE - 1) : cp, "w");

/** Informe falso: solo lo que usa el repaso. `before` y `after` en centipeones vistos por las blancas. */
function report(color: "w" | "b", verdict: Verdict, before: number, after: number, san = "e4"): CoachReport {
  const title = { mejor: "Mejor jugada", buena: "Buena jugada", imprecision: "Imprecisión", error: "Error", "error-grave": "Error grave" }[verdict];
  return {
    color,
    move: { uci: "e2e4", san },
    best: { uci: "e2e4", san },
    alternative: verdict === "mejor" ? null : { uci: "d2d4", san: "d4" },
    before: evaluation(before),
    after: evaluation(after),
    loss: 0,
    verdict,
    category: verdict === "mejor" ? "correcta" : "posicional",
    title,
    summary: "Resumen.",
    findings: [],
    why: "",
    line: "",
    lines: { best: ["e2e4"], played: ["e2e4"] },
    depth: 4,
  };
}

function scholarGame(): Game {
  const game = new Game();
  play(game, SCHOLAR);
  return game;
}

/** Informes del mate del pastor: 3... Cf6 es error grave de las negras y 2... Cc6 imprecisión. */
function scholarReports(): Map<number, CoachReport> {
  return new Map<number, CoachReport>([
    [1, report("w", "mejor", 30, 30)],
    [2, report("b", "buena", 30, 40)],
    [3, report("w", "buena", 40, 40)],
    [4, report("b", "imprecision", 40, 120)],
    [5, report("w", "mejor", 120, 110)],
    [6, report("b", "error-grave", 110, 1590)],
    [7, report("w", "mejor", 1590, 0)],
  ]);
}

describe("reviewMoves", () => {
  it("lista todas las jugadas con número, bando, SAN española y la petición para el coach", () => {
    const moves = reviewMoves(scholarGame());
    assert.equal(moves.length, 7);
    assert.deepEqual(
      moves.map((m) => m.label),
      ["1. e4", "1... e5", "2. Ac4", "2... Cc6", "3. Dh5", "3... Cf6", "4. Dxf7#"],
    );
    assert.equal(moves[5]!.color, "b");
    assert.equal(moves[6]!.job.move, "h5f7");
    assert.deepEqual(moves[6]!.job.moves, SCHOLAR.slice(0, 6));
    assert.equal(moves[0]!.from, "e2");
    assert.equal(moves[0]!.to, "e4");
  });

  it("incluye las jugadas que se pueden rehacer aunque la partida esté a medias en pantalla", () => {
    const game = scholarGame();
    game.goTo(3);
    assert.equal(reviewMoves(game).length, 7);
  });

  it("numera bien una partida que empieza con las negras", () => {
    const game = new Game("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1");
    play(game, ["e7e5", "g1f3"]);
    assert.deepEqual(reviewMoves(game).map((m) => m.label), ["1... e5", "2. Cf3"]);
  });
});

describe("spokenPrefix", () => {
  it("dice la jugada y el bando antes del veredicto", () => {
    const moves = reviewMoves(scholarGame());
    assert.equal(spokenPrefix(moves[4]!), "3. Dh5, blancas. ");
    assert.equal(spokenPrefix(moves[5]!), "3... Cf6, negras. ");
  });
});

describe("keyMoments", () => {
  it("separa errores clave (error y error grave) de imprecisiones, en el orden de la partida", () => {
    const { key, minor } = keyMoments(reviewMoves(scholarGame()), scholarReports());
    assert.deepEqual(key.map((k) => k.ply), [6]);
    assert.deepEqual(minor.map((k) => k.ply), [4]);
    assert.equal(key[0]!.label, "3... Cf6");
    assert.equal(key[0]!.title, "Error grave");
    assert.equal(key[0]!.side, "negras");
    assert.equal(key[0]!.evaluation, "+1,1 → +15,9");
    assert.equal(key[0]!.marker, "error");
    assert.equal(minor[0]!.marker, "imprecision");
  });

  it("solo cuenta las jugadas ya revisadas", () => {
    const reports = scholarReports();
    reports.delete(6);
    assert.deepEqual(keyMoments(reviewMoves(scholarGame()), reports).key, []);
  });
});

describe("stepKeyError", () => {
  const key = [{ ply: 6 }, { ply: 12 }, { ply: 20 }];
  it("salta al siguiente y al anterior error clave desde la jugada seleccionada", () => {
    assert.equal(stepKeyError(1, key, 1), 6);
    assert.equal(stepKeyError(6, key, 1), 12);
    assert.equal(stepKeyError(13, key, -1), 12);
    assert.equal(stepKeyError(12, key, -1), 6);
  });
  it("no hay salto pasado el último ni antes del primero", () => {
    assert.equal(stepKeyError(20, key, 1), null);
    assert.equal(stepKeyError(6, key, -1), null);
    assert.equal(stepKeyError(3, [], 1), null);
  });
});

describe("tally", () => {
  it("cuenta cada veredicto por bando", () => {
    const counts = tally(reviewMoves(scholarGame()), scholarReports());
    assert.deepEqual(counts.w, { mejor: 3, buena: 1, imprecision: 0, error: 0, "error-grave": 0 });
    assert.deepEqual(counts.b, { mejor: 0, buena: 1, imprecision: 1, error: 0, "error-grave": 1 });
  });
});

describe("listMarker", () => {
  it("triángulo para error y error grave, círculo para imprecisión y nada para el resto", () => {
    assert.equal(listMarker(undefined), null);
    assert.equal(listMarker(report("w", "buena", 0, 0)), null);
    assert.deepEqual(listMarker(report("w", "imprecision", 0, 0)), { marker: "imprecision", text: "imprecisión" });
    assert.deepEqual(listMarker(report("w", "error", 0, 0)), { marker: "error", text: "error" });
    assert.deepEqual(listMarker(report("w", "error-grave", 0, 0)), { marker: "error", text: "error grave" });
  });
});

describe("nextToAnalyze", () => {
  it("primero la jugada seleccionada si falta; si no, la primera que falte", () => {
    const moves = reviewMoves(scholarGame());
    const reports = new Map<number, CoachReport>([[1, report("w", "mejor", 0, 0)]]);
    assert.equal(nextToAnalyze(moves, reports, 5), 5);
    assert.equal(nextToAnalyze(moves, reports, 1), 2);
    assert.equal(nextToAnalyze(moves, scholarReports(), 3), null);
  });
});

describe("curveView", () => {
  it("usa la escala del diseño: igualdad en el centro, márgenes de 18 y una x por media jugada", () => {
    const view = curveView(reviewMoves(scholarGame()), scholarReports());
    // x = 16 + ply·608/7; y = 100 − 82·(2E − 1). La partida empieza en +0,3.
    assert.match(view.area, /^M0 200 L0 \d+\.\d L16\.0 \d+\.\d L102\.9 /);
    assert.ok(view.area.endsWith("L624.0 100.0 L640.0 100.0 L640.0 200 Z"));
    assert.equal(view.pending, null);
    assert.equal(view.veil, null);
  });

  it("pone una marca por imprecisión o error, clara para las blancas y oscura para las negras", () => {
    const view = curveView(reviewMoves(scholarGame()), scholarReports());
    assert.deepEqual(
      view.marks.map((m) => [m.ply, m.marker, m.color]),
      [
        [4, "imprecision", "b"],
        [6, "error", "b"],
      ],
    );
    const six = view.marks[1]!;
    assert.equal(six.left, ((16 + (6 * 608) / 7) / 640) * 100);
    assert.ok(six.top < 15, "+15,9 queda cerca del borde de arriba");
  });

  it("con el análisis a medias dibuja hasta la última jugada seguida revisada y raya el resto", () => {
    const reports = scholarReports();
    reports.delete(4);
    const view = curveView(reviewMoves(scholarGame()), reports);
    const x3 = 16 + (3 * 608) / 7;
    assert.ok(view.area.endsWith(`L${x3.toFixed(1)} 200 Z`), view.area);
    assert.equal(view.pending, `M${x3.toFixed(1)} 100.0 L624.0 100.0`);
    assert.equal(view.veil, (x3 / 640) * 100);
    assert.deepEqual(view.marks, []);
  });

  it("numera el eje cada cinco jugadas, o más espaciado en partidas largas", () => {
    const short = curveView(reviewMoves(scholarGame()), scholarReports());
    assert.deepEqual(short.axis, []);
    const game = new Game();
    // 26 medias jugadas de peones: 13 jugadas.
    const moves = ["a2a3", "a7a6", "b2b3", "b7b6", "c2c3", "c7c6", "d2d3", "d7d6", "e2e3", "e7e6", "f2f3", "f7f6", "g2g3", "g7g6", "h2h3", "h7h6"];
    play(game, [...moves, "a3a4", "a6a5", "b3b4", "b6b5", "c3c4", "c6c5", "d3d4", "d6d5", "e3e4", "e6e5"]);
    const list = reviewMoves(game);
    const view = curveView(list, new Map(list.map((m) => [m.ply, report(m.color, "buena", 0, 0)])));
    assert.deepEqual(view.axis.map((a) => a.text), ["5", "10"]);
    assert.equal(view.axis[0]!.left, ((16 + (9 * 608) / list.length) / 640) * 100);
  });
});

describe("textos", () => {
  it("cabecera del repaso, con el resultado y cuántas jugadas se revisan", () => {
    const game = scholarGame();
    assert.equal(
      reviewIntro(game.status, 7, 7),
      "Ganan las blancas por jaque mate. Alfil Beta ha revisado las 7 jugadas. Elige una jugada o salta de error en error.",
    );
    assert.equal(
      reviewIntro(game.status, 7, 3),
      "Ganan las blancas por jaque mate. Alfil Beta está revisando las 7 jugadas. Ya puedes recorrer las que estén listas.",
    );
    assert.equal(reviewIntro({ kind: "stalemate" }, 1, 1).split(".")[0], "Tablas por ahogado");
    assert.equal(reviewIntro({ kind: "stalemate" }, 1, 1), "Tablas por ahogado. Alfil Beta ha revisado la jugada. Elige una jugada o salta de error en error.");
  });

  it("progreso del análisis", () => {
    assert.equal(progressText(24, 53), "Jugada 24 de 53.");
  });

  it("resumen escrito de la curva con el análisis terminado", () => {
    const moves = reviewMoves(scholarGame());
    assert.equal(
      curveLabel(moves, scholarReports(), { kind: "checkmate", winner: "w" }),
      "Curva de evaluación de la partida, vista por las blancas. Empieza en igualdad. " +
        "La mayor ventaja de las blancas es +15,9 tras 3... Cf6. " +
        "Acaba con jaque mate de las blancas en la jugada 4. Hay 2 jugadas con imprecisión o error.",
    );
  });

  it("resumen escrito de la curva con el análisis a medias", () => {
    const moves = reviewMoves(scholarGame());
    const reports = scholarReports();
    reports.delete(5);
    assert.equal(
      curveLabel(moves, reports, { kind: "checkmate", winner: "w" }),
      "Curva de evaluación de la partida, vista por las blancas. Revisadas 4 de 7 jugadas; el resto sigue pendiente.",
    );
  });

  it("nombra la ventaja de las negras y una sola jugada con error", () => {
    const game = new Game();
    play(game, ["f2f3", "e7e5", "g2g4", "d8h4"]);
    const moves = reviewMoves(game);
    const reports = new Map<number, CoachReport>([
      [1, report("w", "imprecision", 20, -40)],
      [2, report("b", "mejor", -40, -50)],
      [3, report("w", "mejor", -50, -10000)],
      [4, report("b", "mejor", -10000, 0)],
    ]);
    assert.equal(
      curveLabel(moves, reports, { kind: "checkmate", winner: "b" }),
      "Curva de evaluación de la partida, vista por las blancas. Empieza en igualdad. " +
        "La mayor ventaja de las negras es −0,5 tras 1... e5. " +
        "Acaba con jaque mate de las negras en la jugada 2. Hay 1 jugada con imprecisión o error.",
    );
    assert.equal(curveNote(moves, reports, { kind: "checkmate", winner: "b" }), "Máxima ventaja negra antes del mate: −0,5 tras 1... e5.");
    // Un mate que se escapó no cuenta: «antes del mate» solo si la partida acabó en mate.
    assert.equal(curveNote(moves, reports, { kind: "threefold-repetition" }), "Máxima ventaja negra: −0,5 tras 1... e5.");
  });

  it("nota bajo la curva con la mayor ventaja", () => {
    assert.equal(curveNote(reviewMoves(scholarGame()), scholarReports(), { kind: "stalemate" }), "Máxima ventaja blanca: +15,9 tras 3... Cf6.");
  });
});

describe("AnalysisGuard (integridad del estado en el repaso, RC-06)", () => {
  it("el informe de una petición invalidada (otra partida, pantalla oculta) se descarta", () => {
    const guard = new AnalysisGuard();
    const old = guard.begin();
    assert.equal(guard.busy, true);
    guard.invalidate(); // se carga otra partida mientras el coach pensaba
    assert.equal(guard.busy, false);
    assert.equal(guard.finish(old), false);
    assert.equal(guard.accepts(old), false);
    const next = guard.begin();
    assert.equal(guard.finish(old), false, "la respuesta vieja no cierra la petición nueva");
    assert.equal(guard.busy, true);
    assert.equal(guard.finish(next), true);
    assert.equal(guard.busy, false);
  });

  it("una petición que termina en orden libera el turno", () => {
    const guard = new AnalysisGuard();
    const t = guard.begin();
    assert.equal(guard.accepts(t), true);
    assert.equal(guard.finish(t), true);
    assert.equal(guard.busy, false);
  });
});
