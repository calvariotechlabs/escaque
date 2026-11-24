import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ABANDONED_MS, LOST_MS, abandonedBy } from "../src/ui/pointer-gesture.js";

const finger = { pointerId: 2, pointerType: "touch", lastSeen: 1000, dragging: true };
const resting = { ...finger, dragging: false };
const press = (over: Partial<{ pointerId: number; pointerType: string; isPrimary: boolean; timeStamp: number }>) => ({
  pointerId: 3,
  pointerType: "touch",
  isPrimary: false,
  timeStamp: 1100,
  ...over,
});

describe("abandonedBy", () => {
  test("otro dedo con el primero apoyado no corta el arrastre, aunque el primero lleve rato quieto", () => {
    assert.equal(abandonedBy(finger, press({ timeStamp: 1100 })), false);
    assert.equal(abandonedBy(finger, press({ timeStamp: 1600 })), false);
    assert.equal(abandonedBy(finger, press({ timeStamp: 1000 + LOST_MS - 1 })), false);
  });

  test("un toque que el navegador da por principal: el primer dedo ya no está, aunque no llegara su pointerup", () => {
    assert.equal(abandonedBy(finger, press({ isPrimary: true, timeStamp: 1050 })), true);
  });

  test("el mismo puntero vuelve a pulsar: el gesto anterior ya terminó", () => {
    assert.equal(abandonedBy(finger, press({ pointerId: 2 })), true);
  });

  test("otro tipo de puntero: nadie arrastra con el dedo y pulsa con el ratón a la vez", () => {
    assert.equal(abandonedBy(finger, press({ pointerType: "mouse", isPrimary: true })), true);
  });

  test("un dedo quieto que aún no arrastra cede a otro toque pasado medio segundo, como antes", () => {
    assert.equal(abandonedBy(resting, press({ timeStamp: 1000 + ABANDONED_MS - 1 })), false);
    assert.equal(abandonedBy(resting, press({ timeStamp: 1000 + ABANDONED_MS })), true);
    assert.equal(abandonedBy(resting, press({ isPrimary: true, timeStamp: 1010 })), true);
  });

  test("si el navegador deja un dedo colgado mucho rato, el tablero no se queda bloqueado", () => {
    assert.equal(abandonedBy(finger, press({ timeStamp: 1000 + LOST_MS - 1 })), false);
    assert.equal(abandonedBy(finger, press({ timeStamp: 1000 + LOST_MS })), true);
  });
});
