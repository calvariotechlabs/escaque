// Pantalla de partida a dos jugadores en el mismo dispositivo.
// Traduce clics, arrastres y teclas a llamadas de `Interaction` y pinta el
// resultado con `BoardView`. Todo el texto se escribe con textContent o
// atributos, nunca como HTML. La carga el navegador como módulo ES nativo.
import type { PromotionPiece } from "../core/index.js";
import { createBoard } from "./board.js";
import { Game } from "./game.js";
import { Interaction, type Outcome } from "./interaction.js";
import { moveAnnouncement, sanToSpanish, statusMessage } from "./notation.js";
import { pieceSvg } from "./pieces.js";
import { startPwa } from "../pwa/pwa.js";

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Falta el elemento #${id}`);
  return el as T;
}

const statusBox = byId<HTMLParagraphElement>("estado");
const statusTurn = byId<HTMLSpanElement>("estado-turno");
const statusText = byId<HTMLElement>("estado-texto");
const statusExtra = byId<HTMLSpanElement>("estado-extra");
const newGameButton = byId<HTMLButtonElement>("nueva");
const rotateButton = byId<HTMLButtonElement>("girar");
const undoButton = byId<HTMLButtonElement>("deshacer");
const moveList = byId<HTMLOListElement>("lista-jugadas");
const noMoves = byId<HTMLParagraphElement>("sin-jugadas");
const announcer = byId<HTMLParagraphElement>("anuncio");
const promotionDialog = byId<HTMLDialogElement>("coronacion");
const promotionOptions = byId<HTMLDivElement>("opciones-coronacion");
const view = createBoard(byId("tablero"));

let game = new Game();
let ui = new Interaction(game);

const PROMOTIONS: ReadonlyArray<readonly [PromotionPiece, string]> = [
  ["q", "Dama"],
  ["r", "Torre"],
  ["b", "Alfil"],
  ["n", "Caballo"],
];

// --- Pintar ------------------------------------------------------------------

function render(): void {
  view.setOrientation(ui.orientation);
  view.setPosition(game.fen);
  view.setMarks(ui.marks());
  syncTabIndex();
  renderStatus();
  renderMoveList();
  undoButton.disabled = game.ply === 0;
}

/** Tabindex itinerante: solo la casilla con el foco entra en el orden de tabulación. */
function syncTabIndex(): void {
  for (const cell of view.element.querySelectorAll<HTMLElement>("[data-square]")) {
    cell.tabIndex = cell.dataset["square"] === ui.focus ? 0 : -1;
  }
}

function renderStatus(): void {
  statusTurn.className = `estado__turno estado__turno--${game.turn}`;
  statusText.textContent = statusMessage(game.status, game.turn, game.inCheck);
  statusExtra.textContent = ui.pendingPromotion !== null ? " Elige la pieza para coronar." : "";
  statusBox.classList.toggle("estado--fin", game.isOver);
}

function moveButton(entry: { readonly san: string; readonly ply: number }, label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "jugada";
  button.textContent = entry.san;
  button.dataset["ply"] = String(entry.ply);
  button.setAttribute("aria-label", `${label}: ${entry.san}`);
  if (entry.ply === game.ply) button.setAttribute("aria-current", "true");
  return button;
}

function renderMoveList(): void {
  const rows = game.moveList();
  noMoves.hidden = rows.length > 0;
  moveList.hidden = rows.length === 0; // sin «lista vacía» para los lectores de pantalla
  const items = rows.map((row) => {
    const item = document.createElement("li");
    // El diseño pone display:contents en los li, y algunos lectores pierden entonces el rol de elemento de lista.
    item.setAttribute("role", "listitem");
    const number = document.createElement("span");
    number.className = "jugadas__n";
    number.textContent = `${row.number}.`;
    item.append(number);
    if (row.white !== null) item.append(moveButton(row.white, `${row.number}, blancas`));
    else {
      // Partida que empieza con las negras: hueco en la columna de las blancas.
      const gap = document.createElement("span");
      gap.setAttribute("aria-hidden", "true");
      gap.textContent = "…";
      item.append(gap);
    }
    if (row.black !== null) item.append(moveButton(row.black, `${row.number}, negras`));
    return item;
  });
  moveList.replaceChildren(...items);
}

function focusBoard(): void {
  view.squareElement(ui.focus).focus({ preventScroll: true });
}

function announce(text: string): void {
  announcer.textContent = text;
}

// --- Resultados --------------------------------------------------------------

