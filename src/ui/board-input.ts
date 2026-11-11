// Entrada del tablero: traduce clic, arrastre y teclado a llamadas de `Interaction`.
// Es la misma para la partida y para las lecciones; cada pantalla le pasa lo suyo
// (su interacción, cómo pintar y cómo seguir tras una jugada) en un `BoardInputHost`.
import type { BoardView } from "./board.js";
import type { Interaction, Outcome } from "./interaction.js";

export interface BoardInputHost {
  readonly view: BoardView;
  /** La interacción actual (la partida puede cambiarla al empezar otra). */
  interaction(): Interaction;
  /** Aplica el resultado de una acción: anuncios y repintado. */
  handle(outcome: Outcome): void;
  /** Repinta; se llama al empezar un arrastre para enseñar la selección. */
  render(): void;
  /** Lleva el foco a la casilla con foco de la interacción. */
  focusBoard(): void;
  /** Deja solo la casilla con foco en el orden de tabulación. */
  syncTabIndex(): void;
  /** Hay un diálogo de coronación abierto: el foco no vuelve al tablero. */
  promotionOpen(): boolean;
  /** `false` mientras el tablero no debe responder (lección resuelta, por ejemplo). Por defecto, siempre responde. */
  enabled?(): boolean;
}

/** Distancia en píxeles a partir de la cual un gesto es un arrastre y no un clic. */
const DRAG_THRESHOLD = 4;

interface Gesture {
  readonly pointerId: number;
  readonly square: string;
  readonly x: number;
  readonly y: number;
  dragging: boolean;
  /** La pieza no se puede arrastrar: si el dedo se mueve un poco, sigue siendo un toque. */
  tapOnly: boolean;
  /** ¿Estaba el foco en el tablero al empezar? Entonces sigue a la casilla. */
  hadFocus: boolean;
}

export function attachBoardInput(host: BoardInputHost): void {
  const { view } = host;
  let gesture: Gesture | null = null;
  const enabled = (): boolean => host.enabled === undefined || host.enabled();

  function squareAt(target: EventTarget | null): string | null {
    if (!(target instanceof Element)) return null;
    const cell = target.closest<HTMLElement>("[data-square]");
    return cell !== null && view.element.contains(cell) ? cell.dataset["square"] ?? null : null;
  }

  /** Pieza que se arrastra: se mueve con el puntero y queda por encima del resto de casillas. */
  function draggedPiece(): { cell: HTMLElement; piece: Element | null } | null {
    if (gesture === null) return null;
    const cell = view.squareElement(gesture.square);
    return { cell, piece: cell.querySelector(".pieza") };
  }

  function resetDraggedPiece(): void {
    const dragged = draggedPiece();
    if (dragged === null) return;
    dragged.cell.style.removeProperty("z-index");
    if (dragged.piece instanceof SVGElement) {
      dragged.piece.style.removeProperty("transform");
      dragged.piece.style.removeProperty("pointer-events");
    }
  }

  view.element.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || gesture !== null || !enabled()) return;
    const square = squareAt(event.target);
    if (square === null) return;
    gesture = {
      pointerId: event.pointerId,
      square,
      x: event.clientX,
      y: event.clientY,
      dragging: false,
      tapOnly: false,
      hadFocus: view.element.contains(document.activeElement),
    };
    view.element.setPointerCapture(event.pointerId);
    event.preventDefault(); // sin selección de texto ni arrastre nativo de imágenes
  });

  view.element.addEventListener("pointermove", (event) => {
    if (gesture === null || event.pointerId !== gesture.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (gesture.tapOnly) return;
    if (!gesture.dragging) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (!host.interaction().dragStart(gesture.square)) {
        gesture.tapOnly = true;
        return;
      }
      gesture.dragging = true;
      host.interaction().focus = gesture.square;
      host.render();
    }
    const dragged = draggedPiece();
    if (dragged === null) return;
    dragged.cell.style.zIndex = "4";
    if (dragged.piece instanceof SVGElement) {
      dragged.piece.style.transform = `translate(${dx}px, ${dy}px)`;
      dragged.piece.style.pointerEvents = "none";
    }
  });

  function endGesture(event: PointerEvent, cancelled: boolean): void {
    if (gesture === null || event.pointerId !== gesture.pointerId) return;
    const { square, dragging, hadFocus } = gesture;
    resetDraggedPiece();
    gesture = null;
    if (view.element.hasPointerCapture(event.pointerId)) view.element.releasePointerCapture(event.pointerId);
    if (dragging) {
      const target = cancelled ? null : squareAt(document.elementFromPoint(event.clientX, event.clientY));
      host.handle(host.interaction().drop(target));
    } else if (!cancelled) {
      host.interaction().focus = square;
      host.handle(host.interaction().click(square));
    }
    // El tablero puede haberse reconstruido: se mira el foco de antes del gesto, no el de ahora.
    if (hadFocus && !host.promotionOpen()) host.focusBoard();
  }

  view.element.addEventListener("pointerup", (event) => endGesture(event, false));
  view.element.addEventListener("pointercancel", (event) => endGesture(event, true));
  // Si el navegador quita la captura sin pointerup ni pointercancel, el gesto se cancela para no bloquear el tablero.
  view.element.addEventListener("lostpointercapture", (event) => endGesture(event, true));

  view.element.addEventListener("keydown", (event) => {
    if (squareAt(event.target) === null || event.altKey || event.ctrlKey || event.metaKey) return;
    // Con el tablero bloqueado solo se mueve el foco: no se selecciona ni se juega.
    const interaction = host.interaction();
    const locked = !enabled();
    if (locked && (event.key === "Enter" || event.key === " " || event.key === "Escape")) return;
    const outcome = interaction.key(event.key);
    if (outcome.kind === "none") return;
    event.preventDefault();
    host.handle(outcome);
    if (!host.promotionOpen()) host.focusBoard();
  });

  // Si el foco entra en el tablero por otra casilla (clic de ratón, lector de pantalla), la seguimos.
  view.element.addEventListener("focusin", (event) => {
    const square = squareAt(event.target);
    if (square !== null && square !== host.interaction().focus) {
      host.interaction().focus = square;
      host.syncTabIndex();
    }
  });
}
