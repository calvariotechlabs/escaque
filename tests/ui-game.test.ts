// Controlador de partida de la interfaz: jugadas por casillas, coronación, deshacer y lista de jugadas.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/ui/game.js";

describe("Game: posición y piezas", () => {
  it("empieza en la posición inicial con las blancas al mover", () => {
    const game = new Game();
    assert.equal(game.fen, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    assert.equal(game.turn, "w");
    assert.deepEqual(game.status, { kind: "ongoing" });
  });

  it("dice qué pieza hay en cada casilla", () => {
    const game = new Game();
    assert.deepEqual(game.pieceAt("g1"), { color: "w", type: "n" });
    assert.deepEqual(game.pieceAt("d8"), { color: "b", type: "q" });
    assert.equal(game.pieceAt("e4"), null);
  });

  it("rechaza una FEN mala", () => {
    assert.throws(() => new Game("esto no es una FEN"));
  });
});

describe("Game: destinos", () => {
  it("destinos de una pieza propia", () => {
    const game = new Game();
    assert.deepEqual(game.targets("g1"), ["f3", "h3"]);
    assert.deepEqual(game.targets("e2"), ["e3", "e4"]);
  });

  it("sin destinos para casillas vacías, piezas del rival o nombres raros", () => {
    const game = new Game();
    assert.deepEqual(game.targets("e4"), []);
    assert.deepEqual(game.targets("e7"), []);
    assert.deepEqual(game.targets("z9"), []);
  });

  it("una coronación sale una sola vez como destino", () => {
    const game = new Game("4k3/1P6/8/8/8/8/8/4K3 w - - 0 1");
    assert.deepEqual(game.targets("b7"), ["b8"]);
    assert.equal(game.isPromotion("b7", "b8"), true);
    assert.equal(game.isPromotion("e1", "e2"), false);
  });
});

describe("Game: jugar", () => {
  it("juega por casillas y devuelve el registro de la jugada", () => {
    const game = new Game();
    const record = game.play("g1", "f3");
    assert.ok(record !== null);
    assert.equal(record?.san, "Nf3");
    assert.equal(record?.color, "w");
    assert.equal(record?.piece, "n");
    assert.equal(record?.captured, null);
    assert.equal(game.turn, "b");
    assert.deepEqual(game.lastMove, { from: "g1", to: "f3" });
  });

  it("una jugada ilegal no cambia nada", () => {
    const game = new Game();
    assert.equal(game.play("e2", "e5"), null);
    assert.equal(game.play("e7", "e5"), null);
    assert.equal(game.turn, "w");
    assert.equal(game.history.length, 0);
    assert.equal(game.lastMove, null);
  });

  it("registra la pieza capturada, también al paso", () => {
    const game = new Game("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1");
    const record = game.play("e5", "d6");
    assert.equal(record?.san, "exd6");
    assert.equal(record?.captured, "p");
    assert.equal(game.pieceAt("d5"), null);
  });

  it("la coronación exige elegir pieza", () => {
    const game = new Game("4k3/1P6/8/8/8/8/8/4K3 w - - 0 1");
    assert.equal(game.play("b7", "b8"), null);
    const record = game.play("b7", "b8", "n");
    assert.equal(record?.san, "b8=N");
    assert.equal(record?.promotion, "n");
    assert.deepEqual(game.pieceAt("b8"), { color: "w", type: "n" });
  });

  it("no acepta pieza de coronación en una jugada normal", () => {
    const game = new Game();
    assert.equal(game.play("e2", "e4", "q"), null);
  });

  it("marca el rey en jaque", () => {
    const game = new Game();
    for (const [from, to] of [["f2", "f3"], ["e7", "e5"], ["g2", "g4"]] as const) game.play(from, to);
    assert.equal(game.checkSquare, null);
    const mate = game.play("d8", "h4");
    assert.equal(mate?.san, "Qh4#");
    assert.equal(game.inCheck, true);
    assert.equal(game.checkSquare, "e1");
    assert.deepEqual(game.status, { kind: "checkmate", winner: "b" });
  });

  it("no deja jugar con la partida terminada", () => {
    const game = new Game("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"); // ahogado
    assert.deepEqual(game.status, { kind: "stalemate" });
    assert.equal(game.isOver, true);
    assert.deepEqual(game.targets("h8"), []);
  });
});

describe("Game: deshacer", () => {
  it("deshace la última jugada y vuelve a la posición anterior", () => {
    const game = new Game();
    game.play("e2", "e4");
    game.play("e7", "e5");
    const undone = game.undo();
    assert.equal(undone?.san, "e5");
    assert.equal(game.turn, "b");
    assert.deepEqual(game.lastMove, { from: "e2", to: "e4" });
    assert.equal(game.history.length, 1);
    // Tras deshacer se puede seguir jugando.
    assert.equal(game.play("c7", "c5")?.san, "c5");
  });

  it("sin jugadas no deshace nada", () => {
    assert.equal(new Game().undo(), null);
  });
});

describe("Game: rehacer y saltar", () => {
  function opening(): Game {
    const game = new Game();
    for (const [from, to] of [["e2", "e4"], ["e7", "e5"], ["g1", "f3"]] as const) game.play(from, to);
    return game;
  }

  it("rehace lo deshecho en orden", () => {
    const game = opening();
    game.undo();
    game.undo();
    assert.equal(game.canRedo, true);
    assert.equal(game.redo()?.san, "e5");
    assert.equal(game.redo()?.san, "Nf3");
    assert.equal(game.canRedo, false);
    assert.equal(game.redo(), null);
    assert.equal(game.turn, "b");
  });

  it("cuenta las jugadas de la partida, también las que se pueden rehacer", () => {
    const game = opening();
    game.undo();
    assert.equal(game.ply, 2);
    assert.equal(game.totalPlies, 3);
  });

  it("una jugada nueva tras deshacer borra lo que se podía rehacer", () => {
    const game = opening();
    game.undo();
    game.play("b1", "c3");
    assert.equal(game.canRedo, false);
    assert.equal(game.history.length, 3);
  });

  it("salta a cualquier punto de la partida", () => {
    const game = opening();
    game.goTo(0);
    assert.equal(game.fen, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    assert.equal(game.ply, 0);
    game.goTo(2);
    assert.equal(game.ply, 2);
    assert.deepEqual(game.lastMove, { from: "e7", to: "e5" });
    game.goTo(99);
    assert.equal(game.ply, 3);
  });
});

describe("Game: lista de jugadas", () => {
  it("agrupa por número de jugada con SAN en español y la media jugada de cada una", () => {
    const game = new Game();
    for (const [from, to] of [["e2", "e4"], ["e7", "e5"], ["g1", "f3"]] as const) game.play(from, to);
    assert.deepEqual(game.moveList(), [
      { number: 1, white: { san: "e4", ply: 1 }, black: { san: "e5", ply: 2 } },
      { number: 2, white: { san: "Cf3", ply: 3 }, black: null },
    ]);
  });

  it("incluye las jugadas que se pueden rehacer", () => {
    const game = new Game();
    for (const [from, to] of [["e2", "e4"], ["e7", "e5"]] as const) game.play(from, to);
    game.undo();
    assert.deepEqual(game.moveList(), [{ number: 1, white: { san: "e4", ply: 1 }, black: { san: "e5", ply: 2 } }]);
  });

  it("si empiezan las negras, la primera fila no tiene jugada blanca", () => {
    const game = new Game("4k3/8/8/8/8/8/8/R3K3 b - - 0 12");
    game.play("e8", "d7");
    game.play("a1", "a7");
    assert.deepEqual(game.moveList(), [
      { number: 12, white: null, black: { san: "Rd7", ply: 1 } },
      { number: 13, white: { san: "Ta7+", ply: 2 }, black: null },
    ]);
  });
});
