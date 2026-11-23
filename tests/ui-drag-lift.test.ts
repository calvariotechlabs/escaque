import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { LIFT_OFFSET_CELLS, LIFT_SCALE, chipPlacement, liftsPiece, liftedTransform } from "../src/ui/drag-lift.js";

describe("liftsPiece", () => {
  test("solo el dedo levanta la pieza: ratón y lápiz la llevan pegada al puntero", () => {
    assert.equal(liftsPiece("touch"), true);
    assert.equal(liftsPiece("mouse"), false);
    assert.equal(liftsPiece("pen"), false);
    assert.equal(liftsPiece(""), false);
  });
});

describe("liftedTransform", () => {
  test("sin elevar, la pieza solo se traslada con el puntero", () => {
    assert.equal(liftedTransform(10, 20, 40, false), "translate(10px, 20px)");
  });

  test("con el dedo, la pieza sube sobre el contacto y crece", () => {
    const up = LIFT_OFFSET_CELLS * 40;
    assert.equal(liftedTransform(10, 20, 40, true), `translate(10px, ${20 - up}px) scale(${LIFT_SCALE})`);
  });

  test("la pieza elevada queda por encima del dedo: su borde inferior no baja del centro del contacto", () => {
    const cell = 40;
    // Centro de la pieza: la casilla de origen más el desplazamiento; el borde inferior, media pieza escalada más abajo.
    const bottom = -LIFT_OFFSET_CELLS * cell + (LIFT_SCALE * cell) / 2;
    assert.ok(bottom < 0, `el borde inferior (${bottom}) debe quedar sobre el dedo`);
  });
});

describe("chipPlacement", () => {
  test("la etiqueta con el nombre de la casilla va junto a la pieza, no bajo el dedo", () => {
    const p = chipPlacement(10, 20, 40);
    assert.ok(p.y < 20, "más arriba que el contacto");
    assert.ok(p.x > 10, "a la derecha de la pieza elevada");
  });
});

describe("chipPlacement con el dedo en el borde derecho", () => {
  test("la etiqueta pasa a la izquierda de la pieza", () => {
    const right = chipPlacement(10, 20, 40);
    const left = chipPlacement(10, 20, 40, true);
    assert.ok(left.x < right.x);
    assert.equal(left.y, right.y);
  });
});
