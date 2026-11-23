// Identidad visual (CAL-398): textos y decisiones de los microdetalles del estado, el resultado y la celebración.
// Diseño: bloque «Identidad visual (CAL-398)» del lienzo (docs/design/lienzo/Identidad*.dc.html). Sin DOM: se prueba en Node.
import type { Color, GameStatus } from "../core/index.js";
import { ENGINE_NAME, resultMessage, statusMessage } from "./notation.js";

const SIDE: Readonly<Record<Color, string>> = { w: "blancas", b: "negras" };

/** Estado contra la máquina: el texto, si te toca (va en una etiqueta aparte) y si hay jaque (cambia el aspecto del estado). */
export function machineStatusParts(
  status: GameStatus,
  turn: Color,
  inCheck: boolean,
  humanTurn: boolean,
  thinking: boolean,
): { text: string; yourTurn: boolean; check: boolean } {
  if (status.kind !== "ongoing") return { text: statusMessage(status, turn, inCheck), yourTurn: false, check: false };
  // En jaque, la etiqueta «Jaque» del estado lo dice: el texto no lo repite (la etiqueta no se lee,
  // así que el lector de pantalla oye «Jaque.» por el texto oculto que la acompaña).
  const base = statusMessage(status, turn, false);
  if (thinking) return { text: `${base} ${ENGINE_NAME} está pensando.`, yourTurn: false, check: inCheck };
  if (humanTurn && inCheck) return { text: `Juegan las ${SIDE[turn]}: sal del jaque.`, yourTurn: true, check: true };
  return { text: base, yourTurn: humanTurn, check: inCheck };
}

const DRAW_CAUSE: Readonly<Record<Exclude<GameStatus["kind"], "ongoing" | "checkmate">, string>> = {
  stalemate: "Por ahogado.",
  "insufficient-material": "Por material insuficiente.",
  "fifty-move": "Por la regla de los 50 movimientos.",
  "threefold-repetition": "Por triple repetición.",
};

/** Partida terminada (estado de dos jugadores): título grande y causa. `null` si sigue en marcha. */
export function finishedParts(status: GameStatus): { title: string; text: string } | null {
  if (status.kind === "ongoing") return null;
  if (status.kind === "checkmate") return { title: "Jaque mate.", text: `Ganan las ${SIDE[status.winner]}.` };
  return { title: "Tablas.", text: DRAW_CAUSE[status.kind] };
}

export type ResultKind = "gana" | "pierde" | "tablas";

/** Resultado contra la máquina: tipo (decide el sello y la celebración), antetítulo, título y texto. */
export function resultView(status: GameStatus, player: Color): { kind: ResultKind; kicker: string; title: string; text: string } | null {
  const message = resultMessage(status, player);
  if (message === null) return null;
  if (status.kind === "checkmate" && status.winner === player) return { kind: "gana", kicker: "Victoria", ...message };
  if (status.kind === "checkmate") return { kind: "pierde", kicker: "Derrota", title: message.title, text: `${message.text} En el repaso verás dónde cambió la partida.` };
  return { kind: "tablas", kicker: "Empate", ...message };
}

/**
 * Celebrar solo al pasar a «has ganado» mientras se juega, y una vez por partida. `previous` es
 * `undefined` en el primer pintado (al abrir una partida guardada que ya había terminado no se celebra).
 * `alreadyCelebrated`: esta partida ya mostró su victoria (volver a la última jugada desde la lista,
 * o Deshacer y Rehacer, no la repite).
 */
export function shouldCelebrate(previous: ResultKind | null | undefined, next: ResultKind | null, alreadyCelebrated = false): boolean {
  return !alreadyCelebrated && previous !== undefined && previous !== "gana" && next === "gana";
}

/** Escaques que salen del sello al ganar (sus trayectorias están en identidad.css). */
export const CONFETTI_COUNT = 10;
