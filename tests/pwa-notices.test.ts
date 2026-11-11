import { test } from "node:test";
import assert from "node:assert/strict";
import { INITIAL_STATE, needsIosInstallHint, pickNotice, type PwaState } from "../src/pwa/notices.js";

const state = (change: Partial<PwaState>): PwaState => ({ ...INITIAL_STATE, ...change });

test("sin nada que decir no hay aviso", () => {
  assert.equal(pickNotice(INITIAL_STATE), null);
});

test("cada aviso lleva el texto del diseño", () => {
  const update = pickNotice(state({ updateReady: true }));
  assert.equal(update?.title, "Hay una versión nueva.");
  assert.equal(update?.text, "Al actualizar se reinicia la partida en curso.");
  assert.deepEqual(update?.buttons.map((b) => b.label), ["Actualizar ahora", "Más tarde"]);
  const offline = pickNotice(state({ offline: true }));
  assert.equal(offline?.title, "Sin conexión.");
  assert.equal(offline?.text, "Puedes seguir jugando: Escaque funciona sin internet.");
  const install = pickNotice(state({ canInstall: true }));
  assert.equal(install?.title, "Instala Escaque.");
  assert.deepEqual(install?.buttons.map((b) => b.label), ["Instalar", "Ahora no"]);
  const ios = pickNotice(state({ iosHint: true }));
  assert.equal(ios?.title, "Instala Escaque en tu iPhone.");
  assert.equal(ios?.text, "Toca Compartir y elige «Añadir a pantalla de inicio».");
});

test("solo uno a la vez: nueva versión, sin conexión, instalar", () => {
  assert.equal(pickNotice(state({ updateReady: true, offline: true, canInstall: true }))?.kind, "nueva");
  assert.equal(pickNotice(state({ offline: true, canInstall: true }))?.kind, "sin-conexion");
  assert.equal(pickNotice(state({ canInstall: true, iosHint: true }))?.kind, "instalar");
});

test("un aviso descartado deja paso al siguiente", () => {
  assert.equal(pickNotice(state({ updateReady: true, updateDismissed: true, offline: true }))?.kind, "sin-conexion");
  assert.equal(pickNotice(state({ offline: true, offlineDismissed: true, canInstall: true }))?.kind, "instalar");
  assert.equal(pickNotice(state({ canInstall: true, installDismissed: true })), null);
});

test("ya instalada no se ofrece instalar, pero sí se avisa de lo demás", () => {
  assert.equal(pickNotice(state({ standalone: true, canInstall: true, iosHint: true })), null);
  assert.equal(pickNotice(state({ standalone: true, offline: true }))?.kind, "sin-conexion");
});

test("los botones principales son la acción, no el descarte", () => {
  for (const change of [{ updateReady: true }, { canInstall: true }]) {
    const buttons = pickNotice(state(change))?.buttons ?? [];
    assert.deepEqual(buttons.map((b) => b.primary), [true, false]);
  }
});

test("detecta iPhone, iPad y iPadOS en Safari, no un Mac ni Android", () => {
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";
  const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15";
  const android = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36";
  assert.equal(needsIosInstallHint(iphone, 5, false), true);
  assert.equal(needsIosInstallHint(mac, 5, false), true, "iPadOS se anuncia como Mac pero es táctil");
  assert.equal(needsIosInstallHint(mac, 0, false), false);
  assert.equal(needsIosInstallHint(android, 5, false), false);
  assert.equal(needsIosInstallHint(iphone, 5, true), false, "en modo app ya no hay que explicar nada");
});
