// Coach: explica por qué una jugada fue buena o mala. Usa Alfil Beta y el
// núcleo de reglas; no depende de la interfaz y funciona igual en Node y en el
// navegador. Devuelve datos y textos en español para que la interfaz los pinte.
export { analyzeMove, hintFor, toEvaluation, CoachError, COACH_LIMITS } from "./analyze.js";
export { explainMove, lineText, refutationOf } from "./explain.js";
export { checkInvariants } from "./invariants.js";
export type { Hint, Motive, MotiveKind, Refutation } from "./explain.js";
export type { AnalyzeOptions, Category, CoachGame, CoachReport, Evaluation, Finding, MoveInfo, RefutationLine, SquareMark, Verdict } from "./analyze.js";
export { exchangeGain, moveBalance } from "./exchange.js";
export { spanishSan } from "./text.js";
