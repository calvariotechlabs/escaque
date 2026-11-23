// Exportar e importar PGN desde la interfaz: cabeceras, nombre de archivo, partida y textos (sin DOM).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PgnError, parsePgn } from "../src/core/index.js";
import { Game } from "../src/ui/game.js";
import { exportGame, fileTooLarge, gameFromPgn, importIntro, loadError, PGN_TEXT } from "../src/ui/pgn.js";

function play(game: Game, moves: string[]): void {
  for (const m of moves) assert.ok(game.play(m.slice(0, 2), m.slice(2, 4), (m[4] as "q" | undefined) ?? undefined), m);
}

const SCHOLAR = ["e2e4", "e7e5", "f1c4", "b8c6", "d1h5", "g8f6", "h5f7"];
const DAY = new Date(2026, 10, 3, 18, 30);

describe("Exportar PGN", () => {
  it("nombre de archivo con la fecha local", () => {
    assert.equal(exportGame(new Game(), { mode: "dos" }, DAY).filename, "escaque-2026-11-03.pgn");
  });

  it("contra la máquina: cabeceras con jugador, Alfil Beta y su nivel, y el resultado", () => {
    const game = new Game();
    play(game, SCHOLAR);
    const { text } = exportGame(game, { mode: "maquina", level: "dificil", player: "b" }, DAY);
    assert.match(text, /^\[Event "Partida en Escaque"\]\n\[Site "Escaque"\]\n\[Date "2026\.11\.03"\]\n\[Round "-"\]\n\[White "Alfil Beta \(Difícil\)"\]\n\[Black "Jugador"\]\n\[Result "1-0"\]\n/);
    assert.ok(text.endsWith("4. Qxf7# 1-0\n"), text);
  });

  it("a dos jugadores, sin terminar: Blancas, Negras y «*»", () => {
    const game = new Game();
    play(game, ["e2e4"]);
    const { text } = exportGame(game, { mode: "dos" }, DAY);
    assert.match(text, /\[White "Blancas"\]\n\[Black "Negras"\]\n\[Result "\*"\]/);
    assert.ok(text.endsWith("\n1. e4 *\n"), text);
  });

  it("exporta hasta la posición a la vista: lo deshecho no entra", () => {
    const game = new Game();
    play(game, ["e2e4", "e7e5", "g1f3"]);
    game.undo();
    assert.ok(exportGame(game, { mode: "dos" }, DAY).text.endsWith("\n1. e4 e5 *\n"));
  });

  it("tablas por ahogado: 1/2-1/2", () => {
    const drawn = new Game("k7/8/8/2Q5/8/8/8/7K w - - 0 1");
    play(drawn, ["c5b6"]);
    assert.equal(drawn.status.kind, "stalemate");
    assert.match(exportGame(drawn, { mode: "dos" }, DAY).text, /\[Result "1\/2-1\/2"\]/);
  });

  it("partida con posición inicial propia: lleva SetUp y FEN, y se vuelve a leer igual", () => {
    const fen = "4k3/P7/8/8/8/8/8/4K3 w - - 0 1";
    const game = new Game(fen);
    play(game, ["a7a8q"]);
    const back = parsePgn(exportGame(game, { mode: "dos" }, DAY).text);
    assert.equal(back.startFen, fen);
    assert.deepEqual(back.moves, ["a7a8q"]);
  });
});

describe("Cargar PGN", () => {
  it("la partida cargada termina en su última jugada", () => {
    const { game, cut } = gameFromPgn(parsePgn("1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0"));
    assert.equal(cut, null);
    assert.equal(game.ply, 7);
    assert.equal(game.status.kind, "checkmate");
  });

  it("si la partida sigue tras unas tablas automáticas, se repasa hasta ahí y se dice", () => {
    // Triple repetición tras 4... Cg8 (tablas automáticas en Escaque): 5. Cf3 y lo demás no entran.
    const pgn = parsePgn('[White "Ana"]\n[Black "Beto"]\n1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. Ng1 Ng8 5. Nf3 e5 1-0');
    const { game, cut } = gameFromPgn(pgn);
    assert.equal(game.ply, 8);
    assert.equal(cut, "Escaque da la partida por terminada antes de la jugada 5. Cf3; el repaso llega hasta ahí.");
    assert.equal(importIntro(pgn, cut), `Partida cargada: Ana contra Beto, 1-0. ${cut}`);
  });

  it("una partida sin jugadas no se puede repasar", () => {
    assert.throws(() => gameFromPgn(parsePgn('[White "Ana"]\n*')), (error: unknown) => {
      assert.ok(error instanceof PgnError);
      assert.equal(error.message, "La partida no tiene jugadas que repasar.");
      return true;
    });
  });

  it("texto de la cabecera del repaso", () => {
    assert.equal(importIntro(parsePgn('[White "Ana"]\n[Black "Beto"]\n1. e4 0-1')), "Partida cargada: Ana contra Beto, 0-1.");
    assert.equal(importIntro(parsePgn('[White "?"]\n1. e4 *')), "Partida cargada, sin resultado.");
    assert.equal(importIntro(parsePgn("1. e4 1/2-1/2")), "Partida cargada, tablas.");
  });

  it("mensajes de error: los del lector y uno genérico para lo inesperado", () => {
    assert.equal(loadError(new PgnError("Hay un comentario sin cerrar.")), "Hay un comentario sin cerrar.");
    assert.equal(loadError(new Error("x")), PGN_TEXT.unexpected);
  });

  it("archivos demasiado grandes", () => {
    assert.equal(fileTooLarge(1000), false);
    assert.equal(fileTooLarge(256 * 1024 + 1), true);
  });
});
