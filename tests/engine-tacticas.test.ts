// Regresión de B11 (RC-12, H-14): las posiciones tácticas del banco en las que Alfil
// Beta cometía errores de más de 2 peones según la referencia de Stockfish
// (bench/resultados/antes-b1.md y la medición inicial de B11).
//
// Se busca con un tope de nodos y no de tiempo, para que el resultado sea el mismo en
// cualquier equipo. El tope es una parte de lo que Difícil mira en 0,9 s en un equipo
// normal, así que cubre también los equipos lentos.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Position } from "../src/core/index.js";
import { TranspositionTable, search } from "../src/engine/index.js";
import { ERROR_MOTOR_CP, calidad } from "../tools/banco-core.js";
import type { PosicionBanco, Referencia } from "../tools/banco-core.js";
import { nodeProcess } from "../tools/node.js";

const fs = nodeProcess().getBuiltinModule("node:fs");
const banco = JSON.parse(fs.readFileSync("bench/posiciones.json", "utf8")) as PosicionBanco[];
const referencia = JSON.parse(fs.readFileSync("bench/referencia-stockfish.json", "utf8")) as Referencia;

/** Nodos por búsqueda: lo que Difícil mira en 0,9 s en el contenedor de 4 núcleos (unos 220.000-410.000). */
export const TACTICS_NODE_BUDGET = 350_000;

/** Posición del banco, la jugada que se hacía antes y su pérdida según la referencia. */
const DEFECTOS: readonly (readonly [id: string, antes: string])[] = [
  ["auditoria-h-07", "a1b1"],
  ["auditoria-h-10", "d8f6"],
  ["gana-arca-noe", "c8e6"],
  ["pierde-arca-noe", "d1d4"],
  ["pierde-elefante", "c3d5"],
];

/**
 * Limitación conocida, con excepción aprobada por Sergio el 24-nov-2026 (issue #63): el
 * mismo ataque al rey de H-14, que Stockfish ve y Alfil Beta no ve ni a profundidad 9
 * porque su evaluación no aprecia el ataque. Se ejecutan y se informan, pero no fallan.
 */
const LIMITACIONES: readonly (readonly [id: string, antes: string])[] = [
  ["auditoria-h-14", "d8a5"], // 10…Da5, el error de las dos auditorías
  ["auditoria-h-02b", "a1b1"],
];

describe("Alfil Beta en las posiciones tácticas donde fallaba (B11)", () => {
  const casos = [...DEFECTOS.map((d) => [...d, false] as const), ...LIMITACIONES.map((d) => [...d, true] as const)];
  for (const [id, antes, limitacion] of casos) {
    const nombre = `${id}: no pierde más de 2 peones (antes ${antes})`;
    const opciones = limitacion ? { todo: "limitación conocida con excepción aprobada (issue #63)" } : {};
    it(nombre, opciones, () => {
      const posicion = banco.find((p) => p.id === id);
      assert.ok(posicion !== undefined, id);
      const ref = referencia.posiciones[id]!;
      assert.ok(calidad(ref, antes).perdidaCp > ERROR_MOTOR_CP, `${antes} debería ser un error en la referencia`);
      const r = search(Position.fromFen(posicion.fen), { maxDepth: 64 }, { table: new TranspositionTable(), maxNodes: TACTICS_NODE_BUDGET });
      const q = calidad(ref, r.best!);
      assert.ok(q.perdidaCp <= ERROR_MOTOR_CP, `${r.best} pierde ${q.perdidaCp} cp (profundidad ${r.depth})`);
    });
  }
});
