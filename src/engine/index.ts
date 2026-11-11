// Alfil Beta: motor de ajedrez propio. No depende de la interfaz y funciona
// igual en Node y en el navegador.
export { evaluate, PIECE_VALUES } from "./evaluate.js";
export { search, scoreMoves, MATE_SCORE, MAX_DEPTH } from "./search.js";
export type { SearchLimits, SearchOptions, SearchResult, ScoredMove } from "./search.js";
export { TranspositionTable } from "./transposition.js";
export { LEVELS, chooseMove, isLevel } from "./levels.js";
export type { Level, LevelSettings, ChooseOptions } from "./levels.js";
