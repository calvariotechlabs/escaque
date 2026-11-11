// Posiciones de la página de demostración.
import { START_FEN } from "../core/index.js";
import type { Mark } from "./board.js";

export interface DemoPosition {
  readonly name: string;
  readonly fen: string;
  /** Marcas de ejemplo para enseñar el diseño de casillas. */
  readonly marks: ReadonlyArray<readonly [string, Mark]>;
}

export const POSITIONS: readonly DemoPosition[] = [
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
