// Tablero a elegir (CAL-397): Bosque o Nogal. La elección se guarda en el dispositivo
// (localStorage) y solo cambia los colores de las casillas y de sus marcas; sin DOM.
// Lo leído del almacenamiento no es de confianza: solo se aceptan los nombres conocidos.
import type { KeyValueStore } from "./save.js";

export const BOARD_THEMES = ["bosque", "nogal"] as const;
export type BoardTheme = (typeof BOARD_THEMES)[number];

/** El de siempre: el que se ve sin haber elegido nada. */
export const DEFAULT_BOARD_THEME: BoardTheme = "bosque";
export const BOARD_THEME_KEY = "escaque:tablero";

export function isBoardTheme(value: unknown): value is BoardTheme {
  return typeof value === "string" && (BOARD_THEMES as readonly string[]).includes(value);
}

/** El tablero guardado, o el de siempre si no hay nada, no es válido o el almacenamiento falla. */
export function loadBoardTheme(store: KeyValueStore | null): BoardTheme {
  if (store === null) return DEFAULT_BOARD_THEME;
  try {
    const raw = store.getItem(BOARD_THEME_KEY);
    if (isBoardTheme(raw)) return raw;
    if (raw !== null) store.removeItem(BOARD_THEME_KEY);
  } catch {
    // Almacenamiento bloqueado (modo privado, datos desactivados): se usa el de siempre.
  }
  return DEFAULT_BOARD_THEME;
}

export function saveBoardTheme(store: KeyValueStore | null, theme: BoardTheme): void {
  if (store === null) return;
  try {
    store.setItem(BOARD_THEME_KEY, theme);
  } catch {
    // Sin sitio o bloqueado: el tablero cambia igual, solo que no se recuerda.
  }
}

/** Lo mínimo de `document.documentElement` que hace falta; así se prueba sin navegador. */
export interface ThemeTarget {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

/** El tablero de siempre no lleva atributo: sus colores son los de `tokens.css`. */
export function applyBoardTheme(target: ThemeTarget, theme: BoardTheme): void {
  if (theme === DEFAULT_BOARD_THEME) target.removeAttribute("data-tablero");
  else target.setAttribute("data-tablero", theme);
}
