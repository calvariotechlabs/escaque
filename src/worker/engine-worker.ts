// Punto de entrada del Worker del motor (módulo ES). Recibe peticiones,
// piensa con Alfil Beta y contesta. La tabla de transposición se reserva una
// vez y se vacía en cada petición: guarda puntuaciones que dependen del camino
// (una repetición vale 0), así que no debe pasar de una partida a otra.
import { TranspositionTable } from "../engine/index.js";
import { handleRequest } from "./protocol.js";

interface WorkerScope {
  onmessage: ((event: { data: unknown }) => void) | null;
  postMessage(message: unknown): void;
}

const scope = self as unknown as WorkerScope;
const table = new TranspositionTable();
scope.onmessage = (event) => {
  table.clear();
  scope.postMessage(handleRequest(event.data, { table }));
};
