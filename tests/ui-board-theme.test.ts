// Tablero a elegir: valores válidos, guardado y lectura defensiva.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyBoardTheme,
  BOARD_THEME_KEY,
  DEFAULT_BOARD_THEME,
  isBoardTheme,
  loadBoardTheme,
  saveBoardTheme,
} from "../src/ui/board-theme.js";
import type { KeyValueStore } from "../src/ui/save.js";

function memoryStore(initial?: string): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(BOARD_THEME_KEY, initial);
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe("tablero a elegir", () => {
  it("solo acepta Bosque y Nogal", () => {
    assert.equal(isBoardTheme("bosque"), true);
    assert.equal(isBoardTheme("nogal"), true);
    for (const v of ["", "Bosque", "madera", null, undefined, 3, {}]) assert.equal(isBoardTheme(v), false);
  });

  it("sin nada guardado o sin almacenamiento, el de siempre", () => {
    assert.equal(loadBoardTheme(memoryStore()), DEFAULT_BOARD_THEME);
    assert.equal(loadBoardTheme(null), DEFAULT_BOARD_THEME);
  });

  it("guarda y recupera la elección", () => {
    const store = memoryStore();
    saveBoardTheme(store, "nogal");
    assert.equal(store.data.get(BOARD_THEME_KEY), "nogal");
    assert.equal(loadBoardTheme(store), "nogal");
  });

  it("descarta un valor guardado que no es válido", () => {
    const store = memoryStore("<script>");
    assert.equal(loadBoardTheme(store), DEFAULT_BOARD_THEME);
    assert.equal(store.data.has(BOARD_THEME_KEY), false);
  });

  it("no falla si el almacenamiento lanza", () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("lleno");
      },
      removeItem: () => {
        throw new Error("bloqueado");
      },
    };
    assert.equal(loadBoardTheme(broken), DEFAULT_BOARD_THEME);
    assert.doesNotThrow(() => saveBoardTheme(broken, "nogal"));
  });

  it("Nogal pone el atributo y Bosque lo quita", () => {
    const attrs = new Map<string, string>();
    const target = { setAttribute: (n: string, v: string) => void attrs.set(n, v), removeAttribute: (n: string) => void attrs.delete(n) };
    applyBoardTheme(target, "nogal");
    assert.equal(attrs.get("data-tablero"), "nogal");
    applyBoardTheme(target, "bosque");
    assert.equal(attrs.has("data-tablero"), false);
  });
});
