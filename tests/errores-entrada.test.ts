// B8 · Errores de entrada (issue #75): PGN en notación española, motivo de una jugada
// no válida en el tablero y ahogado en el coach.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PgnError, Position, START_FEN, moveToUci, parsePgn } from "../src/core/index.js";
import { analyzeMove, checkInvariants } from "../src/coach/index.js";
import { Game } from "../src/ui/game.js";
import { Interaction } from "../src/ui/interaction.js";
import { illegalMoveMessage } from "../src/ui/notation.js";

/** Mensaje de error de parsePgn, o null si no falla. */
function errorOf(text: string): string | null {
  try {
    parsePgn(text);
    return null;
  } catch (error) {
    assert.ok(error instanceof PgnError, `se esperaba PgnError y llegó ${String(error)}`);
    return (error as PgnError).message;
  }
}

describe("PGN en notación española (H-17)", () => {
  it("la partida de la auditoría con C y A se carga igual que en inglés", () => {
    const spanish = parsePgn("1. e4 e5 2. Cf3 Cc6");
    const english = parsePgn("1. e4 e5 2. Nf3 Nc6");
    assert.deepEqual(spanish.moves, english.moves);
    assert.deepEqual(spanish.moves, ["e2e4", "e7e5", "g1f3", "b8c6"]);
  });

  it("acepta T, D, R, enroques, capturas, jaques y desambiguación", () => {
    const game = parsePgn("1. e4 e5 2. Cf3 Cc6 3. Ac4 Ac5 4. O-O Cf6 5. Te1 O-O 6. c3 d6 7. d4 exd4 8. cxd4 Ab4 9. Cbd2 De7");
    assert.equal(game.moves.length, 18);
    assert.equal(game.moves[8], "f1e1"); // 5. Te1: la torre
    assert.equal(game.moves[16], "b1d2"); // 9. Cbd2
    assert.equal(game.moves[17], "d8e7"); // 9… De7: la dama
  });

  it("R es el rey en una partida española y la torre en una inglesa", () => {
    // Tras 3… Ac5, «Rf1» es legal con las dos lecturas: el rey de e1 o la torre de h1.
    assert.equal(parsePgn("1. e4 e5 2. Cf3 Cc6 3. Ac4 Ac5 4. Rf1").moves[6], "e1f1");
    assert.equal(parsePgn("1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. Rf1").moves[6], "h1f1");
  });

  it("una partida sin C, A, T ni D que solo es legal leyendo R como rey se lee en español", () => {
    assert.deepEqual(parsePgn("1. e4 e5 2. Re2 Re7").moves, ["e2e4", "e7e5", "e1e2", "e8e7"]);
  });

  it("coronación en español, con y sin «=»", () => {
    const fen = "8/P6k/8/8/8/8/6K1/8 w - - 0 1";
    assert.deepEqual(parsePgn(`[SetUp "1"]\n[FEN "${fen}"]\n\n1. a8=D`).moves, ["a7a8q"]);
    assert.deepEqual(parsePgn(`[SetUp "1"]\n[FEN "${fen}"]\n\n1. a8C`).moves, ["a7a8n"]);
  });

  it("si las dos lecturas fallan, el error es el de la que llegó más lejos", () => {
    // En inglés falla en 2. Re2 (la torre no llega); en español llega hasta el error real, 3. Cx9.
    assert.equal(errorOf("1. e4 e5 2. Re2 Re7 3. Cx9"), "La jugada 3. Cx9 no es legal en esa posición.");
    assert.equal(errorOf("1. e4 e5 2. Re2 Re7 3. d4 d5 4. Qz9"), "La jugada 4. Qz9 no es legal en esa posición.");
  });

  it("una jugada ilegal en las dos notaciones sigue dando el error de siempre, con la jugada tal como se escribió", () => {
    assert.equal(errorOf("1. e4 e5 2. Cf3 Cf5"), "La jugada 2... Cf5 no es legal en esa posición.");
    assert.equal(errorOf("1. e4 e5 2. Ke3"), "La jugada 2. Ke3 no es legal en esa posición.");
  });
});

describe("Posición: jugadas pseudolegales", () => {
  it("distingue una pieza clavada (pseudolegal) de una casilla a la que no llega", () => {
    // El caballo de d2 está clavado por el alfil de b4.
    const p = Position.fromFen("4k3/8/8/8/1b6/8/3N4/4K3 w - - 0 1");
    const d2 = 0x13;
    assert.equal(p.isPseudoLegal(d2, 0x34), true); // d2-e4: el caballo llega, pero deja al rey en jaque
    assert.equal(p.isPseudoLegal(d2, 0x33), false); // d2-d4: un caballo no va ahí
    assert.equal(p.isPseudoLegal(0x37, 0x47), false); // casilla vacía
  });
});

