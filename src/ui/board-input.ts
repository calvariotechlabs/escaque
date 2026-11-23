// Entrada del tablero: traduce clic, arrastre y teclado a llamadas de `Interaction`.
// Es la misma para la partida y para las lecciones; cada pantalla le pasa lo suyo
// (su interacción, cómo pintar y cómo seguir tras una jugada) en un `BoardInputHost`.
import type { BoardView } from "./board.js";
import type { Interaction, Outcome } from "./interaction.js";
import { chipPlacement, liftedTransform, liftsPiece } from "./drag-lift.js";

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

/**
 * Milisegundos sin noticias de un gesto a partir de los cuales se da por abandonado. Safari en iOS puede dejar
 * un toque sin pointerup ni pointercancel; sin este límite el tablero ignoraría todos los toques siguientes.
 */
const ABANDONED_MS = 500;

interface Gesture {
  readonly pointerId: number;
  readonly pointerType: string;
  /** Momento (`timeStamp` del evento) de la última noticia del puntero: al pulsar o al moverse. */
  lastSeen: number;
  readonly square: string;
  readonly x: number;
  readonly y: number;
  dragging: boolean;
  /** La pieza no se puede arrastrar: si el dedo se mueve un poco, sigue siendo un toque. */
  tapOnly: boolean;
  /** ¿Estaba el foco en el tablero al empezar? Entonces sigue a la casilla. */
  hadFocus: boolean;
  /** Con el dedo la pieza se levanta sobre el contacto (y solo entonces hay lado de casilla, copia y etiqueta). */
  lifted: boolean;
  cell: number;
  /** Copia tenue que se queda en la casilla de origen. */
  ghost: Element | null;
  /** Etiqueta con el nombre de la casilla que hay bajo el dedo. */
  chip: HTMLElement | null;
  /** Casilla que hay bajo el puntero, con su marca de «bajo el dedo». */
  over: HTMLElement | null;
}

