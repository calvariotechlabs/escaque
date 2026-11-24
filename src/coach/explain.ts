// Coach mejorado (CAL-394): por qué una jugada es buena, la línea de Alfil
// Beta en texto y las tres pistas para la jugada que toca.
//
// El motivo sale de la posición y de la línea principal (PV) del motor:
//   1. mate: la puntuación es de mate;
//   2. ataque doble (horquilla): la pieza movida ataca a la vez dos piezas
//      que valen más que ella o están sin defensa, y la línea gana material;
//   3. clavada: una pieza de largo alcance ataca una pieza que tapa a otra
//      más valiosa (o al rey), y la línea gana material;
//   4. material: la línea gana al menos un peón;
//   5. pone a salvo una pieza que estaba atacada;
//   6. sin motivo táctico («posicional»): la interfaz lo dice con la evaluación.
// Los ataques se miran con geometría 0x88 (sin clavadas propias): basta para
// explicar, y cada motivo táctico se confirma con la línea del motor.
import { Position, moveToUci } from "../core/index.js";
import type { Color, Move, PieceType, Square } from "../core/index.js";
import { MATE_SCORE, PIECE_VALUES, TranspositionTable, search } from "../engine/index.js";
import type { SearchLimits, SearchOptions } from "../engine/index.js";
import { capturedValue, exchangeGain } from "./exchange.js";
import { joinPhrases, pawns, side, spanishSan, withArticle } from "./text.js";

export type MotiveKind = "mate" | "horquilla" | "clavada" | "material" | "salva" | "posicional";

/** Por qué una jugada es buena: el tipo de motivo y una frase con punto final. */
export interface Motive {
  readonly kind: MotiveKind;
  readonly text: string;
}

/** Pistas para la jugada que toca, de menos a más. */
export interface Hint {
  /** Jugada que recomienda Alfil Beta (UCI y SAN inglesa). */
  readonly move: { readonly uci: string; readonly san: string };
  /** Pista 1: la idea, sin decir la jugada. */
  readonly idea: string;
  /** Pista 2: qué pieza mover («Mueve la dama de d1.»). */
  readonly piece: string;
  /** Pista 3: la jugada («Alfil Beta jugaría Dxf3.»). */
  readonly play: string;
  /** Casillas de origen y destino, para la marca y la flecha. */
  readonly from: string;
  readonly to: string;
}

const MATE_BOUND = MATE_SCORE - 1_000;
/** Material mínimo, en centipeones, para hablar de ganar material. */
const MIN_GAIN = PIECE_VALUES.p;
/** Medias jugadas de la línea que se muestran. */
const LINE_PLIES = 4;
/**
 * Medias jugadas de la línea que cuentan para el material. Cubre las líneas
 * que completa el coach (7 más hasta 4 para acabar un cambio, ver analyze.ts):
 * una recaptura al final no puede quedarse fuera de la cuenta.
 */
const MATERIAL_PLIES = 12;
/** Un mate en contra se escribe entero hasta esta distancia; más largo, sin línea. */
const MATE_LINE_MOVES = 5;

const KNIGHT = [-33, -31, -18, -14, 14, 18, 31, 33];
const KING = [-17, -16, -15, -1, 1, 15, 16, 17];
const DIAGONAL = [-17, -15, 15, 17];
const STRAIGHT = [-16, -1, 1, 16];

const squareName = (square: Square): string => "abcdefgh"[square & 7]! + String((square >> 4) + 1);
const opposite = (color: Color): Color => (color === "w" ? "b" : "w");
const onBoard = (square: number): boolean => (square & 0x88) === 0;
const value = (type: PieceType): number => (type === "k" ? 100_000 : PIECE_VALUES[type]);
const slides = (type: PieceType): readonly number[] =>
  type === "b" ? DIAGONAL : type === "r" ? STRAIGHT : type === "q" ? [...DIAGONAL, ...STRAIGHT] : [];

