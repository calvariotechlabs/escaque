// Pruebas de rendimiento: aserciones sobre el reloj real (milisegundos).
//
// Viven aparte de la suite funcional (`npm test`) porque dependen de la velocidad de la máquina: con la
// instrumentación de cobertura el motor va unas 3 veces más lento y estas pruebas fallarían sin que el
// producto estuviera peor (RC-06, H-19). Se ejecutan con `npm run test:perf` y tienen su trabajo en la CI.
// Sus umbrales son los de siempre: si el motor se vuelve lento, estas pruebas SIGUEN fallando.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Position, START_FEN } from "../../src/core/index.js";
import { search, chooseMove } from "../../src/engine/index.js";
import { analyzeMove } from "../../src/coach/index.js";

const KIWIPETE = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";

const MIDDLEGAMES = [
  START_FEN,
  KIWIPETE,
  "r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP3PPP/R1BQKB1R w KQ - 0 8",
  "r2q1rk1/pp1nbppp/2p1pn2/3p1b2/2PP4/1PN1PN2/PB3PPP/R2QKB1R w KQ - 1 9",
];

describe("rendimiento (reloj real)", () => {
  it("la búsqueda respeta el límite de tiempo", () => {
    const started = performance.now();
    search(Position.fromFen(KIWIPETE), { timeMs: 150 });
    const elapsed = performance.now() - started;
    assert.ok(elapsed < 400, `tardó ${elapsed.toFixed(0)} ms`);
  });

  it("Difícil responde en menos de 1 s", () => {
    // Mide la capacidad del motor, no el ruido del ejecutor: en una CI cargada una pausa del sistema puede
    // estropear un intento suelto, así que cada posición cuenta si alguno de hasta 3 intentos cumple.
    for (const fen of MIDDLEGAMES) {
      let last = "";
      let ok = false;
      for (let attempt = 0; attempt < 3 && !ok; attempt++) {
        const started = performance.now();
        const result = chooseMove(Position.fromFen(fen), "dificil");
        const elapsed = performance.now() - started;
        ok = elapsed < 1000 && result.best !== null && result.depth >= 3;
        last = `${elapsed.toFixed(0)} ms, profundidad ${result.depth}`;
      }
      assert.ok(ok, `${fen}: ${last}`);
    }
  });

  it("Medio responde en menos de 0,6 s (presupuesto de 0,5 s más margen; mejor de 3 intentos como en Difícil)", () => {
    for (const fen of MIDDLEGAMES) {
      const times: number[] = [];
      for (let attempt = 0; attempt < 3; attempt++) {
        const started = performance.now();
        chooseMove(Position.fromFen(fen), "medio");
        times.push(performance.now() - started);
        if (times[attempt]! < 600) break;
      }
      assert.ok(Math.min(...times) < 600, `${fen}: ${times.map((t) => t.toFixed(0)).join(", ")} ms`);
    }
  });

  it("el coach, con límites por defecto, responde en menos de 3 s", () => {
    const start = performance.now();
    analyzeMove({ fen: START_FEN, moves: ["e2e4", "e7e5", "g1f3", "b8c6"] }, "f3g5");
    const elapsed = performance.now() - start;
    assert.ok(elapsed < 3000, `${elapsed.toFixed(0)} ms`);
  });
});
