// Partidas automáticas entre jugadores (motor o azar), para medir los niveles.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRandom } from "../src/core/index.js";
import { playGame, randomPlayer, enginePlayer } from "../tools/match-core.js";

describe("playGame()", () => {
  it("termina con un resultado y un motivo de las reglas", () => {
    const game = playGame(randomPlayer(createRandom(1)), randomPlayer(createRandom(2)));
    assert.ok(["1-0", "0-1", "1/2-1/2"].includes(game.result));
    assert.ok(game.plies > 0 && game.moves.length === game.plies);
    if (game.result !== "1/2-1/2") assert.equal(game.reason, "checkmate");
  });

  it("corta las partidas demasiado largas como tablas", () => {
    const game = playGame(randomPlayer(createRandom(3)), randomPlayer(createRandom(4)), { maxPlies: 6 });
    assert.deepEqual([game.result, game.reason, game.plies], ["1/2-1/2", "max-plies", 6]);
  });

  it("Medio gana a un jugador al azar con blancas y con negras", () => {
    const asWhite = playGame(enginePlayer("medio"), randomPlayer(createRandom(10)));
    assert.equal(asWhite.result, "1-0", `con blancas: ${asWhite.reason}, ${asWhite.moves.join(" ")}`);
    const asBlack = playGame(randomPlayer(createRandom(11)), enginePlayer("medio"));
    assert.equal(asBlack.result, "0-1", `con negras: ${asBlack.reason}, ${asBlack.moves.join(" ")}`);
  });
});
