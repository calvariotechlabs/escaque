// Lógica de la herramienta de perft dividido: argumentos y comparación con la referencia.
import { START_FEN, compareDivide, parseDivide, type DivideResult } from "../src/core/index.js";

export interface PerftArgs {
  readonly depth: number;
  readonly fen: string;
  /** Jugadas UCI que se aplican antes de dividir (para bajar por una rama). */
  readonly moves: readonly string[];
  /** Fichero con el desglose de referencia (salida de Stockfish u otra herramienta). */
  readonly reference: string | null;
}

export const USAGE = `Uso: npm run perft -- <profundidad> ["<fen>"] [jugadas UCI...] [--ref <fichero>]

  <profundidad>   entero >= 1
  "<fen>"         posición (por defecto, la inicial)
  jugadas         jugadas UCI que se juegan antes de dividir, p. ej. e2e4 e7e5
  --ref fichero   desglose de referencia (p. ej. salida de «go perft» de Stockfish);
                  se listan las jugadas cuyo conteo no coincide

Ejemplo: npm run perft -- 3 "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1" e1g1`;

const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

export function parsePerftArgs(argv: readonly string[]): PerftArgs {
  const positional: string[] = [];
  let reference: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--ref") {
      const file = argv[++i];
      if (file === undefined || file === "") throw new Error("--ref necesita el nombre de un fichero");
      reference = file;
    } else {
      positional.push(arg);
    }
  }

  const [depthArg, ...afterDepth] = positional;
  // La FEN es opcional: si el segundo argumento ya es una jugada, se parte de la inicial.
  const fenArg = afterDepth[0] !== undefined && !UCI.test(afterDepth[0].split(/\s+/)[0] ?? "") ? afterDepth.shift() : undefined;
  const rest = afterDepth;
  const depth = Number(depthArg);
  if (depthArg === undefined || !/^\d+$/.test(depthArg) || depth < 1) {
    throw new Error(`Profundidad no válida: ${depthArg ?? "(falta)"}`);
  }

  const moves = rest.flatMap((arg) => arg.split(/\s+/)).filter((m) => m !== "");
  for (const move of moves) {
    if (!UCI.test(move)) throw new Error(`Jugada no válida (se espera UCI, p. ej. e2e4): ${move}`);
  }

  return { depth, fen: fenArg ?? START_FEN, moves, reference };
}

/**
 * Compara nuestro desglose con el de referencia (texto de otra herramienta).
 * Código de salida: 0 si coincide o no hay referencia, 1 si hay diferencias
 * (incluida una jugada que generamos dos veces) y 2 si la referencia no
 * contiene ningún conteo.
 */
export function compareReport(result: DivideResult, referenceText: string | null): { text: string; exitCode: number } {
  if (referenceText === null) return { text: "", exitCode: 0 };
  const reference = parseDivide(referenceText);
  if (reference.size === 0) {
    return { text: "\nEl fichero de referencia no contiene ninguna línea «jugada: nodos».\n", exitCode: 2 };
  }
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const m of result.moves) (seen.has(m.move) ? duplicated : seen).add(m.move);
  if (duplicated.size > 0) {
    const names = [...duplicated].sort().join(", ");
    return { text: `\nGeneramos dos veces la misma jugada: ${names}. Es un fallo del generador.\n`, exitCode: 1 };
  }
  const ours = new Map(result.moves.map((m) => [m.move, m.nodes] as const));
  const mismatches = compareDivide(ours, reference);
  if (mismatches.length === 0) {
    return { text: `\nCoincide con la referencia (${reference.size} jugadas).\n`, exitCode: 0 };
  }
  const lines = mismatches.map((m) => {
    const a = m.ours === null ? "no la generamos" : String(m.ours);
    const b = m.reference === null ? "no existe (jugada ilegal)" : String(m.reference);
    return `  ${m.move}: nuestro ${a}, referencia ${b}\n`;
  });
  return { text: `\nNo coincide con la referencia en ${mismatches.length} jugada(s):\n${lines.join("")}`, exitCode: 1 };
}
