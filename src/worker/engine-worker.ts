// Punto de entrada del Worker del motor (módulo ES). Recibe peticiones,
// piensa con Alfil Beta y contesta. La tabla de transposición se conserva
// entre peticiones: las jugadas de una misma partida se aprovechan de ella.
import { TranspositionTable } from "../engine/index.js";
import { handleRequest } from "./protocol.js";

interface WorkerScope {
  onmessage: ((event: { data: unknown }) => void) | null;
  postMessage(message: unknown): void;
}

const scope = self as unknown as WorkerScope;
const table = new TranspositionTable();
scope.onmessage = (event) => scope.postMessage(handleRequest(event.data, { table }));
