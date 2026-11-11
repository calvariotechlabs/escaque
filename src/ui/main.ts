// Página de demostración del tablero estático: elige una posición y gira el tablero.
// La carga el navegador como módulo ES nativo (sin bundler) desde index.html.
import { FenError, Position } from "../core/index.js";
import type { Color, GameStatus } from "../core/index.js";
import { createBoard } from "./board.js";
import type { Mark } from "./board.js";
import { POSITIONS } from "./demo-positions.js";

/** Texto de estado en español, igual que los del diseño (componente GameStatus). */
function statusText(position: Position): string {
  const status: GameStatus = position.status();
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
    case "ongoing": {
      const who = position.turn === "w" ? "las blancas" : "las negras";
      return position.isCheck() ? `Juegan ${who}. Jaque.` : `Juegan ${who}.`;
    }
  }
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Falta el elemento #${id}`);
  return el as T;
}

const select = byId<HTMLSelectElement>("posicion");
const rotate = byId<HTMLButtonElement>("girar");
const showMarks = byId<HTMLInputElement>("marcas");
const status = byId<HTMLParagraphElement>("estado");
const view = createBoard(byId("tablero"));

let orientation: Color = "w";

POSITIONS.forEach((p, i) => {
  const option = document.createElement("option");
  option.value = String(i);
  option.textContent = p.name;
  select.append(option);
});

function render(): void {
  const item = POSITIONS[Number(select.value)] ?? POSITIONS[0]!;
  try {
    const position = Position.fromFen(item.fen);
    view.setOrientation(orientation);
    view.setPosition(item.fen);
    const marks = new Map<string, Mark[]>();
    if (showMarks.checked) {
      for (const [square, mark] of item.marks) marks.set(square, [...(marks.get(square) ?? []), mark]);
    }
    view.setMarks(marks);
    status.textContent = statusText(position);
  } catch (error) {
    status.textContent = error instanceof FenError ? `Posición no válida: ${error.message}` : "No se pudo pintar la posición.";
  }
}

select.addEventListener("change", render);
showMarks.addEventListener("change", render);
rotate.addEventListener("click", () => {
  orientation = orientation === "w" ? "b" : "w";
  render();
});
render();
