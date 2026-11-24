// Cuándo se da por terminado un gesto del tablero que el navegador no cerró. Solo la decisión, sin DOM:
// board-input.ts la consulta en cada `pointerdown` que llega con un gesto abierto.

/**
 * Milisegundos sin noticias de un dedo apoyado que todavía no arrastra a partir de los cuales otro toque lo
 * sustituye: quien deja un dedo quieto en una casilla y toca otra quiere jugar con el segundo.
 */
export const ABANDONED_MS = 500;

/**
 * Lo mismo para un dedo que arrastra una pieza: se respeta mucho más, porque es normal pararse a pensar con la
 * pieza en la mano. Es una red de seguridad por si el navegador pierde el dedo mientras otro sigue apoyado (un
 * pulgar en el borde de la pantalla): entonces los toques nuevos no son principales y solo el tiempo lo delata.
 */
export const LOST_MS = 3_000;

/** Lo que hace falta saber del gesto abierto. */
export interface OpenGesture {
  readonly pointerId: number;
  readonly pointerType: string;
  /** Momento (`timeStamp`) de la última noticia del puntero: al pulsar o al moverse. */
  readonly lastSeen: number;
  /** ¿Lleva ya una pieza arrastrando? */
  readonly dragging: boolean;
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
 * dedo que arrastra y se queda quieto sigue apoyado: el roce de otro dedo se ignora y el arrastre sigue.
 */
export function abandonedBy(open: OpenGesture, press: Press): boolean {
  if (press.pointerId === open.pointerId) return true; // el mismo puntero vuelve a pulsar: el gesto anterior ya terminó
  if (press.pointerType !== open.pointerType) return true; // nadie arrastra con el dedo y pulsa con el ratón a la vez
  // Un toque nuevo es el principal solo si no queda ningún otro dedo apoyado: el que arrastraba ya no está.
  if (press.isPrimary) return true;
  return press.timeStamp - open.lastSeen >= (open.dragging ? LOST_MS : ABANDONED_MS);
}
