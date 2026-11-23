// Flechas sobre el tablero (CAL-394): la mejor jugada (llena) y la tuya
// (discontinua). Solo geometría, sin DOM: el tablero las pinta en un SVG de
// 8 × 8 unidades encima de la rejilla. La del caballo dobla en L por el lado largo.
import type { Color } from "../core/index.js";

export interface Arrow {
  readonly from: string;
  readonly to: string;
  /** `mejor`: llena, en el color de acento. `tuya`: discontinua y en tinta. */
  readonly kind: "mejor" | "tuya";
}

export interface ArrowShape {
  readonly kind: Arrow["kind"];
  /** Trazo del cuerpo (atributo `d` de un `<path>`). */
  readonly d: string;
  /** Punta (atributo `points` de un `<polygon>`). */
  readonly head: string;
}

const SQUARE = /^[a-h][1-8]$/;

/** Centro de una casilla en unidades del SVG, según desde qué bando se ve. */
function center(square: string, orientation: Color): [number, number] {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  const col = orientation === "w" ? file : 7 - file;
  const row = orientation === "w" ? 7 - rank : rank;
  return [col + 0.5, row + 0.5];
}

const n = (value: number): string => value.toFixed(2);

export function arrowShapes(arrows: readonly Arrow[], orientation: Color): ArrowShape[] {
  const shapes: ArrowShape[] = [];
  for (const arrow of arrows) {
    if (!SQUARE.test(arrow.from) || !SQUARE.test(arrow.to) || arrow.from === arrow.to) continue;
    const a = center(arrow.from, orientation);
    const b = center(arrow.to, orientation);
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const points: [number, number][] = [a];
    if (Math.abs(dx) * Math.abs(dy) === 2) points.push(Math.abs(dx) > Math.abs(dy) ? [b[0], a[1]] : [a[0], b[1]]);
    const last = points[points.length - 1]!;
    const length = Math.hypot(b[0] - last[0], b[1] - last[1]);
    const ux = (b[0] - last[0]) / length;
    const uy = (b[1] - last[1]) / length;
    const [h, w] = arrow.kind === "mejor" ? [0.42, 0.27] : [0.34, 0.21];
    const tip: [number, number] = [b[0] - ux * 0.1, b[1] - uy * 0.1];
    const base: [number, number] = [tip[0] - ux * h, tip[1] - uy * h];
    const d = `M${n(a[0])} ${n(a[1])}${points
      .slice(1)
      .map(([x, y]) => ` L${n(x)} ${n(y)}`)
      .join("")} L${n(base[0])} ${n(base[1])}`;
    const left = `${n(base[0] - uy * w)},${n(base[1] + ux * w)}`;
    const right = `${n(base[0] + uy * w)},${n(base[1] - ux * w)}`;
    shapes.push({ kind: arrow.kind, d, head: `${n(tip[0])},${n(tip[1])} ${left} ${right}` });
  }
  return shapes;
}

/** Marcado del SVG de flechas. Solo números y clases fijas: nada que escapar. */
export function arrowsSvg(arrows: readonly Arrow[], orientation: Color): string {
  const shapes = arrowShapes(arrows, orientation);
  if (shapes.length === 0) return "";
  const inner = shapes
    .map((s) => `<path class="flecha flecha--${s.kind}" d="${s.d}"/><polygon class="flecha-punta--${s.kind}" points="${s.head}"/>`)
    .join("");
  return `<svg class="tablero__flechas" viewBox="0 0 8 8" aria-hidden="true" focusable="false">${inner}</svg>`;
}
