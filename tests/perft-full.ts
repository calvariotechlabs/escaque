// Perft a profundidad completa (unos 43 millones de nodos). No lo recoge `npm test`
// (no acaba en .test.ts); se ejecuta con `npm run test:perft`.
import { definePerftSuite } from "./perft-suite.js";

definePerftSuite("full");
