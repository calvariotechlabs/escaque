// Piezas capturadas y ventaja de material (panel «Capturas»). Sin DOM: se prueba en Node.
// La ventaja es el material que queda en el tablero: lo capturado más lo que suma coronar
// (una peona que corona en dama suma 8 aunque no se haya capturado nada).
import type { Color, PieceType } from "../core/index.js";
import type { PlayedMove } from "./notation.js";
import { pieceMarkup } from "./pieces.js";

/** Tipos que se pueden capturar, de más a menos valor (el rey no se captura). */
export const CAPTURABLE: readonly PieceType[] = ["q", "r", "b", "n", "p"];

export type CapturedCounts = Readonly<Record<"q" | "r" | "b" | "n" | "p", number>>;

export interface Captures {
  /** Piezas negras que han capturado las blancas. */
  readonly w: CapturedCounts;
  /** Piezas blancas que han capturado las negras. */
  readonly b: CapturedCounts;
  /** Quién va por delante y por cuántos puntos; `color` es `null` si hay igualdad. */
  readonly lead: { readonly color: Color | null; readonly points: number };
}

const VALUE: Readonly<Record<string, number>> = { p: 1, n: 3, b: 3, r: 5, q: 9 };

function empty(): Record<"q" | "r" | "b" | "n" | "p", number> {
  return { q: 0, r: 0, b: 0, n: 0, p: 0 };
}

export function captureSummary(moves: readonly Pick<PlayedMove, "color" | "captured" | "promotion">[]): Captures {
  const w = empty();
  const b = empty();
  let balance = 0; // positivo: ventaja blanca
  for (const move of moves) {
    const sign = move.color === "w" ? 1 : -1;
    const counts = move.color === "w" ? w : b;
    if (move.captured !== null && move.captured !== "k") {
      counts[move.captured]++;
      balance += sign * VALUE[move.captured]!;
    }
    if (move.promotion !== null) balance += sign * (VALUE[move.promotion]! - 1);
  }
  const lead = balance === 0 ? { color: null, points: 0 } : { color: balance > 0 ? ("w" as const) : ("b" as const), points: Math.abs(balance) };
  return { w, b, lead };
}

/** Grupos por tipo, de más a menos valor, sin los tipos que no se han capturado. */
export function capturedGroups(counts: CapturedCounts): { type: PieceType; count: number }[] {
  const groups: { type: PieceType; count: number }[] = [];
  for (const type of CAPTURABLE) {
    const count = counts[type as keyof CapturedCounts];
    if (count > 0) groups.push({ type, count });
  }
  return groups;
}

const PHRASE: Readonly<Record<string, { one: string; many: string }>> = {
  q: { one: "una dama", many: "damas" },
  r: { one: "una torre", many: "torres" },
  b: { one: "un alfil", many: "alfiles" },
  n: { one: "un caballo", many: "caballos" },
  p: { one: "un peón", many: "peones" },
};

/** Texto para el lector de pantalla: «Blancas han capturado un caballo y 2 peones. Ventaja de 2.» */
export function capturesDescription(color: Color, summary: Captures): string {
  const side = color === "w" ? "Blancas" : "Negras";
  const parts = capturedGroups(color === "w" ? summary.w : summary.b).map(({ type, count }) => (count === 1 ? PHRASE[type]!.one : `${count} ${PHRASE[type]!.many}`));
  const lead = summary.lead.color === color ? ` Ventaja de ${summary.lead.points}.` : "";
  if (parts.length === 0) return `${side} no han capturado nada.${lead}`;
  const list = parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]!}`;
  return `${side} han capturado ${list}.${lead}`;
}

function rowMarkup(color: Color, summary: Captures): string {
  const side = color === "w" ? "Blancas" : "Negras";
  const rival: Color = color === "w" ? "b" : "w";
  const groups = capturedGroups(color === "w" ? summary.w : summary.b);
  const pieces =
    groups.length === 0
      ? `<span class="capturas__nada">Ninguna</span>`
      : groups.map(({ type, count }) => `<span class="capturas__grupo">${pieceMarkup(rival, type).repeat(count)}</span>`).join("");
  const lead = summary.lead.color === color ? `<span class="capturas__ventaja" aria-hidden="true">+${summary.lead.points}</span>` : "<span></span>";
  return (
    `<li class="capturas__fila"><span class="capturas__quien" aria-hidden="true"><span class="estado__turno estado__turno--${color}" aria-hidden="true"></span>${side}</span>` +
    `<span class="capturas__piezas" aria-hidden="true">${pieces}</span>${lead}` +
    `<span class="oculto">${capturesDescription(color, summary)}</span></li>`
  );
}

/**
 * Contenido del panel «Capturas»: la lista de los dos bandos y, si hay capturas con el material
 * igualado, una nota. Sin ninguna captura, una sola línea «Ninguna todavía» (panel plegado, CAL-404). `bottom` es el bando que está abajo en el tablero: su fila va primero.
 * Marcado fijo salvo las piezas de `pieceMarkup`; no lleva `style` (CSP estricta).
 */
export function capturesMarkup(summary: Captures, bottom: Color): string {
  const top: Color = bottom === "w" ? "b" : "w";
  const any = [...CAPTURABLE].some((t) => summary.w[t as keyof CapturedCounts] + summary.b[t as keyof CapturedCounts] > 0);
  if (!any) return `<p class="capturas__vacio">Ninguna todavía</p>`;
  const note = summary.lead.color === null ? `<p class="capturas__nota">Material igualado.</p>` : "";
  return `<ul class="capturas__lista">${rowMarkup(bottom, summary)}${rowMarkup(top, summary)}</ul>${note}`;
}
