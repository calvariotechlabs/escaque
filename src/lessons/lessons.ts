// Las lecciones guiadas, como datos. Cada posición, solución y respuesta del
// rival está verificada con el núcleo y Alfil Beta en tests/lessons-data.test.ts.
// Estilo de los textos: español de tú, sin exclamaciones y con punto final.
import type { Lesson } from "./types.js";

export const LESSONS: readonly Lesson[] = deepFreeze([
  {
    id: "enroque",
    number: 1,
    title: "El enroque",
    summary: "Pon tu rey a salvo y saca la torre en una sola jugada.",
    fen: "3rk2r/ppp1bppp/2n2n2/4p3/4P3/2N2N2/PPP1BPPP/R3K2R w KQk - 0 1",
    side: "w",
    goal: "Enroca para poner tu rey a salvo.",
    hints: [
      { text: "Tu rey sigue en el centro y la torre negra de d8 ya vigila la columna d." },
      { text: "El rey no puede enrocar pasando por una casilla atacada, y d1 lo está." },
      { text: "Enroca corto: lleva el rey de e1 a g1.", marks: { from: "e1", to: "g1" } },
    ],
    success:
      "El rey queda protegido detrás de sus peones y la torre entra en juego. El enroque largo no se podía hacer porque el rey habría pasado por d1, atacada por la torre negra.",
    failure: "Esa jugada no es un enroque.",
    steps: [
      {
        kind: "moves",
        accept: { e1g1: null },
        mistakes: {
          e1f1: "Así el rey se aparta, pero pierde para siempre el derecho a enrocar.",
          h1g1: "Si mueves la torre de h1, ya no podrás enrocar corto.",
        },
      },
    ],
  },
  {
    id: "captura-al-paso",
    number: 2,
    title: "La captura al paso",
    summary: "Un peón que avanza dos casillas también se puede capturar.",
    fen: "8/8/8/3pP3/8/8/k7/4K3 w - d6 0 1",
    side: "w",
    goal: "Captura al paso el peón negro que acaba de avanzar.",
    hints: [
      { text: "El peón negro acaba de avanzar dos casillas, de d7 a d5, y se ha puesto al lado del tuyo." },
      { text: "Puedes capturarlo como si solo hubiera avanzado una casilla, pero únicamente en esta jugada." },
      { text: "Mueve el peón de e5 a d6.", marks: { from: "e5", to: "d6" } },
    ],
    success:
      "Tu peón captura en d6 al peón que pasó por esa casilla y ya nadie puede frenarlo. La captura al paso solo vale justo después del avance de dos casillas.",
    failure: "Esa jugada no es la captura al paso.",
    steps: [
      {
        kind: "moves",
        accept: { e5d6: null },
        mistakes: {
          e5e6: "Si avanzas, pierdes la ocasión de capturar al paso y el peón negro de d5 queda libre.",
        },
      },
    ],
  },
  {
    id: "corona-sin-ahogar",
    number: 3,
    title: "Corona sin ahogar",
    summary: "Coronar a dama no siempre es lo mejor.",
    fen: "8/k1P5/2K5/8/8/8/8/8 w - - 0 1",
    side: "w",
    goal: "Corona el peón sin ahogar al rey negro y da mate en dos jugadas.",
    hints: [
      { text: "Antes de coronar, mira qué casillas le quedarían libres al rey negro." },
      { text: "Con una dama en c8, el rey negro no tendría ninguna jugada sin estar en jaque: sería ahogado y tablas." },
      { text: "Corona a torre: lleva el peón de c7 a c8.", marks: { from: "c7", to: "c8", promotion: "r" } },
    ],
    success:
      "La torre le deja al rey negro una sola casilla, a6, y desde a8 le da mate. Con dama habría sido ahogado: el rey no está en jaque, no puede moverse y la partida acaba en tablas.",
    failure: "Así no llegas al mate en dos jugadas.",
    steps: [
      {
        kind: "moves",
        accept: { c7c8r: "a7a6" },
        mistakes: {
          c7c8q: "Con dama, el rey negro no está en jaque pero no tiene ninguna jugada: es ahogado y la partida acaba en tablas.",
          c7c8b: "Con rey y alfil no se puede dar mate: la partida acaba en tablas.",
          c7c8n: "Con rey y caballo no se puede dar mate: la partida acaba en tablas.",
        },
      },
      { kind: "mate" },
    ],
  },
  {
    id: "mate-del-pasillo",
    number: 4,
    title: "Mate del pasillo",
    summary: "Un rey encerrado por sus propios peones es un blanco fácil.",
    fen: "6k1/5ppp/8/8/8/8/r4PPP/3R2K1 w - - 0 1",
    side: "w",
    goal: "Da mate en una jugada.",
    hints: [
      { text: "El rey negro está encerrado en la última fila por sus propios peones." },
      { text: "Busca una casilla de la fila 8 donde tu torre dé jaque sin que nadie pueda capturarla ni taparla." },
      { text: "Lleva la torre de d1 a d8.", marks: { from: "d1", to: "d8" } },
    ],
    success:
      "El rey no puede escapar porque sus peones le tapan la salida, y nadie puede capturar ni tapar la torre. Por eso conviene dejarle al rey una casilla de escape.",
    failure: "Esa jugada no da mate.",
    steps: [
      {
        kind: "mate",
        mistakes: {
          d1d7: "La torre en d7 amenaza, pero no da jaque al rey.",
        },
      },
    ],
  },
  {
    id: "horquilla",
    number: 5,
    title: "La horquilla de caballo",
    summary: "Un caballo puede atacar dos piezas a la vez.",
    fen: "4k3/pp3ppp/8/1N1q4/8/8/PPP2PPP/4K3 w - - 0 1",
    side: "w",
    goal: "Gana la dama negra con un jaque doble del caballo.",
    hints: [
      { text: "Busca un jaque que ataque también a otra pieza." },
      { text: "El caballo puede saltar a una casilla desde la que ve al rey y a la dama a la vez." },
      { text: "Lleva el caballo de b5 a c7.", marks: { from: "b5", to: "c7" } },
    ],
    success:
      "El caballo atacó a la vez al rey y a la dama, y como el jaque obliga a responder, la dama se quedó sin tiempo para escapar. Ese ataque doble se llama horquilla.",
    failure: "Esa jugada no gana la dama.",
    steps: [
      {
        kind: "moves",
        accept: { b5c7: "e8d7" },
        mistakes: { b5d6: "Es jaque, pero desde d6 el caballo no ataca a la dama." },
      },
      { kind: "moves", accept: { c7d5: null } },
    ],
  },
  {
    id: "mate-de-la-escalera",
    number: 6,
    title: "Mate de la escalera",
    summary: "Dos torres empujan al rey hasta el borde, fila a fila.",
    fen: "7k/8/8/8/8/8/R7/1R4K1 w - - 0 1",
    side: "w",
    goal: "Da mate en dos jugadas con las dos torres.",
    hints: [
      { text: "Una torre puede cortarle al rey la fila 7 mientras la otra prepara el mate." },
      { text: "Pon una torre en la fila 7: el rey negro quedará encerrado en la última." },
      { text: "Lleva la torre de a2 a a7.", marks: { from: "a2", to: "a7" } },
    ],
    success:
      "Una torre cierra una fila y la otra da jaque en la siguiente, así que el rey no tiene adónde ir. Repitiendo ese movimiento, las torres llevan al rey hasta el borde como por una escalera.",
    failure: "Así no hay mate en dos jugadas.",
    steps: [
      {
        kind: "moves",
        accept: { a2a7: "h8g8", b1b7: "h8g8" },
        mistakes: { b1b8: "Es jaque, pero el rey escapa a la fila 7." },
      },
      { kind: "mate" },
    ],
  },
] satisfies Lesson[]);

/** Congela los datos en profundidad: nadie puede cambiar una lección en ejecución. */
function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** La lección con ese id, o `undefined`. */
export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((lesson) => lesson.id === id);
}
