// Progreso de las lecciones: estados, guardado y validación de lo leído.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  completeLesson,
  completedCount,
  EMPTY_PROGRESS,
  loadProgress,
  openLesson,
  parseProgress,
  PROGRESS_KEY,
  saveProgress,
  serializeProgress,
  stateOf,
} from "../src/ui/lessons-progress.js";
import type { KeyValueStore } from "../src/ui/save.js";

const IDS = ["a", "b", "c"];

function memoryStore(initial?: string): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(PROGRESS_KEY, initial);
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

describe("progreso de lecciones", () => {
  it("empieza vacío y cada lección está sin empezar", () => {
    assert.equal(stateOf(EMPTY_PROGRESS, "a"), "sin-empezar");
    assert.equal(completedCount(EMPTY_PROGRESS, IDS), 0);
  });

  it("abrir una lección la deja en curso, y solo una a la vez", () => {
    const p = openLesson(openLesson(EMPTY_PROGRESS, "a"), "b");
    assert.equal(stateOf(p, "a"), "sin-empezar");
    assert.equal(stateOf(p, "b"), "en-curso");
  });

  it("completar guarda las pistas y quita el «en curso»", () => {
    const p = completeLesson(openLesson(EMPTY_PROGRESS, "a"), "a", 2);
    assert.equal(stateOf(p, "a"), "completada");
    assert.equal(p.done.get("a"), 2);
    assert.equal(p.current, null);
    assert.equal(completedCount(p, IDS), 1);
  });

  it("repetir una lección completada conserva la mejor vez", () => {
    const first = completeLesson(EMPTY_PROGRESS, "a", 2);
    assert.equal(completeLesson(first, "a", 0).done.get("a"), 0);
    assert.equal(completeLesson(first, "a", 3).done.get("a"), 2);
  });

  it("abrir una completada no la cambia", () => {
    const p = completeLesson(EMPTY_PROGRESS, "a", 0);
    assert.equal(openLesson(p, "a"), p);
  });

  it("completar otra lección no quita la que estaba en curso", () => {
    const p = completeLesson(openLesson(EMPTY_PROGRESS, "a"), "b", 1);
    assert.equal(p.current, "a");
  });

  it("ida y vuelta por el almacenamiento", () => {
    const store = memoryStore();
    saveProgress(store, completeLesson(openLesson(EMPTY_PROGRESS, "c"), "a", 1));
    const loaded = loadProgress(store, IDS);
    assert.equal(loaded.done.get("a"), 1);
    assert.equal(loaded.current, "c");
  });

  it("descarta lecciones desconocidas, pistas inválidas y una abierta ya completada", () => {
    const raw = JSON.stringify({ v: 1, done: { a: 1, zzz: 0, b: -1, c: 1.5, __proto__: 2 }, current: "a" });
    const p = parseProgress(raw, IDS);
    assert.deepEqual([...p.done], [["a", 1]]);
    assert.deepEqual([...p.kept], [["zzz", 0]]);
    assert.equal(p.current, null);
  });

  it("conserva lo de lecciones que esta versión no conoce, y lo vuelve a guardar", () => {
    const store = memoryStore(JSON.stringify({ v: 1, done: { a: 1, vieja: 2 }, current: null }));
    const loaded = loadProgress(store, IDS);
    saveProgress(store, completeLesson(loaded, "b", 0));
    assert.deepEqual(JSON.parse(store.data.get(PROGRESS_KEY)!).done, { vieja: 2, a: 1, b: 0 });
    // Y si la lección vuelve a existir, su progreso está ahí.
    assert.equal(loadProgress(store, [...IDS, "vieja"]).done.get("vieja"), 2);
  });

  it("lo que no es un progreso válido se ignora y se borra", () => {
    for (const bad of ["no json", "[]", "null", JSON.stringify({ v: 2, done: {} }), JSON.stringify({ v: 1, done: [] }), "x".repeat(20_000)]) {
      const store = memoryStore(bad);
      assert.equal(loadProgress(store, IDS), EMPTY_PROGRESS);
      assert.equal(store.data.has(PROGRESS_KEY), false);
    }
  });

  it("sin almacenamiento o con almacenamiento que falla no pasa nada", () => {
    assert.equal(loadProgress(null, IDS), EMPTY_PROGRESS);
    saveProgress(null, EMPTY_PROGRESS);
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("cuota");
      },
      removeItem: () => {},
    };
    assert.equal(loadProgress(broken, IDS), EMPTY_PROGRESS);
    saveProgress(broken, EMPTY_PROGRESS);
  });

  it("el formato guardado es estable", () => {
    assert.equal(serializeProgress(completeLesson(EMPTY_PROGRESS, "a", 0)), '{"v":1,"done":{"a":0},"current":null}');
  });
});
