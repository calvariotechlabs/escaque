// Arrastre con el dedo: la pieza sube sobre el contacto para que el dedo no la tape (lienzo «Móvil · arrastrar con el dedo»).
// Con ratón o lápiz no cambia nada. Solo cuentas: el DOM lo toca board-input.ts.

/** Cuánto crece la pieza elevada. */
export const LIFT_SCALE = 1.5;
/** Cuántas casillas por encima del punto de contacto queda el centro de la pieza elevada. */
export const LIFT_OFFSET_CELLS = 1.5;

/** ¿Este tipo de puntero levanta la pieza? Solo el dedo, que es el que la tapa. */
export function liftsPiece(pointerType: string): boolean {
  return pointerType === "touch";
}

/**
 * `transform` de la pieza arrastrada. `dx` y `dy` son lo que se ha movido el puntero desde que pulsó;
 * `cell` es el lado de una casilla en píxeles. La pieza escala desde su centro (el de la casilla de origen).
 */
export function liftedTransform(dx: number, dy: number, cell: number, lifted: boolean): string {
  if (!lifted) return `translate(${dx}px, ${dy}px)`;
  return `translate(${dx}px, ${dy - LIFT_OFFSET_CELLS * cell}px) scale(${LIFT_SCALE})`;
}

/**
 * Esquina superior izquierda (respecto a la esquina de la casilla de origen) de la etiqueta con el nombre de
 * la casilla que hay bajo el dedo: junto a la pieza elevada, donde el dedo no tapa. Si el dedo va por la
 * derecha del tablero (`flip`), la etiqueta pasa a la izquierda; entonces `x` es su borde derecho.
 */
export function chipPlacement(dx: number, dy: number, cell: number, flip = false): { x: number; y: number } {
  const y = dy - 1.6 * cell;
  return flip ? { x: dx - 0.3 * cell, y } : { x: dx + 1.3 * cell, y };
}
