// Coach mejorado en la interfaz (CAL-394): bloque de la alternativa, posición
// de antes de la jugada revisada, flechas del tablero y pistas.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeMove } from "../src/coach/index.js";
import type { Hint } from "../src/coach/index.js";
import { Game } from "../src/ui/game.js";
import { arrowShapes } from "../src/ui/arrows.js";
import { COACH_TEXT, hintMarks, hintsView, reportView, reviewJob, reviewPosition } from "../src/ui/coach.js";
import type { HintsState } from "../src/ui/coach.js";

function play(game: Game, moves: string[]): void {
  for (const m of moves) assert.ok(game.play(m.slice(0, 2), m.slice(2, 4)), m);
}

const LEGAL = ["e2e4", "e7e5", "g1f3", "d7d6", "f1c4", "c8g4", "b1c3", "g7g6"];

describe("reportView con la alternativa", () => {
  it("lleva el porqué, la línea y las dos flechas", () => {
    const game = new Game();
    play(game, LEGAL);
    const report = analyzeMove({ fen: game.startFen, moves: LEGAL }, "h2h3", { limits: { maxDepth: 4 } });
    const view = reportView(report, "5. h3");
    assert.equal(view.best, "Cxe5");
    assert.match(view.why, /^Cxe5 gana un peón\./);
    assert.match(view.line, /^5\. Cxe5 dxe5 6\. Dxg4/);
    assert.deepEqual(view.bestArrow, { from: "f3", to: "e5" });
    assert.deepEqual(view.playedArrow, { from: "h2", to: "h3" });
  });

  it("sin alternativa si la jugada es la mejor", () => {
    const report = analyzeMove({ fen: new Game().startFen, moves: LEGAL }, "f3e5", { limits: { maxDepth: 4 } });
    const view = reportView(report, "5. Cxe5");
    assert.equal(view.best, null);
    assert.equal(view.bestArrow, null);
  });
});

describe("reviewPosition", () => {
  it("es la posición de antes de la jugada revisada, con la jugada anterior a ella", () => {
    const game = new Game();
    play(game, [...LEGAL, "h2h3", "g4f3"]);
    const job = reviewJob(game, "w")!;
    const before = reviewPosition(job);
    assert.equal(before.fen.split(" ")[0], "rn1qkbnr/ppp2p1p/3p2p1/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R");
    assert.deepEqual(before.lastMove, { from: "g7", to: "g6" });
  });

  it("al principio de la partida no hay jugada anterior", () => {
    const game = new Game();
    play(game, ["e2e4"]);
    assert.equal(reviewPosition(reviewJob(game, null)!).lastMove, null);
  });
});

describe("arrowShapes", () => {
  it("una flecha recta va del centro del origen hacia el destino, vista desde las blancas", () => {
    const [shape] = arrowShapes([{ from: "h2", to: "h3", kind: "tuya" }], "w");
    assert.equal(shape!.kind, "tuya");
    assert.match(shape!.d, /^M7\.50 6\.50 L7\.50 /);
  });

  it("la del caballo dobla en L por el lado largo", () => {
    const [shape] = arrowShapes([{ from: "f3", to: "e5", kind: "mejor" }], "w");
    // f3 (5,5 en pantalla) → e5 (4,3): primero sube dos y luego va a la izquierda.
    assert.match(shape!.d, /^M5\.50 5\.50 L5\.50 3\.50 L/);
  });

  it("gira con el tablero", () => {
    const [shape] = arrowShapes([{ from: "h2", to: "h3", kind: "mejor" }], "b");
    assert.match(shape!.d, /^M0\.50 1\.50 /);
  });

  it("descarta casillas que no existen", () => {
    assert.deepEqual(arrowShapes([{ from: "z9", to: "e5", kind: "mejor" }], "w"), []);
  });
});

const HINT: Hint = {
  move: { uci: "d1f3", san: "Qxf3" },
  idea: "Puedes recuperar material: una pieza del rival está en tu campo.",
  piece: "Mueve la dama de d1.",
  play: "Alfil Beta jugaría Dxf3.",
  from: "d1",
  to: "f3",
};
const state = (overrides: Partial<HintsState>): HintsState => ({ shown: 0, hint: null, pending: false, failed: false, ...overrides });

describe("hintsView", () => {
  it("antes de pedir: nota y botón de la primera", () => {
    const view = hintsView(state({}), "available");
    assert.equal(view.visible, true);
    assert.equal(view.note, COACH_TEXT.hintIntro);
    assert.deepEqual(view.items, []);
    assert.deepEqual(view.button, { text: "Pedir pista 1 de 3", disabled: false });
  });

  it("pensando: la barra y el botón inactivo, que no desaparece para no perder el foco", () => {
    const view = hintsView(state({ pending: true }), "available");
    assert.equal(view.busy, true);
    assert.deepEqual(view.button, { text: "Pedir pista 1 de 3", disabled: true });
    assert.equal(view.note, COACH_TEXT.hintBusy);
  });

  it("las pistas pedidas, de la primera a la última", () => {
    const view = hintsView(state({ shown: 2, hint: HINT }), "available");
    assert.deepEqual(view.items, [HINT.idea, HINT.piece]);
    assert.deepEqual(view.button, { text: "Pedir pista 3 de 3", disabled: false });
    assert.equal(view.note, null);
  });

  it("todas pedidas: la tercera dice la jugada y el botón queda desactivado", () => {
    const view = hintsView(state({ shown: 3, hint: HINT }), "available");
    assert.equal(view.items[2], "Alfil Beta jugaría Dxf3. Mira la flecha.");
    assert.deepEqual(view.button, { text: "No quedan más pistas", disabled: true });
  });

  it("mientras piensa la máquina, solo una nota", () => {
    const view = hintsView(state({ shown: 1, hint: HINT }), "waiting");
    assert.equal(view.note, COACH_TEXT.hintWaiting);
    assert.deepEqual(view.items, []);
    assert.equal(view.button, null);
  });

  it("con la partida terminada no se ve", () => {
    assert.equal(hintsView(state({}), "hidden").visible, false);
  });

  it("si falla, lo dice y deja volver a pedir", () => {
    const view = hintsView(state({ failed: true }), "available");
    assert.equal(view.note, COACH_TEXT.hintFailed);
    assert.deepEqual(view.button, { text: "Pedir pista 1 de 3", disabled: false });
  });
});

describe("hintMarks", () => {
  it("la pista 1 no marca nada, la 2 la pieza y la 3 añade la flecha", () => {
    assert.deepEqual(hintMarks(state({ shown: 1, hint: HINT })), { marks: [], arrow: null });
    assert.deepEqual(hintMarks(state({ shown: 2, hint: HINT })), { marks: [{ square: "d1", mark: "selected" }], arrow: null });
    assert.deepEqual(hintMarks(state({ shown: 3, hint: HINT })), {
      marks: [{ square: "d1", mark: "selected" }],
      arrow: { from: "d1", to: "f3" },
    });
  });
});
