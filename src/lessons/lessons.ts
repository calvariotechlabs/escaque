// Las lecciones guiadas, como datos. Cada posición, solución y respuesta del
// rival está verificada con el núcleo y Alfil Beta en tests/lessons-data.test.ts.
// Estilo de los textos: español de tú, sin exclamaciones y con punto final.
import type { Lesson } from "./types.js";

export const LESSONS: readonly Lesson[] = deepFreeze([
  // --- Primeros pasos: para quien nunca ha jugado. El rival no mueve entre jugadas del alumno.
  {
    id: "el-tablero",
    group: "primeros-pasos",
    number: 1,
    title: "El tablero",
    summary: "Aprende las casillas, las columnas y las filas.",
    howItMoves:
      "El tablero tiene 64 casillas. Las columnas van de la a a la h, de izquierda a derecha, y las filas del 1 al 8, desde el lado de las blancas. Cada casilla se nombra por su columna y su fila: e6 es la columna e y la fila 6. Siempre empiezan las blancas.",
    fen: "7k/8/8/8/8/8/4R3/K7 w - - 0 1",
    side: "w",
    goal: "Lleva la torre blanca a la casilla e6.",
    hints: [
      { text: "Las letras de debajo del tablero son las columnas y los números del lado, las filas." },
      { text: "Busca la columna e y sube por ella hasta la fila 6." },
      { text: "Lleva la torre de e2 a e6.", marks: { from: "e2", to: "e6" } },
    ],
    success: "La casilla e6 está en la columna e y en la fila 6. Así se nombra cualquier casilla del tablero.",
    failure: "Esa no es la casilla e6. Busca primero la columna e y luego la fila 6.",
    helpPiece: "e2",
    steps: [
      {
        kind: "reach",
        target: "e6",
        marked: false,
        mistakes: {
          e2e5: "Esa es la casilla e5: te has quedado una fila por debajo.",
          e2e7: "Esa es la casilla e7: te has pasado una fila.",
        },
      },
    ],
  },
  {
    id: "la-torre",
    group: "primeros-pasos",
    number: 2,
    title: "La torre",
    summary: "Se mueve en línea recta: adelante, atrás y a los lados.",
    howItMoves:
      "La torre se mueve en línea recta: hacia delante, hacia atrás y hacia los lados, tantas casillas como quiera. No puede saltar por encima de otras piezas.",
    fen: "k7/8/8/3p3p/8/8/7p/K2R4 w - - 0 1",
    side: "w",
    goal: "Captura los tres peones negros con la torre. Las negras no mueven.",
    hints: [
      { text: "Para capturar, lleva la torre a la casilla del peón." },
      { text: "Empieza por el peón de la columna d: está en línea recta con la torre." },
      { text: "Captura primero en d5, después en h5 y por último en h2.", marks: { from: "d1", to: "d5" } },
    ],
    success: "La torre recorre filas y columnas enteras de una vez. Por eso es tan fuerte en un tablero abierto.",
    failure: "Esa jugada no captura ningún peón.",
    helpPiece: "d1",
    counter: { one: "un peón negro", many: "peones negros" },
    steps: [
      { kind: "capture", mistakes: { d1h1: "Así la torre no captura nada. Busca un peón en su misma columna o en su misma fila." } },
      { kind: "capture" },
      { kind: "capture" },
    ],
  },
  {
    id: "el-alfil",
    group: "primeros-pasos",
    number: 3,
    title: "El alfil",
    summary: "Se mueve en diagonal, tantas casillas como quiera.",
    howItMoves:
      "El alfil se mueve en diagonal, tantas casillas como quiera, pero sin saltar por encima de otras piezas. Por eso siempre se queda en casillas del mismo color.",
    fen: "7k/2p5/8/8/5p2/8/P7/K1B5 w - - 0 1",
    side: "w",
    goal: "Captura los dos peones negros con el alfil. Las negras no mueven.",
    hints: [
      { text: "El alfil solo captura en diagonal: busca un peón en la misma diagonal que él." },
      { text: "El peón de f4 está en la diagonal que sube hacia la derecha desde c1." },
      { text: "Captura primero en f4 y después en c7.", marks: { from: "c1", to: "f4" } },
    ],
    success: "El alfil ha capturado los dos peones sin salir de las casillas oscuras. Cada alfil se queda siempre en su color.",
    failure: "Esa jugada no captura ningún peón.",
    helpPiece: "c1",
    counter: { one: "un peón negro", many: "peones negros" },
    steps: [{ kind: "capture" }, { kind: "capture" }],
  },
  {
    id: "la-dama",
    group: "primeros-pasos",
    number: 4,
    title: "La dama",
    summary: "Une la torre y el alfil: es la pieza más poderosa.",
    howItMoves:
      "La dama se mueve como la torre y como el alfil a la vez: en línea recta y en diagonal, tantas casillas como quiera. Es la pieza más poderosa.",
    fen: "k7/8/8/7n/8/8/8/K2Q4 w - - 0 1",
    side: "w",
    goal: "Captura el caballo negro con la dama.",
    hints: [
      { text: "La dama también se mueve en diagonal, como el alfil." },
      { text: "El caballo está en la diagonal que sube hacia la derecha desde d1." },
      { text: "Captura el caballo de h5.", marks: { from: "d1", to: "h5" } },
    ],
    success: "La dama ha llegado en diagonal, como un alfil. También puede ir en línea recta, como una torre.",
    failure: "Esa jugada no captura el caballo.",
    helpPiece: "d1",
    steps: [{ kind: "capture" }],
  },
  {
    id: "el-caballo",
    group: "primeros-pasos",
    number: 5,
    title: "El caballo",
    summary: "Salta en forma de L por encima de otras piezas.",
    howItMoves:
      "El caballo salta en forma de L: dos casillas en línea recta y una a un lado. Es la única pieza que puede saltar por encima de otras.",
    fen: "7k/8/8/4P3/3NP3/8/8/K7 w - - 0 1",
    side: "w",
    goal: "Lleva el caballo a la casilla con el círculo discontinuo.",
    hints: [
      { text: "Cuenta dos casillas en línea recta y una a un lado: esa es la L del caballo." },
      { text: "Desde d4, avanza dos columnas hacia la derecha y sube una fila, por encima de tus peones." },
      { text: "Lleva el caballo de d4 a f5.", marks: { from: "d4", to: "f5" } },
    ],
    success: "El caballo salta en forma de L. Es la única pieza que puede saltar por encima de otras.",
    failure: "El caballo ha saltado bien, pero a otra casilla. El objetivo es la del círculo discontinuo.",
    helpPiece: "d4",
    steps: [{ kind: "reach", target: "f5", marked: true }],
  },
  {
    id: "el-peon",
    group: "primeros-pasos",
    number: 6,
    title: "El peón",
    summary: "Avanza de frente y captura en diagonal.",
    howItMoves:
      "El peón avanza de frente una casilla, o dos si todavía no se ha movido. Captura de otra forma: en diagonal, una casilla hacia delante. Nunca retrocede.",
    fen: "7k/8/8/8/5n2/8/4P3/K7 w - - 0 1",
    side: "w",
    goal: "Captura el caballo negro con el peón, en dos jugadas. Las negras no mueven.",
    hints: [
      { text: "El peón no captura de frente: captura en diagonal, una casilla hacia delante." },
      { text: "Primero avanza el peón hasta una casilla desde la que toque al caballo en diagonal." },
      { text: "Avanza el peón de e2 a e3 y después captura el caballo en f4.", marks: { from: "e2", to: "e3" } },
    ],
    success: "El peón ha avanzado de frente y ha capturado en diagonal. Si llega a la última fila, corona: se cambia por otra pieza.",
    failure: "Así el peón no puede capturar el caballo.",
    helpPiece: "e2",
    steps: [
      {
        kind: "reach",
        target: "e3",
        marked: false,
        mistakes: { e2e4: "Desde e4 el peón ya no podría capturar el caballo: solo captura en diagonal hacia delante." },
      },
      { kind: "capture", mistakes: { e3e4: "El peón avanza de frente, pero captura en diagonal: el caballo está en f4." } },
    ],
  },
  {
    id: "el-rey",
    group: "primeros-pasos",
    number: 7,
    title: "El rey",
    summary: "Se mueve una casilla y no puede ir a una casilla atacada.",
    howItMoves:
      "El rey se mueve una sola casilla en cualquier dirección. Nunca puede ir a una casilla atacada por una pieza rival, ni capturar una pieza que esté protegida.",
    fen: "7k/8/2p5/3r4/4K3/5n2/8/8 w - - 0 1",
    side: "w",
    goal: "Captura con el rey una pieza negra que no esté protegida.",
    hints: [
      { text: "La torre de d5 está protegida por el peón de c6: si el rey la captura, el peón lo atacaría." },
      { text: "Mira el caballo de f3: ninguna pieza negra lo protege." },
      { text: "Captura el caballo de f3 con el rey.", marks: { from: "e4", to: "f3" } },
    ],
    success: "El caballo no estaba protegido, así que el rey podía capturarlo. La torre sí lo estaba, y por eso el rey no podía ir a d5.",
    failure: "Esa jugada no captura ninguna pieza.",
    helpPiece: "e4",
    steps: [{ kind: "capture" }],
  },
  {
    id: "el-jaque",
    group: "primeros-pasos",
    number: 8,
    title: "El jaque",
    summary: "Cuando atacan al rey, tienes que protegerlo.",
    howItMoves:
      "Un rey está en jaque cuando una pieza rival lo ataca. Quien está en jaque tiene que salir en su siguiente jugada: moviendo el rey, poniendo una pieza en medio o capturando la pieza que ataca.",
    fen: "4k3/8/8/8/8/8/8/R3K3 w - - 0 1",
    side: "w",
    goal: "Da jaque al rey negro con la torre.",
    hints: [
      { text: "Para dar jaque, la torre tiene que atacar la casilla del rey negro." },
      { text: "El rey negro está en la fila 8, y la torre puede llegar a esa fila por la columna a." },
      { text: "Lleva la torre de a1 a a8.", marks: { from: "a1", to: "a8" } },
    ],
    success: "La torre ataca al rey negro por la fila 8: eso es jaque. Ahora las negras tendrían que sacar el rey de esa fila.",
    failure: "Esa jugada no ataca al rey negro.",
    helpPiece: "a1",
    steps: [{ kind: "check" }],
  },
  {
    id: "el-jaque-mate",
    group: "primeros-pasos",
    number: 9,
    title: "El jaque mate",
    summary: "Cuando el rey no tiene salida, la partida termina.",
    howItMoves:
      "El jaque mate es un jaque del que el rey no puede salir, y quien lo da gana la partida. Si el rey no está en jaque pero no tiene ninguna jugada, es ahogado, y la partida acaba en tablas.",
    fen: "k7/8/1K6/8/8/8/7Q/8 w - - 0 1",
    side: "w",
    goal: "Da jaque mate en una jugada.",
    hints: [
      { text: "Tu rey ya vigila las casillas a7 y b7." },
      { text: "Busca un jaque con la dama que también cubra la casilla b8." },
      { text: "Lleva la dama de h2 a h8.", marks: { from: "h2", to: "h8" } },
    ],
    success: "El rey negro está en jaque y no tiene ninguna casilla libre. Eso es jaque mate: has ganado la partida.",
    failure: "Esa jugada no da jaque mate.",
    helpPiece: "h2",
    steps: [
      {
        kind: "mate",
        mistakes: {
          h2c7: "Así el rey negro no está en jaque y no tiene ninguna jugada: es ahogado, y la partida acabaría en tablas.",
          h2a2: "Es jaque, pero el rey negro puede escapar a b8.",
        },
      },
    ],
  },
  // --- Tácticas
  {
    id: "enroque",
    group: "tacticas",
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
    group: "tacticas",
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
    group: "tacticas",
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
    group: "tacticas",
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
    group: "tacticas",
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
    group: "tacticas",
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
