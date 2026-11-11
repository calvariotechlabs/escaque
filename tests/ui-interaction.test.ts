// Modelo de interacción sin DOM: selección por clic, arrastre, teclado, coronación y marcas.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/ui/game.js";
import { Interaction, nextFocus } from "../src/ui/interaction.js";

function setup(fen?: string): { game: Game; ui: Interaction } {
  const game = new Game(fen);
  return { game, ui: new Interaction(game) };
}

describe("clic", () => {
  it("clic en pieza propia la selecciona y marca sus destinos", () => {
    const { ui } = setup();
    assert.deepEqual(ui.click("g1"), { kind: "selected", square: "g1" });
    assert.equal(ui.selected, "g1");
    const marks = ui.marks();
    assert.deepEqual(marks.get("g1"), ["selected"]);
    assert.deepEqual(marks.get("f3"), ["target"]);
    assert.deepEqual(marks.get("h3"), ["target"]);
  });

  it("clic en un destino juega", () => {
    const { game, ui } = setup();
    ui.click("e2");
    const result = ui.click("e4");
    assert.equal(result.kind, "moved");
    assert.equal(result.kind === "moved" ? result.record.san : "", "e4");
    assert.equal(ui.selected, null);
    assert.equal(game.turn, "b");
    // Tras jugar quedan las marcas de última jugada.
    assert.deepEqual(ui.marks().get("e2"), ["last-move"]);
    assert.deepEqual(ui.marks().get("e4"), ["last-move"]);
  });

  it("clic otra vez en la seleccionada la deselecciona", () => {
    const { ui } = setup();
    ui.click("g1");
    assert.deepEqual(ui.click("g1"), { kind: "deselected" });
    assert.equal(ui.selected, null);
  });

  it("clic en otra pieza propia cambia la selección", () => {
    const { ui } = setup();
    ui.click("g1");
    assert.deepEqual(ui.click("b1"), { kind: "selected", square: "b1" });
  });

  it("clic en casilla no válida con selección la quita", () => {
    const { ui } = setup();
    ui.click("g1");
    assert.deepEqual(ui.click("g5"), { kind: "deselected" });
  });

  it("no selecciona piezas del rival ni casillas vacías, ni piezas sin jugadas", () => {
    const { ui } = setup();
    assert.deepEqual(ui.click("e7"), { kind: "none" });
    assert.deepEqual(ui.click("e4"), { kind: "none" });
    assert.deepEqual(ui.click("a1"), { kind: "none" }); // torre encerrada
    assert.equal(ui.selected, null);
  });

  it("marca capturas y el rey en jaque", () => {
    const { ui } = setup("4k3/8/8/3p4/4P3/8/8/4K2r w - - 0 1");
    assert.deepEqual(ui.marks().get("e1"), ["check"]);
    // Rey en jaque: solo puede moverse; e4 no tiene jugadas.
    assert.deepEqual(ui.click("e4"), { kind: "none" });
    const { ui: free } = setup("4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1");
    free.click("e4");
    assert.deepEqual(free.marks().get("d5"), ["capture"]);
    assert.deepEqual(free.marks().get("e5"), ["target"]);
  });
});

describe("arrastre", () => {
  it("arrastrar y soltar en destino juega", () => {
    const { ui } = setup();
    assert.equal(ui.dragStart("g1"), true);
    assert.equal(ui.selected, "g1");
    assert.equal(ui.drop("f3").kind, "moved");
  });

  it("no se puede arrastrar una pieza del rival", () => {
    const { ui } = setup();
    assert.equal(ui.dragStart("g8"), false);
    assert.equal(ui.selected, null);
  });

  it("soltar en la casilla de origen la deja seleccionada para jugar con clic", () => {
    const { ui } = setup();
    ui.dragStart("g1");
    assert.deepEqual(ui.drop("g1"), { kind: "selected", square: "g1" });
    assert.equal(ui.click("f3").kind, "moved");
  });

  it("soltar fuera o en casilla no válida cancela", () => {
    const { ui } = setup();
    ui.dragStart("g1");
    assert.deepEqual(ui.drop(null), { kind: "deselected" });
    ui.dragStart("g1");
    assert.deepEqual(ui.drop("g4"), { kind: "deselected" });
    assert.equal(ui.selected, null);
  });

  it("al arrastrar otra pieza tras una selección no la juega como destino", () => {
    const { ui } = setup();
    ui.click("g1");
    assert.equal(ui.dragStart("b1"), true);
    assert.equal(ui.selected, "b1");
  });
});