/** Casillas que ataca la pieza de `square` (los rayos se paran en la primera pieza, que se incluye). */
function attacks(position: Position, square: Square): Square[] {
  const piece = position.pieceAt(square);
  if (piece === null) return [];
  const out: Square[] = [];
  if (piece.type === "p") {
    for (const offset of piece.color === "w" ? [15, 17] : [-15, -17]) if (onBoard(square + offset)) out.push(square + offset);
  } else if (piece.type === "n" || piece.type === "k") {
    for (const offset of piece.type === "n" ? KNIGHT : KING) if (onBoard(square + offset)) out.push(square + offset);
  } else {
    for (const dir of slides(piece.type)) {
      for (let to = square + dir; onBoard(to); to += dir) {
        out.push(to);
        if (position.pieceAt(to) !== null) break;
      }
    }
  }
  return out;
}

/** Piezas de `color` que atacan `target`. */
function attackersOf(position: Position, target: Square, color: Color): Square[] {
  const found: Square[] = [];
  for (let square = 0; square < 120; square++) {
    if (!onBoard(square)) continue;
    const piece = position.pieceAt(square);
    if (piece !== null && piece.color === color && attacks(position, square).includes(target)) found.push(square);
  }
  return found;
}

/** «la dama de c7». */
const pieceAtText = (position: Position, square: Square): string => `${withArticle(position.pieceAt(square)!.type)} de ${squareName(square)}`;

/** Número de jugada de la posición (campo 6 de la FEN). */
const moveNumber = (position: Position): number => Number(position.toFen().split(" ")[5]);

/** «5. Cxe5» (blancas) o «5… dxe5» (negras), con la SAN en español. */
function numbered(position: Position, move: Move): string {
  const san = spanishSan(position.moveToSan(move));
  return position.turn === "w" ? `${moveNumber(position)}. ${san}` : `${moveNumber(position)}… ${san}`;
}

/**
 * Línea en texto, con números y SAN española: «5. Cxe5 dxe5 6. Dxg4 Cf6».
 * Como mucho `plies` medias jugadas (cuatro); se corta en la primera que no es legal.
 * Deja `position` como estaba.
 */
export function lineText(position: Position, line: readonly string[], plies = LINE_PLIES): string {
  const parts: string[] = [];
  let played = 0;
  try {
    for (const uci of line.slice(0, plies)) {
      const move = position.moveFromUci(uci);
      if (move === null) break;
      const san = spanishSan(position.moveToSan(move));
      parts.push(played === 0 || position.turn === "w" ? numbered(position, move) : san);
      position.makeMove(move);
      played++;
    }
  } finally {
    for (let i = 0; i < played; i++) position.unmakeMove();
  }
  return parts.join(" ");
}

/** Material que gana quien mueve en `position` siguiendo la línea (capturas y coronaciones). Deja `position` como estaba. */
export function lineGain(position: Position, line: readonly string[]): number {
  const mover = position.turn;
  let gain = 0;
  let played = 0;
  try {
    for (const uci of line.slice(0, MATERIAL_PLIES)) {
      const move = position.moveFromUci(uci);
      if (move === null) break;
      const won = capturedValue(position, move) + (move.promotion === null ? 0 : PIECE_VALUES[move.promotion] - PIECE_VALUES.p);
      gain += position.turn === mover ? won : -won;
      position.makeMove(move);
      played++;
    }
  } finally {
    for (let i = 0; i < played; i++) position.unmakeMove();
  }
  return gain;
}

/** Captura de una línea: quién captura y qué pieza (o coronación). */
interface LineCapture {
  readonly by: Color;
  readonly type: PieceType | null;
  readonly promotion: PieceType | null;
}

/** Capturas y coronaciones de las primeras `plies` medias jugadas de la línea. Deja `position` como estaba. */
export function lineCaptures(position: Position, line: readonly string[], plies = MATERIAL_PLIES): LineCapture[] {
  const out: LineCapture[] = [];
  let played = 0;
  try {
    for (const uci of line.slice(0, plies)) {
      const move = position.moveFromUci(uci);
      if (move === null) break;
      const target = position.pieceAt(move.to);
      const enPassant = target === null && position.pieceAt(move.from)?.type === "p" && (move.from & 7) !== (move.to & 7);
      const type = target !== null ? target.type : enPassant ? "p" : null;
      if (type !== null || move.promotion !== null) out.push({ by: position.turn, type, promotion: move.promotion });
      position.makeMove(move);
      played++;
    }
  } finally {
    for (let i = 0; i < played; i++) position.unmakeMove();
  }
  return out;
}

