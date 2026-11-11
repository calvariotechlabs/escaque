// Ajustes de partida: lectura de la elección, sorteo del color y revancha.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { choiceOf, DEFAULT_CHOICE, machineColor, parseChoice, resolveSetup } from "../src/ui/settings.js";

describe("ajustes", () => {
  it("lo que no es válido vuelve al valor por defecto", () => {
    assert.deepEqual(parseChoice({}), DEFAULT_CHOICE);
    assert.deepEqual(parseChoice({ mode: "x", level: "__proto__", color: 3 }), DEFAULT_CHOICE);
    assert.deepEqual(parseChoice({ mode: "dos", level: "dificil", color: "negras" }), { mode: "dos", level: "dificil", color: "negras" });
  });

  it("por defecto: máquina, nivel medio, blancas", () => {
    assert.deepEqual(DEFAULT_CHOICE, { mode: "maquina", level: "medio", color: "blancas" });
  });

  it("resuelve el color, y el azar usa el generador", () => {
    assert.deepEqual(resolveSetup({ mode: "maquina", level: "facil", color: "negras" }), { mode: "maquina", level: "facil", player: "b" });
    assert.equal((resolveSetup({ mode: "maquina", level: "facil", color: "azar" }, () => 0.1) as { player: string }).player, "w");
    assert.equal((resolveSetup({ mode: "maquina", level: "facil", color: "azar" }, () => 0.9) as { player: string }).player, "b");
    assert.deepEqual(resolveSetup({ mode: "dos", level: "facil", color: "azar" }), { mode: "dos" });
  });

  it("la revancha repite nivel y color ya decididos", () => {
    const setup = resolveSetup({ mode: "maquina", level: "dificil", color: "azar" }, () => 0.9);
    assert.deepEqual(choiceOf(setup), { mode: "maquina", level: "dificil", color: "negras" });
    assert.equal(machineColor(setup), "w");
    assert.equal(machineColor({ mode: "dos" }), null);
  });
});
