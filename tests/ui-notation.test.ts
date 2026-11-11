// Textos en español de la interfaz: SAN con C A T D R, anuncios y fin de partida.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanToSpanish, statusMessage, moveAnnouncement, newGameWarning } from "../src/ui/notation.js";

describe("SAN en español", () => {
  it("traduce las letras de las piezas", () => {
    assert.equal(sanToSpanish("Nf3"), "Cf3");
    assert.equal(sanToSpanish("Bb5+"), "Ab5+");
    assert.equal(sanToSpanish("Rxe8#"), "Txe8#");
    assert.equal(sanToSpanish("Qh5"), "Dh5");
    assert.equal(sanToSpanish("Kxf2"), "Rxf2");
    assert.equal(sanToSpanish("Nbd2"), "Cbd2");
  });

  it("no toca las jugadas de peón ni las columnas b", () => {
    assert.equal(sanToSpanish("e4"), "e4");
    assert.equal(sanToSpanish("bxc6"), "bxc6");
    assert.equal(sanToSpanish("exd6"), "exd6");
  });

  it("traduce la pieza de coronación", () => {
    assert.equal(sanToSpanish("e8=Q+"), "e8=D+");
    assert.equal(sanToSpanish("bxa1=N"), "bxa1=C");
  });

  it("deja el enroque como está", () => {
    assert.equal(sanToSpanish("O-O"), "O-O");
    assert.equal(sanToSpanish("O-O-O+"), "O-O-O+");
  });
});

describe("anuncio de jugadas", () => {
  it("bando, SAN en español y descripción", () => {
    assert.equal(
      moveAnnouncement({ color: "w", san: "Nf3", from: "g1", to: "f3", piece: "n", captured: null, promotion: null }),
      "Blancas: Cf3. Caballo de g1 a f3.",
    );
  });

  it("captura, jaque y coronación", () => {
    assert.equal(
      moveAnnouncement({ color: "b", san: "exd1=Q+", from: "e2", to: "d1", piece: "p", captured: "r", promotion: "q" }),
      "Negras: exd1=D+. Peón de e2 captura torre en d1 y corona en dama. Jaque.",
    );
  });

  it("mate", () => {
    assert.equal(
      moveAnnouncement({ color: "w", san: "Qxf7#", from: "h5", to: "f7", piece: "q", captured: "p", promotion: null }),
      "Blancas: Dxf7#. Dama de h5 captura peón en f7. Jaque mate.",
    );
  });

  it("enroques", () => {
    assert.equal(
      moveAnnouncement({ color: "w", san: "O-O", from: "e1", to: "g1", piece: "k", captured: null, promotion: null }),
      "Blancas: O-O. Enroque corto.",
    );
    assert.equal(
      moveAnnouncement({ color: "b", san: "O-O-O+", from: "e8", to: "c8", piece: "k", captured: null, promotion: null }),
      "Negras: O-O-O+. Enroque largo. Jaque.",
    );
  });
});

describe("mensajes de estado", () => {
  it("turno y jaque", () => {
    assert.equal(statusMessage({ kind: "ongoing" }, "w", false), "Juegan las blancas.");
    assert.equal(statusMessage({ kind: "ongoing" }, "b", true), "Juegan las negras. Jaque.");
  });

  it("fin de partida", () => {
    assert.equal(statusMessage({ kind: "checkmate", winner: "w" }, "b", true), "Jaque mate. Ganan las blancas.");
    assert.equal(statusMessage({ kind: "stalemate" }, "b", false), "Tablas por ahogado.");
    assert.equal(statusMessage({ kind: "insufficient-material" }, "w", false), "Tablas por material insuficiente.");
    assert.equal(statusMessage({ kind: "fifty-move" }, "w", false), "Tablas por la regla de los 50 movimientos.");
    assert.equal(statusMessage({ kind: "threefold-repetition" }, "b", false), "Tablas por triple repetición.");
  });
});

describe("aviso de nueva partida", () => {
  it("dice cuántas jugadas se pierden, en singular y en plural", () => {
    assert.equal(newGameWarning(1), "Se perderá la jugada de esta partida.");
    assert.equal(newGameWarning(6), "Se perderán las 6 jugadas de esta partida.");
  });
});
