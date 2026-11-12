// Textos en español de las lecciones guiadas (diseño: componente Lessons).
// Español de tú, sin exclamaciones y con punto final. Sin DOM: se prueba en Node.
import type { LessonGroup } from "../lessons/types.js";
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
export function stateLabel(state: LessonState, hints: number, helped = false): string {
  if (state === "completada" && helped) return "Completada con ayuda.";
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

export const RESTARTED = "Lección reiniciada.";

// --- Primeros pasos: grupos, ayuda de casillas, contador y final del bloque ---------

export const GROUP_TITLE: Readonly<Record<LessonGroup, string>> = { "primeros-pasos": "Primeros pasos", tacticas: "Tácticas" };

const GROUP_LOWER: Readonly<Record<LessonGroup, string>> = { "primeros-pasos": "primeros pasos", tacticas: "tácticas" };

export function groupDescription(group: LessonGroup, total: number): string {
  if (group === "primeros-pasos") return "Para quien nunca ha jugado: cómo se mueve cada pieza, qué es el jaque y cómo se gana una partida.";
  return `${TOTAL_WORD[total] ?? total} posiciones para practicar jugadas clave: el enroque, la captura al paso, la coronación y los mates.`;
}

export const LIST_INTRO = "Ejercicios cortos para practicar en el tablero. Si nunca has jugado, empieza por los primeros pasos. El orden es libre.";

/** «Primeros pasos · lección 5 de 9» */
export function groupLessonPosition(group: LessonGroup, number: number, total: number): string {
  return `${GROUP_TITLE[group]} · lección ${number} de ${total}`;
}

/** Comienzo oculto del título de cada tarjeta, para el lector de pantalla: «Tácticas, lección 1: ». */
export function groupLessonLabel(group: LessonGroup, number: number): string {
  return `${GROUP_TITLE[group]}, lección ${number}: `;
}

export function groupListLabel(group: LessonGroup): string {
  return `Lecciones de ${GROUP_LOWER[group]}`;
}

/** Acierto en una lección con ayuda de casillas: pistas y ayuda usadas. */
export function helpUsedSentence(hints: number, helped: boolean): string {
  if (hints === 0) return helped ? "Has usado las casillas de ayuda." : "No has usado pistas ni casillas de ayuda.";
  return helped ? `Has usado ${pluralHints(hints)} y las casillas de ayuda.` : `Has usado ${pluralHints(hints)}.`;
}

const LOWER_WORD: Readonly<Record<number, string>> = { 2: "dos", 3: "tres", 4: "cuatro", 5: "cinco", 6: "seis", 7: "siete", 8: "ocho" };

/** Contador de capturas: «Capturas: 1 de 3.» (en negrita) y lo que queda. `noun.one` lleva el artículo («un peón negro»). */
export function counterSentence(done: number, total: number, noun: { readonly one: string; readonly many: string }): { readonly count: string; readonly rest: string } {
  const left = total - done;
  const rest = left <= 0 ? "" : left === 1 ? `Queda ${noun.one}.` : `Quedan ${LOWER_WORD[left] ?? left} ${noun.many}.`;
  return { count: `Capturas: ${done} de ${total}.`, rest };
}

/** «b3, b5 y c2» */
function joinList(items: readonly string[]): string {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]!}`;
}

/** Lo que se anuncia (y se lee bajo el tablero) al encender «Ver a dónde puede ir». */
export function helpAnnouncement(targets: readonly string[], goal: string | null): string {
  if (targets.length === 0) return "Esta pieza no puede moverse ahora.";
  const list = targets.length === 1 ? `Casilla posible marcada: ${targets[0]!}.` : `Casillas posibles marcadas: ${joinList(targets)}.`;
  return goal === null ? list : `${list} La casilla objetivo es ${goal}.`;
}

/** Tras una jugada buena en un ejercicio en que el rival no mueve. */
export const NO_REPLY = "Las negras no mueven en este ejercicio. Te toca otra vez.";

export const BLOCK_DONE_TITLE = "Has terminado los primeros pasos.";
export const BLOCK_DONE_TEXT = "Ya sabes cómo se mueve cada pieza, qué es el jaque y cómo se gana una partida. Ahora puedes practicar tácticas o jugar una partida.";
export function blockDoneMeta(total: number): string {
  return `Completadas ${total} de ${total} lecciones.`;
}
export const START_TACTICS = "Empezar las lecciones de tácticas";
export const PLAY_GAME = "Jugar una partida";
