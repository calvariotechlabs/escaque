// Punto de entrada del Worker del coach (módulo ES). Va aparte del Worker del
// motor para que revisar tu jugada no retrase la respuesta de la máquina.
import { handleAnalyze } from "./coach-protocol.js";

interface WorkerScope {
  onmessage: ((event: { data: unknown }) => void) | null;
  postMessage(message: unknown): void;
}

const scope = self as unknown as WorkerScope;
scope.onmessage = (event) => {
  scope.postMessage(handleAnalyze(event.data));
};
