// PGN: lectura y escritura de partidas (cabeceras, SAN y resultado).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PgnError, Position, START_FEN, createRandom, moveToUci, parsePgn, writePgn } from "../src/core/index.js";

const SCHOLAR = ["e2e4", "e7e5", "f1c4", "b8c6", "d1h5", "g8f6", "h5f7"];

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

describe("PGN: escritura", () => {
  it("las siete cabeceras obligatorias, en orden, con valores por defecto", () => {
    const text = writePgn({ moves: [] });
    assert.equal(
      text,
      [
        '[Event "?"]',
        '[Site "?"]',
        '[Date "????.??.??"]',
        '[Round "?"]',
        '[White "?"]',
        '[Black "?"]',
        '[Result "*"]',
        "",
        "*",
        "",
      ].join("\n"),
    );
  });

  it("jugadas numeradas en SAN y el resultado al final", () => {
    const text = writePgn({ moves: SCHOLAR, result: "1-0", tags: [["White", "Ana"], ["Black", "Alfil Beta"]] });
    assert.match(text, /\[White "Ana"\]\n\[Black "Alfil Beta"\]\n\[Result "1-0"\]/);
    assert.ok(text.endsWith("\n1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0\n"), text);
  });

  it("cabeceras extra después de las siete, y una obligatoria dada no se repite", () => {
    const text = writePgn({ moves: [], tags: [["Annotator", "Escaque"], ["Event", "Casa"]] });
    const lines = text.split("\n");
    assert.equal(lines[0], '[Event "Casa"]');
    assert.equal(lines[7], '[Annotator "Escaque"]');
    assert.equal(text.match(/\[Event /g)?.length, 1);
  });

  it("escapa comillas y barras invertidas, y quita saltos de línea", () => {
    const text = writePgn({ moves: [], tags: [["White", 'El "Tigre" \\ de\nMalasia']] });
    assert.match(text, /\[White "El \\"Tigre\\" \\\\ de Malasia"\]/);
  });

  it("posición inicial distinta: cabeceras SetUp y FEN, y «1...» si empiezan las negras", () => {
    const fen = "4k3/8/8/8/8/8/4p3/7K b - - 0 1";
    const text = writePgn({ startFen: fen, moves: ["e2e1q"], result: "*" });
    assert.match(text, /\[SetUp "1"\]\n\[FEN "4k3\/8\/8\/8\/8\/8\/4p3\/7K b - - 0 1"\]/);
    assert.ok(text.endsWith("\n1... e1=Q+ *\n"), text);
  });

  it("la numeración sigue el número de jugada de la FEN", () => {
    const text = writePgn({ startFen: "3k4/8/8/8/8/8/8/R3K3 w Q - 0 30", moves: ["e1c1", "d8e7"] });
    assert.ok(text.endsWith("\n30. O-O-O+ Ke7 *\n"), text);
  });

  it("corta las líneas de jugadas antes de 80 caracteres", () => {
    const moves: string[] = [];
    for (let i = 0; i < 20; i++) moves.push("g1f3", "g8f6", "f3g1", "f6g8");
    const text = writePgn({ moves });
    const body = text.split("\n\n")[1]!;
    for (const line of body.split("\n")) assert.ok(line.length <= 79, `línea de ${line.length}: ${line}`);
  });

  it("rechaza una jugada ilegal", () => {
    assert.throws(() => writePgn({ moves: ["e2e5"] }), PgnError);
  });
});

describe("PGN: lectura", () => {
  it("cabeceras, jugadas en UCI y resultado", () => {
    const game = parsePgn(
      '[Event "Prueba"]\n[White "Ana"]\n[Black "Beto"]\n[Result "1-0"]\n\n1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0\n',
    );
    assert.deepEqual(game.tags, [["Event", "Prueba"], ["White", "Ana"], ["Black", "Beto"], ["Result", "1-0"]]);
    assert.equal(game.startFen, START_FEN);
    assert.deepEqual(game.moves, SCHOLAR);
    assert.equal(game.result, "1-0");
  });

  it("ignora comentarios, variantes anidadas, NAG y anotaciones", () => {
    const game = parsePgn(
      "1. e4 {la mejor} e5 (1... c5 2. Nf3 (2. c3 d5) d6) 2. Bc4!? $1 ; comentario de línea\n" +
        "Nc6 3. Qh5?! Nf6?? 4. Qxf7# 1-0",
    );
    assert.deepEqual(game.moves, SCHOLAR);
    assert.equal(game.result, "1-0");
  });

  it("acepta texto sin cabeceras, números pegados y «...»", () => {
    const game = parsePgn("1.e4 1...e5 2.Bc4");
    assert.deepEqual(game.moves, ["e2e4", "e7e5", "f1c4"]);
    assert.equal(game.result, "*");
  });

  it("acepta enroques con ceros, la BOM y saltos de línea de Windows", () => {
    const game = parsePgn("﻿[Event \"x\"]\r\n\r\n1. e4 e5 2. Nf3 Nf6 3. Bc4 Bc5 4. 0-0 O-O *\r\n");
    assert.deepEqual(game.moves.slice(-2), ["e1g1", "e8g8"]);
  });

  it("lee las escapes de las cabeceras", () => {
    const game = parsePgn('[White "El \\"Tigre\\" \\\\ x"]\n*');
    assert.deepEqual(game.tags, [["White", 'El "Tigre" \\ x']]);
  });

  it("parte de la cabecera FEN", () => {
    const game = parsePgn('[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/4p3/7K b - - 0 1"]\n\n1... e1=Q+ *');
    assert.equal(game.startFen, "4k3/8/8/8/8/8/4p3/7K b - - 0 1");
    assert.deepEqual(game.moves, ["e2e1q"]);
  });

  it("sin resultado en las jugadas, usa el de la cabecera", () => {
    assert.equal(parsePgn('[Result "1/2-1/2"]\n1. e4 e5').result, "1/2-1/2");
  });

  it("solo lee la primera partida de un fichero con varias", () => {
    const game = parsePgn('[Event "A"]\n1. e4 *\n\n[Event "B"]\n1. d4 *\n');
    assert.deepEqual(game.moves, ["e2e4"]);
    assert.deepEqual(game.tags, [["Event", "A"]]);
  });

  it("ignora las líneas de escape que empiezan por %", () => {
    assert.deepEqual(parsePgn("% exportado por algo\n1. e4 *").moves, ["e2e4"]);
  });
});

describe("PGN: errores", () => {
  it("texto vacío", () => {
    assert.equal(errorOf("   \n "), "El texto no contiene ninguna partida en PGN.");
  });

  it("jugada ilegal, con su número", () => {
    assert.equal(errorOf("1. e4 e5 2. Ke3"), "La jugada 2. Ke3 no es legal en esa posición.");
    assert.equal(errorOf("1. e4 e5 2. Nf3 Ke7 3. Bb5 Kf6 4. Nc3 Qe2"), "La jugada 4... Qe2 no es legal en esa posición.");
  });

  it("palabra que no es una jugada", () => {
    assert.equal(errorOf("1. e4 hola"), "La jugada 1... hola no es legal en esa posición.");
  });

  it("FEN de la cabecera no válida", () => {
    assert.match(errorOf('[FEN "nada"]\n*') ?? "", /^La cabecera FEN no es válida/);
  });

  it("comentario o variante sin cerrar, y cabecera mal escrita", () => {
    assert.equal(errorOf("1. e4 { sin cerrar"), "Hay un comentario sin cerrar.");
    assert.equal(errorOf("1. e4 (1. d4"), "Hay una variante sin cerrar.");
    assert.equal(errorOf('[Event "sin cerrar]\n1. e4'), "Hay una cabecera mal escrita.");
    assert.equal(errorOf("1. e4 )"), "Hay un paréntesis de cierre sin abrir.");
  });

  it("rechaza las jugadas nulas", () => {
    assert.equal(errorOf("1. e4 -- 2. d4"), "La jugada 1... -- no es legal en esa posición.");
  });

  it("límites: texto, jugadas y cabeceras demasiado largos", () => {
    assert.equal(errorOf("1. e4 " + " ".repeat(300_000)), "El PGN es demasiado largo.");
    const many = Array.from({ length: 1001 }, () => "Nf3 Nf6 Ng1 Ng8").join(" ");
    assert.equal(errorOf(many), "La partida tiene demasiadas jugadas.");
    assert.equal(errorOf(`[White "${"a".repeat(300)}"]\n*`), "Hay una cabecera demasiado larga.");
  });
});

describe("PGN: ida y vuelta", () => {
  const cases: { name: string; startFen?: string; moves: string[]; result: "1-0" | "0-1" | "1/2-1/2" | "*" }[] = [
    { name: "mate del pastor", moves: SCHOLAR, result: "1-0" },
    { name: "enroques, al paso y coronación", startFen: "r3k2r/1P6/8/3pP3/8/8/8/R3K2R w KQkq d6 0 1", moves: ["e5d6", "e8g8", "b7b8n", "f8f1", "e1f1"], result: "*" },
    { name: "desambiguación por columna y fila", startFen: "4k3/8/8/1N3N2/8/1N3N2/8/4K3 w - - 0 1", moves: ["b3d4", "e8d8", "f5d6"], result: "*" },
    { name: "empiezan las negras", startFen: "4k3/8/8/8/8/8/4p3/7K b - - 0 1", moves: ["e2e1q"], result: "0-1" },
    { name: "partida vacía", moves: [], result: "1/2-1/2" },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const tags: [string, string][] = [["White", "Blancas \"B\""], ["Black", "Negras"], ["Annotator", "Escaque"]];
      const game = { tags, moves: c.moves, result: c.result, ...(c.startFen !== undefined ? { startFen: c.startFen } : {}) };
      const text = writePgn(game);
      const back = parsePgn(text);
      assert.deepEqual(back.moves, c.moves);
      assert.equal(back.result, c.result);
      assert.equal(back.startFen, c.startFen ?? START_FEN);
      assert.equal(writePgn({ tags: back.tags, startFen: back.startFen, moves: back.moves, result: back.result }), text);
    });
  }
});

describe("PGN: partidas al azar y texto basura", () => {
  it("ida y vuelta de 20 partidas de jugadas legales al azar", () => {
    const random = createRandom(2026);
    for (let g = 0; g < 20; g++) {
      const position = Position.fromFen(START_FEN);
      const moves: string[] = [];
      while (moves.length < 160 && position.status().kind === "ongoing") {
        const legal = position.legalMoves();
        const move = legal[random() % legal.length]!;
        moves.push(moveToUci(move));
        position.makeMove(move);
      }
      assert.deepEqual(parsePgn(writePgn({ moves })).moves, moves);
    }
  });

  it("el texto basura solo produce PgnError", () => {
    const random = createRandom(7);
    const alphabet = '[]{}()";%$.-01/*\\ \nabcdefghNBRQKOx+#=!?12345678';
    for (let n = 0; n < 2000; n++) {
      let text = "";
      const length = random() % 40;
      for (let i = 0; i < length; i++) text += alphabet[random() % alphabet.length];
      try {
        parsePgn(text);
      } catch (error) {
        assert.ok(error instanceof PgnError, `${JSON.stringify(text)}: ${String(error)}`);
      }
    }
  });
});
