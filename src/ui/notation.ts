// Textos en español de la interfaz: SAN con letras españolas,
// anuncios de jugadas para lectores de pantalla y mensajes de estado.
// Sin DOM: se prueba en Node.
import type { Color, GameStatus, PieceType, PromotionPiece } from "../core/index.js";

export interface Piece {
  readonly color: Color;
  readonly type: PieceType;
}

/** Letras inglesas de PGN → letras españolas: C (caballo), A (alfil), T (torre), D (dama), R (rey). */
const SPANISH_LETTER: Readonly<Record<string, string>> = { N: "C", B: "A", R: "T", Q: "D", K: "R" };

/** Nombre de cada pieza y si es femenino («torre negra», «dama blanca»). */
const NAMES: Readonly<Record<PieceType, { readonly name: string; readonly feminine: boolean }>> = {
  p: { name: "peón", feminine: false },
  n: { name: "caballo", feminine: false },
  b: { name: "alfil", feminine: false },
  r: { name: "torre", feminine: true },
  q: { name: "dama", feminine: true },
  k: { name: "rey", feminine: false },
};

/**
 * SAN inglesa → SAN española. Solo cambian la letra inicial de una jugada de
 * pieza y la pieza de coronación: «Nf3» → «Cf3», «e8=Q+» → «e8=D+». Las
 * columnas («bxc6») y el enroque («O-O») no se tocan.
 */
export function sanToSpanish(san: string): string {
  return san
    .replace(/^[NBRQK]/, (letter) => SPANISH_LETTER[letter]!)
    .replace(/=([NBRQ])/, (_, letter: string) => `=${SPANISH_LETTER[letter]!}`);
}

/** Datos de una jugada ya hecha, suficientes para anunciarla. */
export interface PlayedMove {
  readonly color: Color;
  /** SAN inglesa, como la da el núcleo. */
  readonly san: string;
  readonly from: string;
  readonly to: string;
  readonly piece: PieceType;
  readonly captured: PieceType | null;
  readonly promotion: PromotionPiece | null;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Anuncio de una jugada para la región viva: bando, SAN española y la jugada
 * descrita con palabras, más el jaque o el mate.
 * «Negras: exd1=D+. Peón de e2 captura torre en d1 y corona en dama. Jaque.»
 */
export function moveAnnouncement(move: PlayedMove): string {
  const side = move.color === "w" ? "Blancas" : "Negras";
  let description: string;
  if (move.san.startsWith("O-O-O")) description = "Enroque largo";
  else if (move.san.startsWith("O-O")) description = "Enroque corto";
  else {
    const mover = capitalize(NAMES[move.piece].name);
    description =
      move.captured === null
        ? `${mover} de ${move.from} a ${move.to}`
        : `${mover} de ${move.from} captura ${NAMES[move.captured].name} en ${move.to}`;
    if (move.promotion !== null) description += ` y corona en ${NAMES[move.promotion].name}`;
  }
  const suffix = move.san.endsWith("#") ? " Jaque mate." : move.san.endsWith("+") ? " Jaque." : "";
  return `${side}: ${sanToSpanish(move.san)}. ${description}.${suffix}`;
}

/** Mensaje de estado: de quién es el turno, o cómo ha terminado la partida. Textos del componente GameStatus del diseño. */
export function statusMessage(status: GameStatus, turn: Color, inCheck: boolean): string {
  switch (status.kind) {
    case "checkmate":
      return `Jaque mate. Ganan las ${status.winner === "w" ? "blancas" : "negras"}.`;
    case "stalemate":
      return "Tablas por ahogado.";
    case "insufficient-material":
      return "Tablas por material insuficiente.";
    case "fifty-move":
      return "Tablas por la regla de los 50 movimientos.";
    case "threefold-repetition":
      return "Tablas por triple repetición.";
    case "ongoing":
      return `Juegan las ${turn === "w" ? "blancas" : "negras"}.${inCheck ? " Jaque." : ""}`;
  }
}

/** Texto del diálogo de nueva partida (lienzo «Nueva partida · móvil»): cuántas jugadas se pierden. */
export function newGameWarning(plies: number): string {
  return plies === 1 ? "Se perderá la jugada de esta partida." : `Se perderán las ${plies} jugadas de esta partida.`;
}

/** Nombre con el que el motor aparece en la interfaz. */
export const ENGINE_NAME = "Alfil Beta";

/** Estado de la partida contra la máquina: añade quién piensa y a quién le toca. */
export function machineStatusMessage(status: GameStatus, turn: Color, inCheck: boolean, humanTurn: boolean, thinking: boolean): string {
  const base = statusMessage(status, turn, inCheck);
  if (status.kind !== "ongoing") return base;
  if (thinking) return `${base} ${ENGINE_NAME} está pensando.`;
  return humanTurn ? `${base} Te toca.` : base;
}

/** Anuncio de la jugada de la máquina para la región viva: «Alfil Beta juega Cf6. Juegan las blancas.» */
export function machineMoveAnnouncement(san: string, nextStatus: string): string {
  return `${ENGINE_NAME} juega ${sanToSpanish(san)}. ${nextStatus}`;
}

/** Resultado de la partida visto desde la persona: título y causa. `null` si sigue en marcha. */
export function resultMessage(status: GameStatus, player: Color): { title: string; text: string } | null {
  if (status.kind === "ongoing") return null;
  const text = statusMessage(status, player, false);
  if (status.kind === "checkmate") return { title: status.winner === player ? "Has ganado." : "Has perdido.", text };
  return { title: "Tablas.", text };
}

/** Texto de la cabecera de la partida contra la máquina. */
export function machineHeading(levelName: string, short: boolean): string {
  return short ? `${ENGINE_NAME} · ${levelName}` : `Contra ${ENGINE_NAME} · nivel ${levelName}`;
}