export function attachBoardInput(host: BoardInputHost): void {
  const { view } = host;
  let gesture: Gesture | null = null;
  const enabled = (): boolean => host.enabled === undefined || host.enabled();
  // Marca el tablero como jugable: la hoja de estilos le quita el desplazamiento y la selección con el dedo.
  view.element.classList.add("tablero--jugable");

  function squareAt(target: EventTarget | null): string | null {
    if (!(target instanceof Element)) return null;
    const cell = target.closest<HTMLElement>("[data-square]");
    return cell !== null && view.element.contains(cell) ? cell.dataset["square"] ?? null : null;
  }

  /** Pieza que se arrastra: se mueve con el puntero y queda por encima del resto de casillas. */
  function draggedPiece(): { cell: HTMLElement; piece: Element | null } | null {
    if (gesture === null) return null;
    const cell = view.squareElement(gesture.square);
    return { cell, piece: cell.querySelector(".pieza:not(.pieza--origen)") };
  }

  function resetDraggedPiece(): void {
    const dragged = draggedPiece();
    if (dragged === null) return;
    dragged.cell.style.removeProperty("z-index");
    if (dragged.piece instanceof SVGElement) {
      dragged.piece.style.removeProperty("transform");
      dragged.piece.style.removeProperty("pointer-events");
      dragged.piece.classList.remove("pieza--elevada");
    }
    if (gesture !== null) {
      gesture.ghost?.remove();
      gesture.chip?.remove();
      gesture.over?.removeAttribute("data-bajo-dedo");
    }
  }

  /** Levanta la pieza: queda una copia tenue en su casilla y aparece la etiqueta de la casilla de debajo. */
  function lift(g: Gesture, cell: HTMLElement, piece: SVGElement): void {
    g.lifted = true;
    g.cell = cell.getBoundingClientRect().width;
    piece.classList.add("pieza--elevada");
    const ghost = piece.cloneNode(true) as SVGElement;
    ghost.classList.add("pieza--origen");
    ghost.setAttribute("aria-hidden", "true");
    piece.before(ghost);
    g.ghost = ghost;
    const chip = document.createElement("span");
    chip.className = "arrastre__etiqueta";
    chip.setAttribute("aria-hidden", "true");
    cell.append(chip);
    g.chip = chip;
  }

  /** Marca la casilla bajo el dedo y escribe su nombre en la etiqueta, que va junto a la pieza elevada. */
  function showOver(g: Gesture, event: PointerEvent, dx: number, dy: number): void {
    const square = squareAt(document.elementFromPoint(event.clientX, event.clientY));
    const over = square === null ? null : view.squareElement(square);
    if (over !== g.over) {
      g.over?.removeAttribute("data-bajo-dedo");
      over?.setAttribute("data-bajo-dedo", "");
      g.over = over;
    }
    const chip = g.chip;
    if (chip === null) return;
    chip.hidden = square === null;
    chip.textContent = square;
    const bounds = view.element.getBoundingClientRect();
    const flip = event.clientX > bounds.left + 0.65 * bounds.width;
    const place = chipPlacement(dx, dy, g.cell, flip);
    chip.style.left = `${place.x}px`;
    chip.style.top = `${place.y}px`;
    chip.style.transform = flip ? "translateX(-100%)" : "";
  }

  /** ¿El gesto abierto está abandonado, a la vista de un `pointerdown` nuevo? */
  function abandonedBy(open: Gesture, event: PointerEvent): boolean {
    return (
      event.pointerId === open.pointerId || // el mismo puntero vuelve a pulsar: el gesto anterior ya terminó
      event.pointerType !== open.pointerType || // nadie arrastra con el dedo y pulsa con el ratón a la vez
      event.timeStamp - open.lastSeen >= ABANDONED_MS // el dedo lleva rato sin moverse: el navegador lo perdió
    );
  }

  view.element.addEventListener("pointerdown", (event) => {
    // Se lee todo antes de cancelar nada: cancelar repinta y devuelve el foco al tablero.
    const square = squareAt(event.target);
    const hadFocus = view.element.contains(document.activeElement);
    if (gesture !== null) {
      // Otro dedo mientras el primero sigue arrastrando: se ignora, y el arrastre sigue.
      if (!abandonedBy(gesture, event)) return;
      endGesture(gesture.pointerId, event.clientX, event.clientY, true);
    }
    if (event.button !== 0 || !enabled() || square === null) return;
    gesture = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      lastSeen: event.timeStamp,
      square,
      x: event.clientX,
      y: event.clientY,
      dragging: false,
      tapOnly: false,
      hadFocus,
      lifted: false,
      cell: 0,
      ghost: null,
      chip: null,
      over: null,
    };
    view.element.setPointerCapture(event.pointerId);
    event.preventDefault(); // sin selección de texto ni arrastre nativo de imágenes
  });

  view.element.addEventListener("pointermove", (event) => {
    if (gesture === null || event.pointerId !== gesture.pointerId) return;
    gesture.lastSeen = event.timeStamp;
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
      // Si el tablero se repinta a mitad de un arrastre, la casilla y la pieza son otras: se vuelve a levantar.
      if (gesture.lifted && gesture.ghost?.isConnected !== true) gesture.lifted = false;
      if (!gesture.lifted && liftsPiece(gesture.pointerType)) lift(gesture, dragged.cell, dragged.piece);
      dragged.piece.style.transform = liftedTransform(dx, dy, gesture.cell, gesture.lifted);
      dragged.piece.style.pointerEvents = "none";
      if (gesture.lifted) showOver(gesture, event, dx, dy);
    }
  });

  function endGesture(pointerId: number, x: number, y: number, cancelled: boolean): void {
    if (gesture === null || pointerId !== gesture.pointerId) return;
    const { square, dragging, hadFocus } = gesture;
    resetDraggedPiece();
    gesture = null;
    if (view.element.hasPointerCapture(pointerId)) view.element.releasePointerCapture(pointerId);
    if (dragging) {
      const target = cancelled ? null : squareAt(document.elementFromPoint(x, y));
      host.handle(host.interaction().drop(target));
    } else if (!cancelled) {
      host.interaction().focus = square;
      host.handle(host.interaction().click(square));
    }
    // El tablero puede haberse reconstruido: se mira el foco de antes del gesto, no el de ahora.
    if (hadFocus && !host.promotionOpen()) host.focusBoard();
  }

  const end = (event: PointerEvent, cancelled: boolean): void => endGesture(event.pointerId, event.clientX, event.clientY, cancelled);
  view.element.addEventListener("pointerup", (event) => end(event, false));
  view.element.addEventListener("pointercancel", (event) => end(event, true));
  // Si el navegador quita la captura sin pointerup ni pointercancel, el gesto se cancela para no bloquear el tablero.
  view.element.addEventListener("lostpointercapture", (event) => end(event, true));

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
