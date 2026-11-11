// Mide los niveles de Alfil Beta con partidas automáticas.
//
//   npm run match            (unos 15 minutos: Difícil piensa 0,9 s por jugada)
//   npm run match -- 4       (4 partidas por enfrentamiento en vez de las de serie)
//
// Enfrentamientos: Difícil contra un jugador al azar, Difícil contra Fácil y
// Medio contra Fácil, alternando colores. Muestra el marcador y el tiempo por
// jugada de Difícil (media y máximo).
import { createRandom } from "../src/core/index.js";
import { enginePlayer, playGame, randomPlayer } from "./match-core.js";
import type { Player } from "./match-core.js";
import { nodeProcess } from "./node.js";

const proc = nodeProcess();

/** Envuelve un jugador para apuntar cuánto tarda cada jugada en `times`. */
function timed(player: Player, times: number[]): Player {
  return (position) => {
    const started = performance.now();
    const move = player(position);
    times.push(performance.now() - started);
    return move;
  };
}

function series(name: string, games: number, makeA: (game: number) => Player, makeB: (game: number) => Player): void {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  for (let game = 0; game < games; game++) {
    const a = makeA(game);
    const b = makeB(game);
    const aIsWhite = game % 2 === 0;
    const record = aIsWhite ? playGame(a, b) : playGame(b, a);
    const aWon = record.result === (aIsWhite ? "1-0" : "0-1");
    if (aWon) wins++;
    else if (record.result === "1/2-1/2") draws++;
    else losses++;
    proc.stdout.write(`  ${name} #${game + 1} (${aIsWhite ? "blancas" : "negras"}): ${record.result} por ${record.reason} en ${record.plies} medias jugadas\n`);
  }
  proc.stdout.write(`${name}: +${wins} =${draws} -${losses} de ${games}\n\n`);
}

const arg = proc.argv[2];
const games = arg === undefined ? null : Number(arg);
if (games !== null && (!Number.isInteger(games) || games < 1)) {
  proc.stderr.write("Uso: npm run match -- [partidas por enfrentamiento]\n");
  proc.exitCode = 2;
} else {
  const hardTimes: number[] = [];
  const hard = (): Player => timed(enginePlayer("dificil"), hardTimes);
  series("Difícil contra azar", games ?? 20, hard, (g) => randomPlayer(createRandom(1000 + g)));
  series("Difícil contra Fácil", games ?? 10, hard, (g) => enginePlayer("facil", createRandom(2000 + g)));
  series("Medio contra Fácil", games ?? 10, () => enginePlayer("medio"), (g) => enginePlayer("facil", createRandom(3000 + g)));
  const average = hardTimes.reduce((sum, t) => sum + t, 0) / hardTimes.length;
  proc.stdout.write(`Difícil: ${hardTimes.length} jugadas, media ${average.toFixed(0)} ms, máximo ${Math.max(...hardTimes).toFixed(0)} ms\n`);
}
