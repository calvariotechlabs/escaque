// Identidad visual (CAL-398): textos y decisiones de los microdetalles. Lo visual está en src/ui/identidad.css.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { machineStatusParts, finishedParts, resultView, shouldCelebrate, CONFETTI_COUNT } from "../src/ui/identity.js";

const ongoing = { kind: "ongoing" } as const;
const mateW = { kind: "checkmate", winner: "w" } as const;

describe("estado contra la máquina, en partes", () => {
  it("separa «Te toca» del texto para pintarlo como etiqueta", () => {
    assert.deepEqual(machineStatusParts(ongoing, "w", false, true, false), { text: "Juegan las blancas.", yourTurn: true, check: false });
    assert.deepEqual(machineStatusParts(ongoing, "b", false, false, false), { text: "Juegan las negras.", yourTurn: false, check: false });
  });

  it("en jaque y con tu turno, dice qué hacer", () => {
    assert.deepEqual(machineStatusParts(ongoing, "w", true, true, false), { text: "Juegan las blancas: sal del jaque.", yourTurn: true, check: true });
  });

  it("en jaque la máquina, la etiqueta «Jaque» lo dice y el texto no lo repite", () => {
    assert.deepEqual(machineStatusParts(ongoing, "b", true, false, true), { text: "Juegan las negras. Alfil Beta está pensando.", yourTurn: false, check: true });
    assert.deepEqual(machineStatusParts(ongoing, "b", true, false, false), { text: "Juegan las negras.", yourTurn: false, check: true });
  });

  it("mientras piensa la máquina no te toca", () => {
    assert.deepEqual(machineStatusParts(ongoing, "b", false, false, true), { text: "Juegan las negras. Alfil Beta está pensando.", yourTurn: false, check: false });
  });

  it("al terminar no hay turno ni jaque", () => {
    assert.deepEqual(machineStatusParts(mateW, "b", false, false, false), { text: "Jaque mate. Ganan las blancas.", yourTurn: false, check: false });
    assert.deepEqual(machineStatusParts({ kind: "stalemate" }, "w", false, true, false), { text: "Tablas por ahogado.", yourTurn: false, check: false });
  });
});

describe("fin de partida en el estado (dos jugadores)", () => {
  it("título grande y causa", () => {
    assert.deepEqual(finishedParts(mateW), { title: "Jaque mate.", text: "Ganan las blancas." });
    assert.deepEqual(finishedParts({ kind: "checkmate", winner: "b" }), { title: "Jaque mate.", text: "Ganan las negras." });
    assert.deepEqual(finishedParts({ kind: "stalemate" }), { title: "Tablas.", text: "Por ahogado." });
    assert.deepEqual(finishedParts({ kind: "insufficient-material" }), { title: "Tablas.", text: "Por material insuficiente." });
    assert.deepEqual(finishedParts({ kind: "fifty-move" }), { title: "Tablas.", text: "Por la regla de los 50 movimientos." });
    assert.deepEqual(finishedParts({ kind: "threefold-repetition" }), { title: "Tablas.", text: "Por triple repetición." });
    assert.equal(finishedParts(ongoing), null);
  });
});

describe("resultado contra la máquina", () => {
  it("ganar: victoria, con sello de logro", () => {
    assert.deepEqual(resultView(mateW, "w"), { kind: "gana", kicker: "Victoria", title: "Has ganado.", text: "Jaque mate. Ganan las blancas." });
  });

  it("perder: derrota, y sugiere el repaso", () => {
    assert.deepEqual(resultView(mateW, "b"), {
      kind: "pierde",
      kicker: "Derrota",
      title: "Has perdido.",
      text: "Jaque mate. Ganan las blancas. En el repaso verás dónde cambió la partida.",
    });
  });

  it("tablas: empate", () => {
    assert.deepEqual(resultView({ kind: "threefold-repetition" }, "w"), { kind: "tablas", kicker: "Empate", title: "Tablas.", text: "Tablas por triple repetición." });
  });

  it("sin terminar, nada", () => {
    assert.equal(resultView(ongoing, "w"), null);
  });
});

describe("celebración", () => {
  it("solo al pasar a «has ganado» durante la partida", () => {
    assert.equal(shouldCelebrate(null, "gana"), true);
    assert.equal(shouldCelebrate("gana", "gana"), false, "no se repite al repintar");
    assert.equal(shouldCelebrate(null, "pierde"), false);
    assert.equal(shouldCelebrate(null, "tablas"), false);
    assert.equal(shouldCelebrate(null, null), false);
    assert.equal(shouldCelebrate(undefined, "gana"), false, "al abrir una partida ya terminada no se celebra");
    assert.equal(shouldCelebrate(null, "gana", true), false, "volver a la última jugada de una partida ya celebrada no la repite");
  });

  it("diez escaques", () => {
    assert.equal(CONFETTI_COUNT, 10);
  });
});