/** Clase de material para compensar cambios: caballo y alfil valen lo mismo. */
const materialClass = (type: PieceType): string => (type === "n" || type === "b" ? "menor" : type);

const COUNT = ["", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho"] as const;

/** «un peón», «dos peones», «un caballo», «una torre», «la dama». */
function counted(type: PieceType, count: number): string {
  if (type === "q" && count === 1) return "la dama";
  const name = type === "p" ? "peón" : type === "n" ? "caballo" : type === "b" ? "alfil" : type === "r" ? "torre" : "dama";
  if (count === 1) return `${type === "r" || type === "q" ? "una" : "un"} ${name}`;
  const plural = name === "peón" ? "peones" : `${name}s`;
  return `${COUNT[count] ?? String(count)} ${plural}`;
}

/** «la dama», «una torre y un peón»: lista de piezas, de más a menos valiosa. */
function pieceList(types: readonly PieceType[]): string {
  const counts: [PieceType, number][] = [];
  for (const type of types) {
    const entry = counts.find(([t]) => t === type);
    if (entry !== undefined) entry[1]++;
    else counts.push([type, 1]);
  }
  counts.sort(([a], [b]) => value(b) - value(a));
  return joinPhrases(counts.map(([type, count]) => counted(type, count)));
}

/**
 * Qué gana `mover` en la línea, nombrando solo piezas que de verdad se
 * capturan en ella: «un peón», «la dama a cambio de un caballo». Caballo y
 * alfil se compensan entre sí. Si no se puede decir con piezas (coronaciones),
 * da la cifra: «material (2,2 peones)». Así nunca se dice «gana una torre» si
 * la línea no captura ninguna torre (H-08).
 */
function gainText(captures: readonly LineCapture[], mover: Color, gain: number): string {
  const won: PieceType[] = [];
  const lost: PieceType[] = [];
  let promoted = false;
  for (const capture of captures) {
    if (capture.promotion !== null) promoted = true;
    if (capture.type !== null) (capture.by === mover ? won : lost).push(capture.type);
  }
  // Se compensan las capturas de la misma pieza y luego las de la misma clase (caballo por alfil).
  for (const same of [(a: PieceType, b: PieceType) => a === b, (a: PieceType, b: PieceType) => materialClass(a) === materialClass(b)]) {
    for (let i = lost.length - 1; i >= 0; i--) {
      const match = won.findIndex((type) => same(type, lost[i]!));
      if (match === -1) continue;
      won.splice(match, 1);
      lost.splice(i, 1);
    }
  }
  if (promoted || won.length === 0) return `material (${pawns(gain)} peones)`;
  return lost.length === 0 ? pieceList(won) : `${pieceList(won)} a cambio de ${pieceList(lost)}`;
}

/** ¿Está atacada la pieza de `square` por algo que la gana (menos valiosa o sin defensa)? Devuelve el atacante más barato. */
function threat(position: Position, square: Square): Square | null {
  const piece = position.pieceAt(square)!;
  const attackers = attackersOf(position, square, opposite(piece.color));
  if (attackers.length === 0) return null;
  attackers.sort((a, b) => value(position.pieceAt(a)!.type) - value(position.pieceAt(b)!.type));
  const cheapest = attackers[0]!;
  const defended = attackersOf(position, square, piece.color).length > 0;
  return value(position.pieceAt(cheapest)!.type) < value(piece.type) || !defended ? cheapest : null;
}

/** Tras la jugada (en `position`, ya hecha), ¿ataca la pieza de `to` a dos piezas a la vez? Texto o `null`. */
function fork(position: Position, to: Square, san: string): string | null {
  const mover = position.pieceAt(to)!;
  if (exchangeGain(position, to) > 0) return null; // la pieza que ataca se pierde
  const targets = attacks(position, to).filter((square) => {
    const target = position.pieceAt(square);
    if (target === null || target.color === mover.color) return false;
    return target.type === "k" || value(target.type) > value(mover.type) || attackersOf(position, square, target.color).length === 0;
  });
  if (targets.length < 2) return null;
  targets.sort((a, b) => value(position.pieceAt(b)!.type) - value(position.pieceAt(a)!.type));
  const [first, second] = targets as [Square, Square];
  if (position.pieceAt(first)!.type === "k") return `${san} da jaque y a la vez ataca ${pieceAtText(position, second)}.`;
  return `${san} ataca a la vez ${pieceAtText(position, first)} y ${pieceAtText(position, second)}: una de las dos se pierde.`;
}

/** Tras la jugada (ya hecha), ¿clava la pieza de `to` una pieza del rival? Texto o `null`. */
function pin(position: Position, to: Square, san: string): string | null {
  const mover = position.pieceAt(to)!;
  if (exchangeGain(position, to) > 0) return null;
  for (const dir of slides(mover.type)) {
    let pinned: Square | null = null;
    for (let square = to + dir; onBoard(square); square += dir) {
      const piece = position.pieceAt(square);
      if (piece === null) continue;
      if (piece.color === mover.color) break;
      if (pinned === null) {
        if (piece.type === "k") break;
        pinned = square;
        continue;
      }
      const front = position.pieceAt(pinned)!;
      const undefended = attackersOf(position, pinned, front.color).length === 0;
      if (value(piece.type) <= value(front.type) || (!undefended && value(front.type) < value(mover.type))) break;
      const head = `${san} clava ${pieceAtText(position, pinned)}`;
      return piece.type === "k"
        ? `${head}: si se mueve, el rey queda en jaque.`
        : `${head} contra ${pieceAtText(position, square)}: si se mueve, se pierde ${withArticle(piece.type)}.`;
    }
  }
  return null;
}

/**
 * Por qué es buena la jugada `uci` en `position`. `line` es la línea del motor
 * que empieza por ella y `score`, su puntuación para quien mueve (los mates
 * como en el motor). Deja `position` como estaba.
 */
export function explainMove(position: Position, uci: string, line: readonly string[], score: number): Motive {
  const move = position.moveFromUci(uci);
  if (move === null) return { kind: "posicional", text: "" };
  const color = position.turn;
  const san = spanishSan(position.moveToSan(move));
  const fullLine = line[0] === uci ? line : [uci];

  if (score > MATE_BOUND) {
    const moves = Math.ceil((MATE_SCORE - score) / 2);
    return { kind: "mate", text: moves <= 1 ? `${san.replace(/#$/, "")} da mate.` : `${san} lleva al mate en ${moves}.` };
  }

  const gain = lineGain(position, fullLine);
  const directGain = capturedValue(position, move);
  // Piezas propias atacadas antes de mover (para «pone a salvo»).
  const threatened: { square: Square; by: Square }[] = [];
  for (let square = 0; square < 120; square++) {
    if (!onBoard(square)) continue;
    const piece = position.pieceAt(square);
    if (piece === null || piece.color !== color || piece.type === "k") continue;
    const by = threat(position, square);
    if (by !== null) threatened.push({ square, by });
  }
  threatened.sort((a, b) => value(position.pieceAt(b.square)!.type) - value(position.pieceAt(a.square)!.type));
  const savedText = threatened.length > 0 ? `${pieceAtText(position, threatened[0]!.square)}` : "";
  const byText = threatened.length > 0 ? pieceAtText(position, threatened[0]!.by) : "";
  const savedType = threatened.length > 0 ? position.pieceAt(threatened[0]!.square)!.type : null;

  position.makeMove(move);
  try {
    // Si la propia captura ya explica lo ganado, el motivo es el material, no
    // una táctica (4…Dxg5 gana la dama; no «clava el peón de g2», H-03).
    if (gain - directGain >= MIN_GAIN) {
      const tactic = fork(position, move.to, san) ?? pin(position, move.to, san);
      if (tactic !== null) return { kind: tactic.includes(" clava ") ? "clavada" : "horquilla", text: tactic };
    }
  } finally {
    position.unmakeMove();
  }

  if (gain >= MIN_GAIN) return { kind: "material", text: materialText(position, fullLine, san, gainText(lineCaptures(position, fullLine), color, gain)) };

  if (threatened.length > 0) {
    const target = threatened[0]!.square;
    const newSquare = move.from === target ? move.to : target;
    position.makeMove(move);
    // A salvo de verdad: ni se gana ahora ni sigue atacada por algo que la gane
    // cuando pase el jaque (un jaque solo aplaza la amenaza, H-09).
    const safe = position.pieceAt(newSquare)?.color === color && exchangeGain(position, newSquare) === 0 && threat(position, newSquare) === null;
    position.unmakeMove();
    if (safe) {
      const attacked = savedType === "r" || savedType === "q" ? "atacada" : "atacado";
      return { kind: "salva", text: `${san} pone a salvo ${savedText}, que estaba ${attacked} por ${byText}.` };
    }
  }
  return { kind: "posicional", text: "" };
}

/** «Cxe5 gana un peón. Si las negras responden 5… dxe5, 6. Dxg4 se lleva el alfil.» */
function materialText(position: Position, line: readonly string[], san: string, won: string): string {
  const head = `${san} gana ${won}.`;
  if (line.length < 3) return head;
  const first = position.moveFromUci(line[0]!)!;
  position.makeMove(first);
  let played = 1;
  try {
    const reply = position.moveFromUci(line[1]!);
    if (reply === null) return head;
    const replyText = numbered(position, reply);
    const responder = position.turn;
    position.makeMove(reply);
    played++;
    const third = position.moveFromUci(line[2]!);
    const victim = third === null ? null : position.pieceAt(third.to);
    if (third === null || victim === null) return head;
    return `${head} Si ${side(responder)} responden ${replyText}, ${numbered(position, third)} se lleva ${withArticle(victim.type)}.`;
  } finally {
    for (let i = 0; i < played; i++) position.unmakeMove();
  }
}

/** Idea de la pista 1, según el motivo de la jugada y su tipo. */
function idea(position: Position, move: Move, motive: Motive, score: number): string {
  const color = position.turn;
  switch (motive.kind) {
    case "mate":
      return `Puedes dar mate en ${Math.max(1, Math.ceil((MATE_SCORE - score) / 2))}.`;
    case "horquilla":
      return "Busca una jugada que ataque dos piezas a la vez.";
    case "clavada":
      return "Busca una clavada: una pieza del rival tapa a otra más valiosa.";
    case "material": {
      if (capturedValue(position, move) === 0) return "Puedes ganar material.";
      const rank = move.to >> 4;
      const ownHalf = color === "w" ? rank <= 3 : rank >= 4;
      return ownHalf
        ? "Puedes recuperar material: una pieza del rival está en tu campo."
        : "Puedes ganar material: hay una pieza del rival mal defendida.";
    }
    case "salva":
      return "Una de tus piezas está atacada: ponla a salvo.";
    case "posicional": {
      const piece = position.pieceAt(move.from)!;
      if (piece.type === "k" && Math.abs((move.to & 7) - (move.from & 7)) === 2) return "Tu rey aún no está a salvo: piensa en enrocar.";
      position.makeMove(move);
      const check = position.isCheck();
      position.unmakeMove();
      if (check) return "Mira las jugadas que dan jaque.";
      const backRank = color === "w" ? 0 : 7;
      if ((piece.type === "n" || piece.type === "b") && move.from >> 4 === backRank) return "Saca una pieza que aún no ha salido.";
      return "No hay nada urgente: mejora tu pieza peor colocada.";
    }
  }
}

/**
 * Pistas para quien mueve en `position` (la partida ya cargada). Lanza si la
 * partida ha terminado. Deja `position` como estaba.
 */
export function hintForPosition(position: Position, limits: SearchLimits, options: SearchOptions = {}): Hint {
  const result = search(position, limits, { table: new TranspositionTable(), ...options });
  const uci = result.best!;
  const move = position.moveFromUci(uci)!;
  const motive = explainMove(position, uci, result.pv, result.score);
  const san = position.moveToSan(move);
  return {
    move: { uci: moveToUci(move), san },
    idea: idea(position, move, motive, result.score),
    piece: `Mueve ${withArticle(position.pieceAt(move.from)!.type)} de ${squareName(move.from)}.`,
    play: `Alfil Beta jugaría ${spanishSan(san)}.`,
    from: squareName(move.from),
    to: squareName(move.to),
  };
}

/** Lo que permite la jugada hecha (RC-02): la mejor respuesta del rival y por qué es fuerte. */
export interface Refutation {
  readonly kind: "mate" | "horquilla" | "clavada" | "material";
  /** «Tras g4, las negras dan mate en 1: 2… Dh4#.» o «Tras Dg5, las negras tienen 4… Dxg5: gana la dama.» */
  readonly text: string;
  /** La respuesta captura la pieza recién movida, que había capturado o dado jaque: puede ser un sacrificio. */
  readonly sacrifice: boolean;
  /** Material que gana el rival en la línea, contando desde la jugada hecha (0 en un mate). */
  readonly net: number;
}

/**
 * Qué permite `uci` en `position`. `line` es la línea del motor que empieza
 * por `uci` (la siguiente jugada es la respuesta del rival) y `replyScore`, la
 * puntuación de esa respuesta para el rival (los mates como en el motor). Solo
 * devuelve algo si la respuesta tiene un motivo comprobado en la línea: mate,
 * ataque doble, clavada o material. Deja `position` como estaba.
 */
export function refutationOf(position: Position, uci: string, line: readonly string[], replyScore: number): Refutation | null {
  const move = position.moveFromUci(uci);
  if (move === null || line[0] !== uci || line.length < 2) return null;
  const san = spanishSan(position.moveToSan(move));
  const captured = capturedValue(position, move) > 0;
  position.makeMove(move);
  try {
    if (position.status().kind !== "ongoing") return null;
    const reply = position.moveFromUci(line[1]!);
    if (reply === null) return null;
    const opponent = position.turn;
    const sacrifice = reply.to === move.to && (captured || position.isCheck());
    if (replyScore > MATE_BOUND) {
      const moves = Math.max(1, Math.ceil((MATE_SCORE - replyScore) / 2));
      const head = moves === 1 ? `${side(opponent)} dan mate en 1` : `${side(opponent)} tienen mate en ${moves}`;
      // La línea entera hasta el mate (2 × N − 1 medias jugadas); si es muy larga, solo la distancia.
      const text =
        moves <= MATE_LINE_MOVES ? `Tras ${san}, ${head}: ${lineText(position, line.slice(1), 2 * moves - 1)}.` : `Tras ${san}, ${head}.`;
      return { kind: "mate", text, sacrifice, net: 0 };
    }
    const motive = explainMove(position, line[1]!, line.slice(1), replyScore);
    if (motive.kind !== "horquilla" && motive.kind !== "clavada" && motive.kind !== "material") return null;
    const replyText = numbered(position, reply);
    const replySan = spanishSan(position.moveToSan(reply));
    // El material se cuenta desde la jugada hecha: si ella ya capturó algo, la
    // respuesta puede solo recuperarlo (20.Axd5 cxd5 es un cambio, no «gana un alfil»).
    position.unmakeMove();
    let net: number;
    let won: string;
    try {
      net = -lineGain(position, line);
      won = gainText(lineCaptures(position, line), opponent, net);
    } finally {
      position.makeMove(move);
    }
    if (net < MIN_GAIN) return null;
    if (motive.kind === "material") return { kind: "material", text: `Tras ${san}, ${side(opponent)} responden ${replyText} y ganan ${won}.`, sacrifice, net };
    const rest = motive.text.startsWith(`${replySan} `) ? motive.text.slice(replySan.length + 1) : motive.text;
    return { kind: motive.kind, text: `Tras ${san}, ${side(opponent)} tienen ${replyText}: ${rest}`, sacrifice, net };
  } finally {
    position.unmakeMove();
  }
}
