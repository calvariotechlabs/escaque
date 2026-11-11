// Página de demostración del tablero estático: elige una posición y gira el tablero.
// La carga el navegador como módulo ES nativo (sin bundler) desde index.html.
import { FenError, Position, START_FEN } from "../core/index.js";
import type { Color, GameStatus } from "../core/index.js";
import { createBoard } from "./board.js";
import type { Mark } from "./board.js";

interface DemoPosition {
  readonly name: string;
  readonly fen: string;
  /** Marcas de ejemplo para enseñar el diseño de casillas. */
  readonly marks: ReadonlyArray<readonly [string, Mark]>;
}

const POSITIONS: readonly DemoPosition[] = [
  {
    name: "Posición inicial",
    fen: START_FEN,
    marks: [["e2", "selected"], ["e3", "target"], ["e4", "target"]],
  },
  {
    name: "Apertura italiana",
    fen: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
    marks: [["f3", "selected"], ["d4", "target"], ["g5", "target"], ["h4", "target"], ["g1", "target"], ["e5", "capture"], ["f8", "last-move"], ["c5", "last-move"]],
  },
  {
    name: "Kiwipete (posición de prueba de perft)",
    fen: "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
    marks: [],
  },
  {
    name: "Mate del pastor",
    fen: "r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4",
    marks: [["e8", "check"], ["f7", "last-move"], ["h5", "last-move"]],
  },
  {
    name: "Final de peones",
    fen: "8/8/8/4k3/8/4K3/4P3/8 w - - 0 1",
    marks: [],
  },
];

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