describe("Jugada no válida en el tablero (H-16)", () => {
  function setup(fen?: string): { game: Game; ui: Interaction } {
    const game = new Game(fen);
    return { game, ui: new Interaction(game) };
  }

  it("un caballo que no llega a la casilla: motivo «no-llega» (Cb8 a d5, auditoría)", () => {
    const { game, ui } = setup();
    game.play("e2", "e4");
    ui.click("b8");
    assert.deepEqual(ui.click("d5"), { kind: "illegal", from: "b8", to: "d5", reason: "no-llega", piece: "n" });
    assert.equal(ui.selected, null);
  });

  it("una pieza clavada: motivo «deja-en-jaque»", () => {
    // La torre de e2 está clavada por la de e7: solo puede moverse por la columna.
    const { ui } = setup("4k3/4r3/8/8/8/8/4R3/4K3 w - - 0 1");
    ui.click("e2");
    assert.deepEqual(ui.click("d2"), { kind: "illegal", from: "e2", to: "d2", reason: "deja-en-jaque", piece: "r" });
  });

  it("el rey a una casilla atacada: motivo «deja-en-jaque»", () => {
    const { ui } = setup("4k3/8/8/8/8/8/r7/4K3 w - - 0 1");
    ui.click("e1");
    assert.equal(ui.click("e2").kind, "illegal");
    ui.click("e1");
    const outcome = ui.click("d2");
    assert.equal(outcome.kind === "illegal" ? outcome.reason : "", "deja-en-jaque");
  });

  it("en jaque, una jugada que no lo evita: motivo «sigue-en-jaque»", () => {
    // La torre de a1 da jaque; el caballo de e3 solo puede tapar en d1.
    const { ui } = setup("4k3/8/8/8/8/4N3/8/r3K3 w - - 0 1");
    ui.click("e3");
    const outcome = ui.click("c2");
    assert.equal(outcome.kind === "illegal" ? outcome.reason : "", "sigue-en-jaque");
  });

  it("un enroque que no se puede hacer ahora: motivo «enroque»", () => {
    // La torre negra de f8 ataca f1: el rey no puede pasar.
    const { ui } = setup("4kr2/8/8/8/8/8/8/4K2R w K - 0 1");
    ui.click("e1");
    const outcome = ui.click("g1");
    assert.equal(outcome.kind === "illegal" ? outcome.reason : "", "enroque");
  });

  it("sin derecho a enrocar, el rey que va dos casillas no es un enroque", () => {
    const { ui } = setup("4k3/8/8/8/8/8/8/4K2R w - - 0 1");
    ui.click("e1");
    const outcome = ui.click("g1");
    assert.equal(outcome.kind === "illegal" ? outcome.reason : "", "no-llega");
  });

  it("soltar arrastrando en una casilla no válida da el motivo; fuera del tablero, no", () => {
    const { ui } = setup();
    ui.dragStart("g1");
    assert.equal(ui.drop("g4").kind, "illegal");
    ui.dragStart("g1");
    assert.deepEqual(ui.drop(null), { kind: "deselected" });
  });

  it("pulsar una pieza propia sin jugadas quita la selección sin mensaje", () => {
    const { ui } = setup();
    ui.click("g1");
    assert.deepEqual(ui.click("a1"), { kind: "deselected" }); // la torre de a1 no tiene jugadas
    ui.dragStart("g1");
    assert.deepEqual(ui.drop("e1"), { kind: "deselected" }); // soltar sobre el rey propio
  });

  it("pulsar otra pieza propia cambia la selección sin mensaje", () => {
    const { ui } = setup();
    ui.click("g1");
    assert.deepEqual(ui.click("b1"), { kind: "selected", square: "b1" });
  });

  it("textos del aviso, con el género de la pieza", () => {
    assert.equal(illegalMoveMessage("no-llega", "n", "d5"), "Ese caballo no puede ir a d5.");
    assert.equal(illegalMoveMessage("no-llega", "r", "a5"), "Esa torre no puede ir a a5.");
    assert.equal(illegalMoveMessage("no-llega", "q", "h4"), "Esa dama no puede ir a h4.");
    assert.equal(illegalMoveMessage("no-llega", "p", "e5"), "Ese peón no puede ir a e5.");
    assert.equal(illegalMoveMessage("deja-en-jaque", "n", "e4"), "Con esa jugada tu rey quedaría en jaque.");
    assert.equal(illegalMoveMessage("sigue-en-jaque", "p", "d3"), "Con esa jugada tu rey seguiría en jaque.");
    assert.equal(illegalMoveMessage("enroque", "k", "g1"), "Ahora no puedes enrocar por ese lado.");
  });
});

describe("Coach: ahogado (H-13)", () => {
  // Ahogado en diez jugadas de Sam Loyd, el caso de la auditoría (10. De6).
  const SAN = "e3 a5 Qh5 Ra6 Qxa5 h5 h4 Rah6 Qxc7 f6 Qxd7+ Kf7 Qxb7 Qd3 Qxb8 Qh7 Qxc8 Kg6 Qe6".split(" ");
  const position = Position.fromFen(START_FEN);
  const moves = SAN.map((san) => {
    const move = position.moveFromSan(san)!;
    position.makeMove(move);
    return moveToUci(move);
  });
  const last = moves.pop()!;
  const game = { fen: START_FEN, moves };

  it("la frase del veredicto nombra el ahogado y el «Por qué» lo explica", () => {
    const report = analyzeMove(game, last);
    assert.equal(report.summary, "De6 ahoga al rey negro: la partida acaba en tablas.");
    assert.match(report.why, /^Las negras no están en jaque y no pueden mover ninguna pieza: eso es ahogado, y vale tablas\. Con De8\+, \+19,9 frente a 0,0\.$/);
    assert.equal(report.verdict, "error-grave");
    assert.deepEqual(checkInvariants(report, game), []);
  });

  it("invariante: si la jugada ahoga, la frase del veredicto lo dice", () => {
    const report = analyzeMove(game, last);
    const broken = { ...report, summary: "De6 no aprovecha la captura del alfil de f8." };
    assert.ok(checkInvariants(broken, game).some((v) => v.includes("ahogado")));
  });
});
