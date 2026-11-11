// Posiciones de referencia para perft.
//
// `counts[i]` es el número de hojas a profundidad i + 1.
//
// Fuentes:
// - Inicial y posiciones 2 a 6: Chess Programming Wiki, «Perft Results»
//   (https://www.chessprogramming.org/Perft_Results).
// - Posiciones «trampa» de Martin Sedlak (TalkChess), recopiladas en varios
//   proyectos de ajedrez: el último valor de cada lista es el publicado; los
//   intermedios se calcularon con una herramienta independiente y se
//   contrastaron con el publicado.
//
// Profundidades:
// - `fast`: la que se ejecuta con `npm test` (pocos segundos en total).
// - `full`: la que se ejecuta con `npm run test:perft` (ESCAQUE_PERFT=completo).

export interface PerftPosition {
  readonly name: string;
  readonly fen: string;
  readonly counts: readonly number[];
  readonly fast: number;
  readonly full: number;
  /** Qué regla pone a prueba, para orientarse cuando falla. */
  readonly checks: string;
}

export const PERFT_POSITIONS: readonly PerftPosition[] = [
  {
    name: "inicial",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    counts: [20, 400, 8_902, 197_281, 4_865_609, 119_060_324],
    fast: 4,
    full: 5,
    checks: "movimiento básico de todas las piezas",
  },
  {
    name: "Kiwipete (posición 2)",
    fen: "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
    counts: [48, 2_039, 97_862, 4_085_603, 193_690_690],
    fast: 3,
    full: 4,
    checks: "enroques, al paso, coronaciones, clavadas",
  },
  {
    name: "posición 3",
    fen: "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",
    counts: [14, 191, 2_812, 43_238, 674_624, 11_030_083],
    fast: 4,
    full: 6,
    checks: "al paso con clavada horizontal, finales de torre y peones",
  },
  {
    name: "posición 4",
    fen: "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1",
    counts: [6, 264, 9_467, 422_333, 15_833_292],
    fast: 3,
    full: 4,
    checks: "coronaciones con captura, enroque con jaque, salir de jaque",
  },
  {
    name: "posición 4 (espejo)",
    fen: "r2q1rk1/pP1p2pp/Q4n2/bbp1p3/Np6/1B3NBn/pPPP1PPP/R3K2R b KQ - 0 1",
    counts: [6, 264, 9_467, 422_333, 15_833_292],
    fast: 3,
    full: 4,
    checks: "lo mismo que la posición 4, con los colores cambiados",
  },
  {
    name: "posición 5",
    fen: "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8",
    counts: [44, 1_486, 62_379, 2_103_487, 89_941_194],
    fast: 3,
    full: 4,
    checks: "coronación con captura que da jaque",
  },
  {
    name: "posición 6",
    fen: "r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10",
    counts: [46, 2_079, 89_890, 3_894_594, 164_075_551],
    fast: 3,
    full: 4,
    checks: "medio juego con muchas piezas y clavadas",
  },
  {
    name: "al paso ilegal por clavada (negras)",
    fen: "3k4/3p4/8/K1P4r/8/8/8/8 b - - 0 1",
    counts: [18, 92, 1_670, 10_138, 185_429, 1_134_888],
    fast: 5,
    full: 6,
    checks: "tras d7d5, cxd6 al paso dejaría al rey de a5 en jaque horizontal",
  },
  {
    name: "al paso ilegal por clavada (blancas)",
    fen: "8/8/4k3/8/2p5/8/B2P2K1/8 w - - 0 1",
    counts: [13, 102, 1_266, 10_276, 135_655, 1_015_133],
    fast: 5,
    full: 6,
    checks: "tras d2d4, cxd3 al paso dejaría al rey en jaque del alfil",
  },
  {
    name: "al paso que da jaque",
    fen: "8/8/1k6/2b5/2pP4/8/5K2/8 b - d3 0 1",
    counts: [15, 126, 1_928, 13_931, 206_379, 1_440_467],
    fast: 5,
    full: 6,
    checks: "captura al paso que descubre jaque al rey contrario",
  },
  {
    name: "enroque corto que da jaque",
    fen: "5k2/8/8/8/8/8/8/4K2R w K - 0 1",
    counts: [15, 66, 1_198, 6_399, 120_330, 661_072],
    fast: 5,
    full: 6,
    checks: "la torre enrocada da jaque",
  },
  {
    name: "enroque largo que da jaque",
    fen: "3k4/8/8/8/8/8/8/R3K3 w Q - 0 1",
    counts: [16, 71, 1_286, 7_418, 141_077, 803_711],
    fast: 5,
    full: 6,
    checks: "la torre enrocada da jaque",
  },
  {
    name: "derechos de enroque",
    fen: "r3k2r/1b4bq/8/8/8/8/7B/R3K2R w KQkq - 0 1",
    counts: [26, 1_141, 27_826, 1_274_206],
    fast: 3,
    full: 4,
    checks: "pérdida de derechos al mover o perder una torre",
  },
  {
    name: "enroque impedido",
    fen: "r3k2r/8/3Q4/8/8/5q2/8/R3K2R b KQkq - 0 1",
    counts: [44, 1_494, 50_509, 1_720_476],
    fast: 3,
    full: 4,
    checks: "no se enroca a través de casillas atacadas",
  },
  {
    name: "coronar para salir de jaque",
    fen: "2K2r2/4P3/8/8/8/8/8/3k4 w - - 0 1",
    counts: [11, 133, 1_442, 19_174, 266_199, 3_821_001],
    fast: 4,
    full: 6,
    checks: "coronación con captura que tapa o elimina el jaque",
  },
  {
    name: "jaque descubierto",
    fen: "8/8/1P2K3/8/2n5/1q6/8/5k2 b - - 0 1",
    counts: [29, 165, 5_160, 31_961, 1_004_658],
    fast: 4,
    full: 5,
    checks: "jaques descubiertos",
  },
  {
    name: "coronar dando jaque",
    fen: "4k3/1P6/8/8/8/8/K7/8 w - - 0 1",
    counts: [9, 40, 472, 2_661, 38_983, 217_342],
    fast: 6,
    full: 6,
    checks: "coronación a dama o torre que da jaque",
  },
  {
    name: "subpromoción dando jaque",
    fen: "8/P1k5/K7/8/8/8/8/8 w - - 0 1",
    counts: [6, 27, 273, 1_329, 18_135, 92_683],
    fast: 6,
    full: 6,
    checks: "coronar a caballo para dar jaque",
  },
  {
    name: "autoahogado",
    fen: "K1k5/8/P7/8/8/8/8/8 w - - 0 1",
    counts: [2, 6, 13, 63, 382, 2_217],
    fast: 6,
    full: 6,
    checks: "posiciones sin jugadas legales sin estar en jaque",
  },
  {
    name: "ahogado y mate (1)",
    fen: "8/k1P5/8/1K6/8/8/8/8 w - - 0 1",
    counts: [10, 25, 268, 926, 10_857, 43_261, 567_584],
    fast: 6,
    full: 7,
    checks: "coronaciones que ahogan o dan mate",
  },
  {
    name: "ahogado y mate (2)",
    fen: "8/8/2k5/5q2/5n2/8/5K2/8 b - - 0 1",
    counts: [37, 183, 6_559, 23_527],
    fast: 4,
    full: 4,
    checks: "mates y ahogados con dama y caballo",
  },
];