function handle(outcome: Outcome): void {
  switch (outcome.kind) {
    case "focus":
      // Solo se mueve el foco: no hace falta repintar nada más.
      syncTabIndex();
      return;
    case "moved":
      ui.focus = outcome.record.to;
      announce(moveAnnouncement(outcome.record));
      break;
    case "undone":
      announce(`Jugada deshecha: ${sanToSpanish(outcome.record.san)}.`);
      break;
    case "redone":
      announce(moveAnnouncement(outcome.record));
      break;
    case "jumped": {
      const last = game.history[game.ply - 1];
      announce(last === undefined ? "Posición inicial." : `Posición tras ${sanToSpanish(last.san)}.`);
      break;
    }
    case "promotion":
      render();
      openPromotion();
      return;
    default:
      break;
  }
  render();
}

// --- Coronación ----------------------------------------------------------------

function openPromotion(): void {
  const color = game.turn;
  const buttons = PROMOTIONS.map(([piece, name]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "coronacion__opcion";
    button.dataset["piece"] = piece;
    const svg = pieceSvg(color, piece);
    svg.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = name;
    button.append(svg, label);
    return button;
  });
  promotionOptions.replaceChildren(...buttons);
  promotionDialog.showModal();
  buttons[0]!.focus();
}

function closePromotion(action: () => Outcome): void {
  const origin = ui.pendingPromotion?.from;
  const outcome = action();
  if (promotionDialog.open) promotionDialog.close();
  if (outcome.kind === "deselected" && origin !== undefined) ui.focus = origin;
  handle(outcome);
  focusBoard();
}

promotionOptions.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>("[data-piece]");
  if (button === null) return;
  closePromotion(() => ui.choosePromotion(button.dataset["piece"] as PromotionPiece));
});

// Escape cierra el diálogo y cancela la jugada; el foco vuelve a la casilla de origen.
promotionDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closePromotion(() => ui.cancel());
});

// --- Tablero: clic, arrastre y teclado -----------------------------------------

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

let gesture: Gesture | null = null;

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
  if (event.button !== 0 || gesture !== null) return;
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
    if (!ui.dragStart(gesture.square)) {
      gesture.tapOnly = true;
      return;
    }
    gesture.dragging = true;
    ui.focus = gesture.square;
    render();
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
    handle(ui.drop(target));
  } else if (!cancelled) {
    ui.focus = square;
    handle(ui.click(square));
  }
  // El tablero puede haberse reconstruido: se mira el foco de antes del gesto, no el de ahora.
  if (hadFocus && !promotionDialog.open) focusBoard();
}

view.element.addEventListener("pointerup", (event) => endGesture(event, false));
view.element.addEventListener("pointercancel", (event) => endGesture(event, true));
// Si el navegador quita la captura sin pointerup ni pointercancel, el gesto se cancela para no bloquear el tablero.
view.element.addEventListener("lostpointercapture", (event) => endGesture(event, true));

view.element.addEventListener("keydown", (event) => {
  if (squareAt(event.target) === null || event.altKey || event.ctrlKey || event.metaKey) return;
  const outcome = ui.key(event.key);
  if (outcome.kind === "none") return;
  event.preventDefault();
  handle(outcome);
  if (!promotionDialog.open) focusBoard();
});

// Si el foco entra en el tablero por otra casilla (clic de ratón, lector de pantalla), la seguimos.
view.element.addEventListener("focusin", (event) => {
  const square = squareAt(event.target);
  if (square !== null && square !== ui.focus) {
    ui.focus = square;
    syncTabIndex();
  }
});

// --- Lista de jugadas y botones -------------------------------------------------

moveList.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>("[data-ply]");
  if (button === null) return;
  handle(ui.goTo(Number(button.dataset["ply"])));
  moveList.querySelector<HTMLButtonElement>(`[data-ply="${game.ply}"]`)?.focus();
});

newGameButton.addEventListener("click", () => {
  const orientation = ui.orientation;
  game = new Game();
  ui = new Interaction(game);
  ui.orientation = orientation;
  announce("Nueva partida.");
  render();
});

rotateButton.addEventListener("click", () => {
  ui.orientation = ui.orientation === "w" ? "b" : "w";
  announce(`Tablero visto desde las ${ui.orientation === "w" ? "blancas" : "negras"}.`);
  render();
});

undoButton.addEventListener("click", () => {
  handle(ui.undo());
  if (undoButton.disabled) newGameButton.focus();
});

render();

// App instalable: service worker y avisos de instalar, sin conexión y versión nueva.
startPwa(byId("avisos"));
