// Clave Zobrist de la posición y generador aleatorio propio.
// La clave identifica la posición a efectos de repetición: piezas, bando al
// mover, derechos de enroque y captura al paso solo si es legal.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Position, START_FEN, createRandom } from "../src/core/index.js";
import { after, play } from "./helpers.js";

const KIWIPETE = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";

const keyOf = (p: Position): string => `${p.hashHi}:${p.hashLo}`;

describe("createRandom", () => {
  it("con la misma semilla da la misma serie", () => {
    const a = createRandom(42);
    const b = createRandom(42);
    for (let i = 0; i < 100; i++) assert.equal(a(), b());
  });

  it("con otra semilla da otra serie", () => {
    const a = createRandom(1);
    const b = createRandom(2);
    const same = Array.from({ length: 20 }, () => a() === b()).filter(Boolean).length;
    assert.ok(same < 2);
  });

  it("da enteros sin signo de 32 bits bien repartidos", () => {
    const next = createRandom(7);
    let high = 0;
    for (let i = 0; i < 10_000; i++) {
      const value = next();
      assert.ok(Number.isInteger(value) && value >= 0 && value <= 0xffffffff, `fuera de rango: ${value}`);
      if (value >= 0x80000000) high++;
    }
    // La mitad superior debe salir más o menos la mitad de las veces.
    assert.ok(high > 4_700 && high < 5_300, `bit alto sesgado: ${high}`);
  });
});

describe("clave Zobrist", () => {
  it("las dos mitades son enteros sin signo de 32 bits", () => {
    const p = Position.fromFen(START_FEN);
    for (const half of [p.hashHi, p.hashLo]) {
      assert.ok(Number.isInteger(half) && half >= 0 && half <= 0xffffffff);
    }
  });

  it("la misma posición por distinto camino tiene la misma clave", () => {
    const a = after(START_FEN, "g1f3", "g8f6", "b1c3");
    const b = after(START_FEN, "b1c3", "g8f6", "g1f3");
    assert.equal(keyOf(a), keyOf(b));
  });

  it("cambia con el bando al mover", () => {
    const white = Position.fromFen("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
    const black = Position.fromFen("4k3/8/8/8/8/8/8/4K3 b - - 0 1");
    assert.notEqual(keyOf(white), keyOf(black));
  });

  it("cambia con los derechos de enroque", () => {
    const all = Position.fromFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    const some = Position.fromFen("r3k2r/8/8/8/8/8/8/R3K2R w Kq - 0 1");
    assert.notEqual(keyOf(all), keyOf(some));
  });

  it("incluye la casilla al paso solo si la captura al paso es legal", () => {
    // Tras 1.e4 no hay peón negro que pueda capturar al paso: la misma clave que sin casilla.
    assert.equal(
      keyOf(Position.fromFen("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1")),
      keyOf(Position.fromFen("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1")),
    );
    // Con un peón en d5 que sí puede capturar al paso, la clave es otra.
    assert.notEqual(
      keyOf(Position.fromFen("4k3/8/8/3Pp3/8/8/8/4K3 w - e6 0 1")),
      keyOf(Position.fromFen("4k3/8/8/3Pp3/8/8/8/4K3 w - - 0 1")),
    );
    // Clavada por la torre: no es legal, así que tampoco cuenta.
    assert.equal(
      keyOf(Position.fromFen("4k3/8/8/r2pP2K/8/8/8/8 w - d6 0 1")),
      keyOf(Position.fromFen("4k3/8/8/r2pP2K/8/8/8/8 w - - 0 1")),
    );
  });

  it("deshacer una jugada recupera la clave", () => {
    const p = Position.fromFen(KIWIPETE);
    const before = keyOf(p);
    for (const move of p.legalMoves()) {
      p.makeMove(move);
      p.unmakeMove();
      assert.equal(keyOf(p), before);
    }
  });

  it("la clave incremental coincide con la calculada desde la FEN en partidas al azar", () => {
    const random = createRandom(2026);
    for (const start of [START_FEN, KIWIPETE, "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1"]) {
      for (let game = 0; game < 20; game++) {
        const p = Position.fromFen(start);
        for (let ply = 0; ply < 80; ply++) {
          const moves = p.legalMoves();
          if (moves.length === 0) break;
          p.makeMove(moves[random() % moves.length]!);
          assert.equal(keyOf(p), keyOf(Position.fromFen(p.toFen())), `tras ${ply + 1} jugadas: ${p.toFen()}`);
        }
      }
    }
  });
});

describe("repetitions()", () => {
  it("cuenta cuántas veces apareció antes la posición actual", () => {
    const p = Position.fromFen(START_FEN);
    assert.equal(p.repetitions(), 0);
    play(p, "g1f3", "g8f6", "f3g1", "f6g8");
    assert.equal(p.repetitions(), 1);
    play(p, "g1f3", "g8f6", "f3g1", "f6g8");
    assert.equal(p.repetitions(), 2);
  });

  it("no mira más allá de la última jugada de peón o captura", () => {
    const p = after(START_FEN, "g1f3", "g8f6", "f3g1", "f6g8", "e2e4", "e7e5");
    play(p, "g1f3", "g8f6", "f3g1", "f6g8");
    assert.equal(p.repetitions(), 1);
  });
});