describe("coronación", () => {
  const FEN = "4k3/1P6/8/8/8/8/8/4K3 w - - 0 1";

  it("pide pieza y juega al elegirla", () => {
    const { game, ui } = setup(FEN);
    ui.click("b7");
    assert.deepEqual(ui.click("b8"), { kind: "promotion", from: "b7", to: "b8" });
    assert.deepEqual(ui.pendingPromotion, { from: "b7", to: "b8" });
    // Mientras se elige, el tablero no responde.
    assert.deepEqual(ui.click("e1"), { kind: "none" });
    const result = ui.choosePromotion("r");
    assert.equal(result.kind === "moved" ? result.record.san : "", "b8=R+");
    assert.equal(ui.pendingPromotion, null);
    assert.deepEqual(game.pieceAt("b8"), { color: "w", type: "r" });
  });

  it("cancelar deja la posición y la selección como estaban", () => {
    const { game, ui } = setup(FEN);
    ui.dragStart("b7");
    ui.drop("b8");
    assert.deepEqual(ui.cancel(), { kind: "deselected" });
    assert.equal(ui.pendingPromotion, null);
    assert.equal(ui.selected, null);
    assert.equal(game.history.length, 0);
  });

  it("elegir sin coronación pendiente no hace nada", () => {
    const { ui } = setup(FEN);
    assert.deepEqual(ui.choosePromotion("q"), { kind: "none" });
  });
});

describe("teclado", () => {
  it("las flechas mueven el foco según la orientación", () => {
    assert.equal(nextFocus("e4", "ArrowUp", "w"), "e5");
    assert.equal(nextFocus("e4", "ArrowRight", "w"), "f4");
    assert.equal(nextFocus("e4", "ArrowUp", "b"), "e3");
    assert.equal(nextFocus("e4", "ArrowRight", "b"), "d4");
  });

  it("no se sale del tablero", () => {
    assert.equal(nextFocus("h8", "ArrowUp", "w"), "h8");
    assert.equal(nextFocus("h8", "ArrowRight", "w"), "h8");
    assert.equal(nextFocus("a1", "ArrowLeft", "w"), "a1");
    assert.equal(nextFocus("a1", "ArrowUp", "b"), "a1");
  });

  it("Inicio y Fin van al principio y al final de la fila; Re Pág y Av Pág, de la columna", () => {
    assert.equal(nextFocus("e4", "Home", "w"), "a4");
    assert.equal(nextFocus("e4", "End", "w"), "h4");
    assert.equal(nextFocus("e4", "Home", "b"), "h4");
    assert.equal(nextFocus("e4", "PageUp", "w"), "e8");
    assert.equal(nextFocus("e4", "PageDown", "w"), "e1");
    assert.equal(nextFocus("e4", "PageUp", "b"), "e1");
  });

  it("otras teclas no mueven el foco", () => {
    assert.equal(nextFocus("e4", "a", "w"), null);
  });

  it("flechas, Intro y Escape juegan desde el teclado", () => {
    const { ui } = setup();
    assert.equal(ui.focus, "e1");
    ui.key("ArrowRight"); // f1
    ui.key("ArrowRight"); // g1
    assert.equal(ui.focus, "g1");
    assert.deepEqual(ui.key("Enter"), { kind: "selected", square: "g1" });
    ui.key("ArrowUp");
    ui.key("ArrowUp"); // g3
    ui.key("ArrowLeft"); // f3
    assert.equal(ui.key(" ").kind, "moved");
    ui.key("ArrowUp");
    assert.equal(ui.focus, "f4");
  });

  it("Escape quita la selección", () => {
    const { ui } = setup();
    ui.key("Enter");
    ui.click("e2");
    assert.deepEqual(ui.key("Escape"), { kind: "deselected" });
    assert.equal(ui.selected, null);
  });

  it("devuelve focus para una tecla de movimiento y none para una tecla ajena", () => {
    const { ui } = setup();
    assert.deepEqual(ui.key("ArrowUp"), { kind: "focus", square: "e2" });
    assert.deepEqual(ui.key("x"), { kind: "none" });
  });

  it("el foco empieza en el rey del bando que mueve", () => {
    assert.equal(setup("4k3/8/8/8/8/8/8/4K3 b - - 0 1").ui.focus, "e8");
  });
});

describe("etiquetas accesibles", () => {
  it("describen la casilla y su estado", () => {
    const { ui } = setup();
    assert.equal(ui.label("e2"), "e2, peón blanco");
    ui.click("e2");
    assert.equal(ui.label("e2"), "e2, peón blanco, seleccionada");
    assert.equal(ui.label("e4"), "e4, vacía, destino posible");
  });

  it("indican captura posible y última jugada", () => {
    const { ui } = setup("4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1");
    ui.click("e4");
    assert.equal(ui.label("d5"), "d5, peón negro, captura posible");
    ui.click("e5");
    assert.equal(ui.label("e5"), "e5, peón blanco, última jugada");
  });
});

describe("deshacer y reiniciar desde la interacción", () => {
  it("deshacer quita selección y coronación pendiente", () => {
    const { game, ui } = setup();
    ui.click("e2");
    ui.click("e4");
    ui.click("e7");
    const result = ui.undo();
    assert.equal(result.kind, "undone");
    assert.equal(ui.selected, null);
    assert.equal(game.history.length, 0);
    assert.deepEqual(ui.undo(), { kind: "none" });
  });
});
