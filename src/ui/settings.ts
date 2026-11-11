// Ajustes de una partida nueva: modo, nivel y color. Sin DOM: se prueba en Node.
import type { Color } from "../core/index.js";
import { isLevel, type Level } from "../engine/levels.js";

export type Mode = "dos" | "maquina";
export type ColorChoice = "blancas" | "negras" | "azar";

/** Lo que la persona elige en la pantalla de ajustes. */
export interface SetupChoice {
  readonly mode: Mode;
  readonly level: Level;
  readonly color: ColorChoice;
}

/** Ajustes ya resueltos de la partida en marcha: el «azar» se ha decidido. */
export type GameSetup =
  | { readonly mode: "dos" }
  | { readonly mode: "maquina"; readonly level: Level; readonly player: Color };

/** Lo que se ve preseleccionado al abrir los ajustes. */
export const DEFAULT_CHOICE: SetupChoice = { mode: "maquina", level: "medio", color: "blancas" };

export const TWO_PLAYERS: GameSetup = { mode: "dos" };

export const LEVEL_NAME: Readonly<Record<Level, string>> = { facil: "Fácil", medio: "Medio", dificil: "Difícil" };

export function isMode(value: unknown): value is Mode {
  return value === "dos" || value === "maquina";
}

export function isColorChoice(value: unknown): value is ColorChoice {
  return value === "blancas" || value === "negras" || value === "azar";
}

/** Lee la elección de unos valores de formulario; lo que no sea válido se cambia por el valor por defecto. */
export function parseChoice(values: { mode?: unknown; level?: unknown; color?: unknown }): SetupChoice {
  return {
    mode: isMode(values.mode) ? values.mode : DEFAULT_CHOICE.mode,
    level: isLevel(values.level) ? values.level : DEFAULT_CHOICE.level,
    color: isColorChoice(values.color) ? values.color : DEFAULT_CHOICE.color,
  };
}

/** Decide el color de la persona. `random` devuelve un número en [0, 1). */
export function resolveSetup(choice: SetupChoice, random: () => number = Math.random): GameSetup {
  if (choice.mode === "dos") return TWO_PLAYERS;
  const player: Color = choice.color === "blancas" ? "w" : choice.color === "negras" ? "b" : random() < 0.5 ? "w" : "b";
  return { mode: "maquina", level: choice.level, player };
}

/** La elección que repite una revancha: mismo modo, nivel y color (el azar ya decidido no se vuelve a sortear). */
export function choiceOf(setup: GameSetup): SetupChoice {
  if (setup.mode === "dos") return { ...DEFAULT_CHOICE, mode: "dos" };
  return { mode: "maquina", level: setup.level, color: setup.player === "w" ? "blancas" : "negras" };
}

/** Bando de la máquina, o `null` en una partida a dos jugadores. */
export function machineColor(setup: GameSetup): Color | null {
  if (setup.mode === "dos") return null;
  return setup.player === "w" ? "b" : "w";
}
