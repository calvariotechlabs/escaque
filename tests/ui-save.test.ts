// Guardado de la partida en el dispositivo: formato, validación de lo leído y restauración.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/ui/game.js";
import { createAutosave, loadFromStorage, restoreGame, saveToStorage, serializeGame, STORAGE_KEY } from "../src/ui/save.js";
import type { KeyValueStore } from "../src/ui/save.js";

function playAll(game: Game, moves: string[]): void {
  for (const m of moves) assert.ok(game.play(m.slice(0, 2), m.slice(2, 4)));
}

function memoryStore(initial?: string): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(STORAGE_KEY, initial);
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe("guardado: ida y vuelta", () => {
  it("restaura jugadas, posición y orientación", () => {
    const game = new Game();
    playAll(game, ["e2e4", "e7e5", "g1f3"]);
    const restored = restoreGame(serializeGame(game, "b"));
    assert.ok(restored);
    assert.equal(restored.game.fen, game.fen);
    assert.equal(restored.game.ply, 3);
    assert.equal(restored.orientation, "b");
    assert.deepEqual(restored.game.history.map((m) => m.san), ["e4", "e5", "Nf3"]);
  });

  it("conserva el índice de deshacer y las jugadas que se pueden rehacer", () => {
    const game = new Game();
    playAll(game, ["e2e4", "e7e5", "g1f3"]);
    game.undo();
    game.undo();
    const restored = restoreGame(serializeGame(game, "w"));
    assert.ok(restored);
    assert.equal(restored.game.ply, 1);
    assert.equal(restored.game.totalPlies, 3);
    assert.equal(restored.game.canRedo, true);
    restored.game.redo();
    restored.game.redo();
    assert.equal(restored.game.fen, "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2");
  });

  it("conserva la coronación", () => {
    const game = new Game("7k/P7/8/8/8/8/8/K7 w - - 0 1");
    assert.ok(game.play("a7", "a8", "n"));
    const restored = restoreGame(serializeGame(game, "w"));
    assert.ok(restored);
    assert.equal(restored.game.fen, game.fen);
  });

  it("conserva una FEN inicial que no es la de siempre", () => {
    const game = new Game("4k3/8/8/8/8/8/4P3/4K3 b - - 0 1");
    playAll(game, ["e8e7"]);
    const restored = restoreGame(serializeGame(game, "w"));
    assert.ok(restored);
    assert.equal(restored.game.fen, game.fen);
  });
});

describe("guardado: entrada no fiable", () => {
  const good = () => {
    const game = new Game();
    playAll(game, ["e2e4", "e7e5"]);
    return JSON.parse(serializeGame(game, "w")) as Record<string, unknown>;
  };
  const bad = (value: unknown): void => assert.equal(restoreGame(typeof value === "string" ? value : JSON.stringify(value)), null);

  it("rechaza lo que no es JSON ni objeto", () => {
    bad("no es json");
    bad("null");
    bad("[]");
    bad("42");
    bad("");
  });

  it("rechaza versión desconocida o campos ausentes", () => {
    bad({ ...good(), v: 2 });
    const { fen: _fen, ...sinFen } = good();
    bad(sinFen);
    const { moves: _m, ...sinMoves } = good();
    bad(sinMoves);
  });

  it("rechaza tipos y valores raros", () => {
    bad({ ...good(), fen: 7 });
    bad({ ...good(), fen: "x".repeat(500) });
    bad({ ...good(), fen: "esto no es una FEN" });
    bad({ ...good(), moves: "e2e4" });
    bad({ ...good(), moves: [42] });
    bad({ ...good(), moves: ["e2e4", "zz"] });
    bad({ ...good(), moves: ["e2e5"] });
    bad({ ...good(), orientation: "rojo" });
    bad({ ...good(), ply: -1 });
    bad({ ...good(), ply: 1.5 });
    bad({ ...good(), ply: 3 });
    bad({ ...good(), ply: "2" });
  });

  it("rechaza jugadas ilegales en medio de la lista", () => {
    bad({ ...good(), moves: ["e2e4", "e2e4"] });
    bad({ ...good(), moves: ["e2e4", "e7e5", "e1e3"] });
  });

  it("rechaza listas desmesuradas y textos enormes", () => {
    bad({ ...good(), moves: Array.from({ length: 6000 }, () => "e2e4") });
    bad("x".repeat(300_000));
  });

  it("no se deja contaminar por __proto__ ni claves extra", () => {
    const restored = restoreGame('{"v":1,"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","moves":[],"ply":0,"orientation":"w","__proto__":{"x":1},"extra":1}');
    assert.ok(restored);
    assert.equal(({} as Record<string, unknown>)["x"], undefined);
  });
});

describe("guardado: almacenamiento", () => {
  it("guarda y lee", () => {
    const store = memoryStore();
    const game = new Game();
    playAll(game, ["d2d4"]);
    saveToStorage(store, game, "w");
    const loaded = loadFromStorage(store);
    assert.ok(loaded);
    assert.equal(loaded.game.fen, game.fen);
  });

  it("borra una entrada corrupta y devuelve null", () => {
    const store = memoryStore("{corrupto");
    assert.equal(loadFromStorage(store), null);
    assert.equal(store.data.has(STORAGE_KEY), false);
  });

  it("sin nada guardado devuelve null", () => {
    assert.equal(loadFromStorage(memoryStore()), null);
  });

  it("no rompe si no hay almacenamiento o falla al leer o escribir", () => {
    const game = new Game();
    assert.doesNotThrow(() => saveToStorage(null, game, "w"));
    assert.equal(loadFromStorage(null), null);
    const throwing: KeyValueStore = {
      getItem: () => { throw new Error("bloqueado"); },
      setItem: () => { throw new Error("cuota"); },
      removeItem: () => { throw new Error("bloqueado"); },
    };
    assert.doesNotThrow(() => saveToStorage(throwing, game, "w"));
    assert.equal(loadFromStorage(throwing), null);
  });
});

describe("guardado: escritura automática", () => {
  it("no vuelve a escribir si la partida no ha cambiado", () => {
    const store = memoryStore();
    let writes = 0;
    const counting: KeyValueStore = { ...store, setItem: (k, v) => { writes++; store.setItem(k, v); } };
    const save = createAutosave(counting);
    const game = new Game();
    save(game, "w");
    save(game, "w");
    assert.equal(writes, 1);
    save(game, "b");
    assert.equal(writes, 2);
    playAll(game, ["e2e4"]);
    save(game, "b");
    assert.equal(writes, 3);
  });

  it("sin almacenamiento no hace nada", () => {
    assert.doesNotThrow(() => createAutosave(null)(new Game(), "w"));
  });
});
