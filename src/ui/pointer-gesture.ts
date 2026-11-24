// Cuándo se da por terminado un gesto del tablero que el navegador no cerró. Solo la decisión, sin DOM:
// board-input.ts la consulta en cada `pointerdown` que llega con un gesto abierto.

/**
 * Milisegundos sin noticias del puntero que arrastra a partir de los cuales se da por perdido aunque el
 * navegador diga que sigue apoyado. Es solo una red de seguridad para que el tablero nunca se quede bloqueado:
 * nadie sostiene una pieza quieta tanto rato mientras toca con otro dedo.
 */
export const LOST_MS = 10_000;

/** Lo que hace falta saber del gesto abierto. */
export interface OpenGesture {
  readonly pointerId: number;
  readonly pointerType: string;
  /** Momento (`timeStamp`) de la última noticia del puntero: al pulsar o al moverse. */
  readonly lastSeen: number;
}

/** Lo que hace falta saber del `pointerdown` nuevo. */
export interface Press {
  readonly pointerId: number;
  readonly pointerType: string;
  readonly isPrimary: boolean;
  readonly timeStamp: number;
}

/**
 * ¿El gesto abierto está abandonado, a la vista de un `pointerdown` nuevo? Safari en iOS puede dejar un toque
 * sin pointerup ni pointercancel; sin esta comprobación el tablero ignoraría todos los toques siguientes. Pero un
 * dedo quieto que sigue apoyado no está abandonado: el roce de otro dedo se ignora y el arrastre sigue.
 */
export function abandonedBy(open: OpenGesture, press: Press): boolean {
  if (press.pointerId === open.pointerId) return true; // el mismo puntero vuelve a pulsar: el gesto anterior ya terminó
  if (press.pointerType !== open.pointerType) return true; // nadie arrastra con el dedo y pulsa con el ratón a la vez
  // Un toque nuevo es el principal solo si no queda ningún otro dedo apoyado: el que arrastraba ya no está.
  if (press.isPrimary) return true;
  return press.timeStamp - open.lastSeen >= LOST_MS;
}
