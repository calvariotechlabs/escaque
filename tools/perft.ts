// Herramienta de perft dividido: cuántas posiciones salen por cada jugada inicial.
//
//   npm run perft -- <profundidad> ["<fen>"] [jugadas UCI...] [--ref <fichero>]
//
// La salida tiene el formato de «go perft» de Stockfish para poder compararla
// línea a línea. Con --ref se comparan automáticamente y se listan solo las
// jugadas que no cuadran: se baja por esa rama añadiendo la jugada y restando
// uno a la profundidad, hasta dar con la jugada que falta o sobra.
import { FenError, Position, formatDivide, moveToUci, perftDivide } from "../src/core/index.js";
import { nodeProcess } from "./node.js";
import { USAGE, compareReport, parsePerftArgs } from "./perft-cli.js";

const proc = nodeProcess();

function main(): number {
  let args;
  try {
    args = parsePerftArgs(proc.argv.slice(2));
  } catch (error) {
    proc.stderr.write(`${(error as Error).message}\n\n${USAGE}\n`);
    return 2;
  }

  // La referencia se lee antes de calcular: un error en el fichero no debe
  // aparecer después de minutos de perft.
  let reference: string | null = null;
  if (args.reference !== null) {
    try {
      reference = proc.getBuiltinModule("node:fs").readFileSync(args.reference, "utf8");
    } catch (error) {
      proc.stderr.write(`No se pudo leer ${args.reference}: ${(error as Error).message}\n`);
      return 2;
    }
  }

  let position: Position;
  try {
    position = Position.fromFen(args.fen);
  } catch (error) {
    if (!(error instanceof FenError)) throw error;
    proc.stderr.write(`FEN no válida: ${error.message}\n`);
    return 2;
  }
  for (const uci of args.moves) {
    const move = position.moveFromUci(uci);
    if (move === null) {
      proc.stderr.write(`La jugada ${uci} no es legal en ${position.toFen()}\n`);
      return 2;
    }
    position.makeMove(move);
  }

  const start = performance.now();
  const result = perftDivide(position, args.depth, moveToUci);
  const ms = performance.now() - start;
  proc.stdout.write(formatDivide(result));
  const nps = ms > 0 ? Math.round((result.total / ms) * 1000) : 0;
  proc.stderr.write(`\nFEN: ${position.toFen()}\nTiempo: ${ms.toFixed(0)} ms (${nps} nodos/s)\n`);

  let report;
  try {
    report = compareReport(result, reference);
  } catch (error) {
    proc.stderr.write(`Referencia no válida: ${(error as Error).message}\n`);
    return 2;
  }
  proc.stdout.write(report.text);
  return report.exitCode;
}

proc.exitCode = main();
