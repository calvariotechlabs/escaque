// Niveles de Alfil Beta: Fácil, Medio y Difícil.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Position, START_FEN, createRandom } from "../src/core/index.js";
import { LEVELS, chooseMove, isLevel } from "../src/engine/index.js";
import { after } from "./helpers.js";

const MIDDLEGAMES = [
  START_FEN,
  "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
  "r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP3PPP/R1BQKB1R w KQ - 0 8",
  "r2q1rk1/pp1nbppp/2p1pn2/3p1b2/2PP4/1PN1PN2/PB3PPP/R2QKB1R w KQ - 1 9",
];

const MATES_IN_1 = [
  "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1",
  "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
  "4r1k1/8/8/8/8/8/5PPP/6K1 b - - 0 1",
];

describe("niveles", () => {
  it("son los tres del plan", () => {
    assert.deepEqual(Object.keys(LEVELS), ["facil", "medio", "dificil"]);
    assert.deepEqual(LEVELS.facil, { maxDepth: 1, timeMs: 1000, marginCp: 150 });
    assert.deepEqual(LEVELS.medio, { maxDepth: 3, timeMs: 500, marginCp: 0 });
    assert.deepEqual(LEVELS.dificil, { maxDepth: 64, timeMs: 900, marginCp: 0 });
  });

  it("isLevel() solo acepta los nombres de nivel", () => {
    assert.ok(isLevel("facil") && isLevel("medio") && isLevel("dificil"));
    for (const other of ["", "Facil", "fácil", "toString", "__proto__", 3, null, undefined]) assert.equal(isLevel(other), false);
  });

  it("Difícil y Medio devuelven jugada y respetan su profundidad (los tiempos se miden en tests/rendimiento)", () => {
    for (const fen of MIDDLEGAMES) {
      const hard = chooseMove(Position.fromFen(fen), "dificil");
      assert.ok(hard.best !== null && hard.depth >= 1, fen);
      const medium = chooseMove(Position.fromFen(fen), "medio");
      assert.ok(medium.depth >= 1 && medium.depth <= 3, fen);
    }
  });

  it("Fácil es reproducible con la misma semilla", () => {
    const a = chooseMove(Position.fromFen(START_FEN), "facil", { random: createRandom(5) });
    const b = chooseMove(Position.fromFen(START_FEN), "facil", { random: createRandom(5) });
    assert.equal(a.best, b.best);
  });

  it("Fácil varía sus jugadas", () => {
    const seen = new Set<string | null>();
    for (let seed = 0; seed < 20; seed++) {
      seen.add(chooseMove(Position.fromFen(START_FEN), "facil", { random: createRandom(seed) }).best);
    }
    assert.ok(seen.size >= 4, `solo ${seen.size} jugadas distintas`);
  });

  it("Fácil nunca deja escapar un mate en 1", () => {
    for (const fen of MATES_IN_1) {
      for (let seed = 0; seed < 10; seed++) {
        const p = Position.fromFen(fen);
        const result = chooseMove(p, "facil", { random: createRandom(seed) });
        const move = p.moveFromUci(result.best ?? "");
        assert.ok(move !== null);
        p.makeMove(move);
        assert.equal(p.status().kind, "checkmate", `${fen} con semilla ${seed}: ${result.best}`);
      }
    }
  });

  it("Fácil no regala una dama", () => {
    // La dama de d4 está atacada por el peón de e5: todas las jugadas que no la salvan pierden 900.
    for (let seed = 0; seed < 10; seed++) {
      const p = Position.fromFen("4k3/8/8/4p3/3Q4/8/8/4K3 w - - 0 1");
      const result = chooseMove(p, "facil", { random: createRandom(seed) });
      assert.ok(result.best?.startsWith("d4"), `semilla ${seed}: ${result.best}`);
    }
  });

  // Parte funcional del criterio «Difícil responde en menos de 1 s» (la de rendimiento, en tiempo real, está arriba):
  // con reloj simulado no depende de la máquina.
  it("Difícil respeta su presupuesto de 0,9 s: con un reloj simulado para en cuanto se agota", () => {
    for (const fen of MIDDLEGAMES) {
      // Cada consulta del reloj «cuesta» 10 ms: 0,9 s de presupuesto = 90 consultas más la primera.
      let ms = 0;
      let calls = 0;
      const now = (): number => {
        calls++;
        return (ms += 10);
      };
      const result = chooseMove(Position.fromFen(fen), "dificil", { now });
      assert.ok(ms <= LEVELS.dificil.timeMs + 20, `${fen}: el reloj simulado llegó a ${ms} ms`);
      assert.ok(calls <= 92, `${fen}: ${calls} consultas del reloj`);
      assert.ok(result.best !== null && result.depth >= 3, `${fen}: profundidad ${result.depth}`);
    }
  });

  it("sin jugadas legales devuelve null en todos los niveles", () => {
    const mated = after("rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2", "d8h4");
    for (const level of ["facil", "medio", "dificil"] as const) assert.equal(chooseMove(mated, level).best, null);
  });

  it("rechaza un nivel desconocido", () => {
    assert.throws(() => chooseMove(Position.fromFen(START_FEN), "imposible" as never), RangeError);
  });
});
