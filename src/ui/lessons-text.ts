// Textos en español de las lecciones guiadas (diseño: componente Lessons).
// Español de tú, sin exclamaciones y con punto final. Sin DOM: se prueba en Node.
import type { LessonState } from "./lessons-progress.js";

const COUNT_WORD: Readonly<Record<number, string>> = { 1: "Una", 2: "Dos", 3: "Tres", 4: "Cuatro", 5: "Cinco" };

/** «Una jugada.», «Dos jugadas.» */
export function movesLabel(count: number): string {
  const word = COUNT_WORD[count];
  if (count === 1) return "Una jugada.";
  return word === undefined ? `${count} jugadas.` : `${word} jugadas.`;
}

function pluralHints(count: number): string {
  return count === 1 ? "1 pista" : `${count} pistas`;
}

/** Estado de una lección en la lista: el icono y el borde lo repiten, pero la palabra es la que manda. */
export function stateLabel(state: LessonState, hints: number): string {
  if (state === "completada") return hints === 0 ? "Completada, sin pistas." : `Completada, con ${pluralHints(hints)}.`;
  return state === "en-curso" ? "En curso." : "Sin empezar.";
}

/** «2 de 6» (en negrita) y «lecciones completadas.» */
export function progressSentence(done: number, total: number): { readonly count: string; readonly rest: string } {
  return { count: `${done} de ${total}`, rest: "lecciones completadas." };
}

export const PROGRESS_LEGEND = "Segmento lleno: completada. Borde grueso: la lección que tienes abierta.";
const TOTAL_WORD: Readonly<Record<number, string>> = { 3: "Tres", 4: "Cuatro", 5: "Cinco", 6: "Seis", 7: "Siete", 8: "Ocho" };

export function listIntro(total: number): string {
  return `${TOTAL_WORD[total] ?? total} ejercicios cortos para practicar en el tablero. Elige el que quieras: el orden es libre.`;
}

/** «Lección 4 de 6» */
export function lessonPosition(number: number, total: number): string {
  return `Lección ${number} de ${total}`;
}

/** Texto del botón de pistas: «Pedir pista 2 de 3», o «No quedan más pistas» cuando se han pedido todas. */
export function hintButtonLabel(shown: number, total: number): string {
  return shown >= total ? "No quedan más pistas" : `Pedir pista ${shown + 1} de ${total}`;
}

export function hintTitle(number: number, total: number): string {
  return `Pista ${number} de ${total}`;
}

export const CORRECT = "Correcto.";
export const INCORRECT = "Esa jugada no es la solución.";

/** Acierto: cuántas pistas se usaron. */
export function hintsUsed(hints: number): string {
  return hints === 0 ? "Sin pistas." : `Has usado ${pluralHints(hints)}.`;
}

export function attemptLabel(attempt: number): string {
  return `Intento ${attempt}.`;
}

export function intermediateTitle(nextStep: number, total: number): string {
  return `Bien. Sigue con el paso ${nextStep} de ${total}.`;
}

export function rivalReply(engineName: string, san: string): string {
  return `${engineName} responde ${san}. Ahora te toca a ti.`;
}

export function nextLessonLabel(title: string): string {
  return `Siguiente lección: ${title}`;
}

export const ALL_DONE_TITLE = (total: number): string => `Has completado las ${total} lecciones.`;
export const ALL_DONE_TEXT = "Puedes repetir las que quieras o poner a prueba lo aprendido contra Alfil Beta.";
export const PLAY_ENGINE = "Jugar contra Alfil Beta";
export const ALL_LESSONS = "Todas las lecciones";
export const REPEAT_LESSON = "Repetir lección";
export const RESTART_LESSON = "Reiniciar lección";
export const LESSONS_TITLE = "Lecciones";

/** Anuncio al abrir una lección. */
export function openedAnnouncement(number: number, total: number, title: string, goal: string): string {
  return `${lessonPosition(number, total)}: ${title}. ${goal}`;
}

export const RESTARTED = "Lección reiniciada.";
