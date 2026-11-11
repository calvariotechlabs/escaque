// La jugada de la máquina con un motor falso: validación, reintento, cancelación y deshacer/rehacer.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/ui/game.js";
import { EngineCancelledError } from "../src/worker/client.js";
import { historyUci, minPly, normalizePly, parseUci, redoTarget, requestMachineMove, undoTarget, type EngineLike } from "../src/ui/machine.js";

function play(game: Game, moves: string[]): void {
  for (const m of moves) assert.ok(game.play(m.slice(0, 2), m.slice(2, 4)), m);
}

function fake(answers: Array<string | null | Error>): EngineLike & { calls: number; requests: unknown[] } {
  const engine = {
    calls: 0,
    requests: [] as unknown[],
    think(request: unknown) {
      engine.requests.push(request);
      const answer = answers[engine.calls++];
      if (answer instanceof Error) return Promise.reject(answer);
      return Promise.resolve({ best: answer ?? null });
    },
    cancel() {},
  };
  return engine;
}

describe("jugada de la máquina", () => {
  it("manda la posición inicial y las jugadas hechas hasta ahora", async () => {
    const game = new Game();
    play(game, ["e2e4"]);
    const engine = fake(["e7e5"]);
    const move = await requestMachineMove(engine, game, "medio");
    assert.deepEqual(move, { from: "e7", to: "e5" });
    assert.deepEqual(engine.requests[0], { fen: game.startFen, moves: ["e2e4"], level: "medio" });
  });

  it("no acepta una jugada ilegal ni mal formada, reintenta y falla", async () => {
    const game = new Game();
    play(game, ["e2e4"]);
    for (const bad of ["e7e3", "zz", "e7e5q", "e2e4"]) {
      const engine = fake([bad, bad]);
      await assert.rejects(requestMachineMove(engine, game, "facil"));
      assert.equal(engine.calls, 2);
    }
  });

  it("reintenta una vez si el motor falla", async () => {
    const game = new Game();
    play(game, ["e2e4"]);
    const engine = fake([new Error("boom"), "d7d5"]);
    assert.deepEqual(await requestMachineMove(engine, game, "facil"), { from: "d7", to: "d5" });
    assert.equal(engine.calls, 2);
  });

  it("una cancelación no se reintenta", async () => {
    const engine = fake([new EngineCancelledError(), "e7e5"]);
    await assert.rejects(requestMachineMove(engine, new Game(), "facil"), EngineCancelledError);
    assert.equal(engine.calls, 1);
  });

  it("sin jugada (partida terminada) devuelve null", async () => {
    assert.equal(await requestMachineMove(fake([null]), new Game(), "facil"), null);
  });

  it("exige la pieza de coronación cuando toca y solo entonces", async () => {
    const game = new Game("8/P7/8/8/8/8/k6K/8 w - - 0 1");
    assert.deepEqual(await requestMachineMove(fake(["a7a8q"]), game, "facil"), { from: "a7", to: "a8", promotion: "q" });
    await assert.rejects(requestMachineMove(fake(["a7a8", "a7a8"]), game, "facil"));
  });

  it("parseUci", () => {
    assert.deepEqual(parseUci("e7e8q"), { from: "e7", to: "e8", promotion: "q" });
    assert.equal(parseUci("e7e8k"), null);
    assert.equal(parseUci(5), null);
    assert.deepEqual(historyUci(new Game()), []);
  });
});

describe("deshacer y rehacer contra la máquina", () => {
  it("con blancas deshace la jugada de la máquina y la tuya", () => {
    const game = new Game();
    play(game, ["e2e4", "e7e5", "g1f3", "b8c6"]);
    assert.equal(undoTarget(game, "w"), 2);
    game.goTo(2);
    assert.equal(undoTarget(game, "w"), 0);
    game.goTo(0);
    assert.equal(undoTarget(game, "w"), null);
    assert.equal(redoTarget(game, "w"), 2);
    game.goTo(2);
    assert.equal(redoTarget(game, "w"), 4);
    game.goTo(4);
    assert.equal(redoTarget(game, "w"), null);
  });

  it("con negras no se puede deshacer la primera jugada de la máquina", () => {
    const game = new Game();
    play(game, ["e2e4", "e7e5", "g1f3"]);
    assert.equal(minPly(game, "b"), 1);
    assert.equal(undoTarget(game, "b"), 1);
    game.goTo(1);
    assert.equal(undoTarget(game, "b"), null);
  });

  it("si la máquina no pudo jugar (turno suyo), deshacer quita solo tu última jugada", () => {
    const game = new Game();
    play(game, ["e2e4"]);
    assert.equal(undoTarget(game, "w"), 0);
  });

  it("normalizePly lleva el tablero al siguiente turno de la persona", () => {
    const game = new Game();
    play(game, ["e2e4", "e7e5", "g1f3", "b8c6"]);
    game.goTo(1);
    normalizePly(game, "w");
    assert.equal(game.ply, 2);
    game.goTo(4);
    normalizePly(game, "w");
    assert.equal(game.ply, 4);
  });
});
