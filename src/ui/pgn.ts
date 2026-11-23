// Exportar e importar partidas en PGN desde la interfaz. Sin DOM: se prueba en Node.
// El formato lo leen y escriben `parsePgn` y `writePgn` del núcleo; aquí solo se
// decide qué cabeceras lleva la partida, cómo se llama el archivo y cómo se
// convierte una partida leída en un `Game` para el repaso.
import { PGN_MAX_LENGTH, PgnError, writePgn } from "../core/index.js";
import type { GameStatus, PgnGame, PgnResult, PgnTag, PromotionPiece } from "../core/index.js";
import { Game } from "./game.js";
import { ENGINE_NAME, sanToSpanish } from "./notation.js";
import { LEVEL_NAME, type GameSetup } from "./settings.js";

/** Textos fijos de exportar y cargar. */
export const PGN_TEXT = {
  unexpected: "No se pudo leer el texto como una partida en PGN.",
  tooLarge: `El archivo es demasiado grande (máximo ${PGN_MAX_LENGTH / 1024} KB).`,
  unreadable: "No se pudo leer el archivo.",
  failTitle: "No se pudo cargar la partida.",
  noFile: "Ningún archivo elegido.",
  back: "Volver a la partida",
} as const;

/** Resultado en PGN según el estado de la partida a la vista. */
function resultOf(status: GameStatus): PgnResult {
  if (status.kind === "ongoing") return "*";
  if (status.kind === "checkmate") return status.winner === "w" ? "1-0" : "0-1";
  return "1/2-1/2";
}

const pad = (n: number): string => String(n).padStart(2, "0");

/**
 * PGN de la partida hasta la posición a la vista (lo deshecho no entra) y el
 * nombre de su archivo, `escaque-AAAA-MM-DD.pgn` con la fecha local.
 */
export function exportGame(game: Game, setup: GameSetup, now: Date): { filename: string; text: string } {
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  let white = "Blancas";
  let black = "Negras";
  if (setup.mode === "maquina") {
    const machine = `${ENGINE_NAME} (${LEVEL_NAME[setup.level]})`;
    white = setup.player === "w" ? "Jugador" : machine;
    black = setup.player === "b" ? "Jugador" : machine;
  }
  const tags: PgnTag[] = [
    ["Event", "Partida en Escaque"],
    ["Site", "Escaque"],
    ["Date", `${year}.${month}.${day}`],
    ["Round", "-"],
    ["White", white],
    ["Black", black],
  ];
  const moves = game.history.map((m) => `${m.from}${m.to}${m.promotion ?? ""}`);
  const text = writePgn({ tags, startFen: game.startFen, moves, result: resultOf(game.status) });
  return { filename: `escaque-${year}-${month}-${day}.pgn`, text };
}

/**
 * Partida lista para el repaso, en su última jugada. En Escaque las tablas por
 * repetición, por la regla de 50 jugadas o por material insuficiente son
 * automáticas, pero en una partida real se puede seguir si nadie las reclama:
 * entonces el repaso llega hasta ahí y `cut` lo explica. Lanza `PgnError` si
 * no hay jugadas.
 */
export function gameFromPgn(pgn: PgnGame): { game: Game; cut: string | null } {
  if (pgn.moves.length === 0) throw new PgnError("La partida no tiene jugadas que repasar.");
  const game = new Game(pgn.startFen);
  for (const uci of pgn.moves) {
    const promotion = (uci[4] as PromotionPiece | undefined) ?? undefined;
    if (game.isOver) {
      // Número y SAN (con letras españolas) de la primera jugada que se queda fuera.
      const number = Number(game.fen.split(" ")[5]);
      const white = game.turn === "w";
      const san = new Game(game.fen).play(uci.slice(0, 2), uci.slice(2, 4), promotion)?.san ?? uci;
      return {
        game,
        cut: `Escaque da la partida por terminada antes de la jugada ${number}${white ? "." : "..."} ${sanToSpanish(san)}; el repaso llega hasta ahí.`,
      };
    }
    if (game.play(uci.slice(0, 2), uci.slice(2, 4), promotion) === null) {
      throw new PgnError(`La jugada ${uci} no es legal en esa posición.`);
    }
  }
  return { game, cut: null };
}

const RESULT_TEXT: Readonly<Record<PgnResult, string>> = { "1-0": "1-0", "0-1": "0-1", "1/2-1/2": "tablas", "*": "sin resultado" };

/** Comienzo de la cabecera del repaso: «Partida cargada: Ana contra Beto, 0-1.». */
export function importIntro(pgn: PgnGame, cut: string | null = null): string {
  const name = (key: string): string | null => {
    const value = pgn.tags.find(([tag]) => tag === key)?.[1].trim();
    return value === undefined || value === "" || value === "?" ? null : value;
  };
  const white = name("White");
  const black = name("Black");
  const who = white !== null && black !== null ? `: ${white} contra ${black},` : ",";
  const intro = `Partida cargada${who} ${RESULT_TEXT[pgn.result]}.`;
  return cut === null ? intro : `${intro} ${cut}`;
}

/** Texto para el recuadro de error: el del lector o uno genérico. */
export function loadError(error: unknown): string {
  return error instanceof PgnError ? error.message : PGN_TEXT.unexpected;
}

/** ¿Es el archivo más grande de lo que se acepta? Se mira antes de leerlo. */
export function fileTooLarge(bytes: number): boolean {
  return bytes > PGN_MAX_LENGTH;
}
