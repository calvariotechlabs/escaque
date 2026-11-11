// Coach en la interfaz: qué jugada se revisa, vista del informe y marcas del tablero.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeMove } from "../src/coach/index.js";
import { Game } from "../src/ui/game.js";
import { barPercent, moveLabel, reportView, reviewJob, reviewKey, withCoachMarks } from "../src/ui/coach.js";

function play(game: Game, moves: string[]): void {
  for (const m of moves) assert.ok(game.play(m.slice(0, 2), m.slice(2, 4)), m);
}

// 1.e4 e5 2.Ac4 Cc6 3.Dh5 Cf6 4.Cf3 (la partida del diseño)
const DESIGN = ["e2e4", "e7e5", "f1c4", "b8c6", "d1h5", "g8f6", "g1f3"];

describe("reviewJob", () => {
  it("no hay nada que revisar antes de la primera jugada", () => {
    assert.equal(reviewJob(new Game(), null), null);
    assert.equal(reviewJob(new Game(), "w"), null);
  });

  it("a dos jugadores revisa siempre la última jugada, de cualquier bando", () => {
    const game = new Game();
    play(game, DESIGN);
    const job = reviewJob(game, null)!;
    assert.equal(job.ply, 7);
    assert.equal(job.move, "g1f3");
    assert.deepEqual(job.moves, DESIGN.slice(0, 6));
    assert.equal(job.label, "4. Cf3");
    play(game, ["c6d4"]);
    assert.equal(reviewJob(game, null)!.label, "4… Cd4");
  });

  it("contra la máquina solo revisa las jugadas de la persona", () => {
    const game = new Game();
    play(game, ["e2e4", "e7e5"]);
    // La persona juega con blancas: tras la respuesta de la máquina se sigue enseñando su e4.
    assert.equal(reviewJob(game, "w")!.move, "e2e4");
    // Con negras, la primera jugada de la máquina no se revisa, y la segunda sí es de la persona.
    assert.equal(reviewJob(game, "b")!.move, "e7e5");
    const first = new Game();
    play(first, ["e2e4"]);
    assert.equal(reviewJob(first, "b"), null);
  });

  it("sigue la jugada en pantalla al deshacer y rehacer", () => {
    const game = new Game();
    play(game, DESIGN);
    game.goTo(4);
    assert.equal(reviewJob(game, null)!.move, "b8c6");
    game.goTo(0);
    assert.equal(reviewJob(game, null), null);
  });

  it("la clave distingue partidas y jugadas, y la repite para la misma", () => {
    const a = new Game();
    const b = new Game();
    play(a, ["e2e4"]);
    play(b, ["e2e4"]);
    assert.equal(reviewKey(reviewJob(a, null)!), reviewKey(reviewJob(b, null)!));
    const c = new Game();
    play(c, ["d2d4"]);
    assert.notEqual(reviewKey(reviewJob(a, null)!), reviewKey(reviewJob(c, null)!));
  });

  it("una partida que empieza con negras numera bien la primera jugada", () => {
    const game = new Game("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");
    play(game, ["e7e5"]);
    assert.equal(moveLabel(game, 1), "1… e5");
  });
});

describe("reportView", () => {
  const game = new Game();
  play(game, DESIGN.slice(0, 6));
  const report = analyzeMove({ fen: game.startFen, moves: DESIGN.slice(0, 6) }, "g1f3", { limits: { maxDepth: 3 } });

  it("da el mismo veredicto y avisos que el diseño aprobado", () => {
    const view = reportView(report, "4. Cf3");
    assert.equal(view.verdictTitle, "Error grave.");
    assert.equal(view.severity, "grave");
    assert.equal(view.best, "Dxf7#");
    assert.equal(view.before.value, "Mate en 1");
    assert.equal(view.before.rest, " para las blancas");
    assert.equal(view.before.percent, 100);
    assert.match(view.after.value, /^−\d,\d$/);
    assert.match(view.after.rest, /a favor de las negras/);
    assert.ok(view.after.percent < 30);
    const mate = view.findings.find((f) => f.kind === "mate-en-1")!;
    assert.equal(mate.san, "Dxf7#");
    assert.ok(mate.message.includes("Dxf7#"));
    assert.equal(mate.label, "mate en 1 con Dxf7#");
  });

  it("no enseña «mejor jugada» si es la que se hizo", () => {
    const g = new Game();
    const ok = analyzeMove({ fen: g.startFen, moves: [] }, "e2e4", { limits: { maxDepth: 3 } });
    const view = reportView(ok, "1. e4");
    assert.equal(view.best === null, ok.best.uci === ok.move.uci);
    assert.notEqual(view.severity, "grave");
  });
});

describe("barPercent", () => {
  it("50 en igualdad, 0 y 100 con mate, y crece sin salirse", () => {
    assert.equal(barPercent({ cp: 0, mate: null }), 50);
    assert.equal(barPercent({ cp: 0, mate: { winner: "w", moves: 1 } }), 100);
    assert.equal(barPercent({ cp: 0, mate: { winner: "b", moves: 3 } }), 0);
    assert.equal(barPercent({ cp: 30, mate: null }), 53);
    assert.equal(barPercent({ cp: 120, mate: null }), 62);
    assert.ok(barPercent({ cp: -580, mate: null }) < 20);
    assert.ok(barPercent({ cp: 9000, mate: null }) <= 98);
    assert.ok(barPercent({ cp: 600, mate: null }) > barPercent({ cp: 100, mate: null }));
  });
});

describe("withCoachMarks", () => {
  it("suma las marcas del aviso a las del tablero sin tocarlas ni repetirlas", () => {
    const base = new Map<string, ("selected" | "target" | "last-move")[]>([["h5", ["last-move"]]]);
    const merged = withCoachMarks(base, [
      { square: "h5", mark: "selected" },
      { square: "f7", mark: "capture" },
      { square: "f7", mark: "capture" },
    ]);
    assert.deepEqual(merged.get("h5"), ["last-move", "selected"]);
    assert.deepEqual(merged.get("f7"), ["capture"]);
    assert.deepEqual(base.get("h5"), ["last-move"]);
  });
});
