// Cliente del Worker del motor, para la interfaz. Manda una petición cada vez:
// una nueva cancela la anterior. Cancelar detiene el Worker (un Worker que
// está pensando no atiende mensajes) y el siguiente `think` crea otro.
import type { SearchResult, Level } from "../engine/index.js";

/** Lo que el cliente necesita de un Worker; en los tests se usa uno falso. */
export interface WorkerLike {
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  postMessage(message: unknown): void;
  terminate(): void;
}

export interface ThinkRequest {
  /** FEN de la posición inicial de la partida. */
  readonly fen: string;
  /** Jugadas hechas desde ella, en UCI. */
  readonly moves: readonly string[];
  readonly level: Level;
}

/** La petición se canceló (con `cancel()` o porque llegó otra). */
export class EngineCancelledError extends Error {
  constructor() {
    super("Se canceló la búsqueda del motor");
    this.name = "EngineCancelledError";
  }
}

interface Pending {
  readonly id: number;
  readonly resolve: (result: SearchResult) => void;
  readonly reject: (error: Error) => void;
}

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((v) => typeof v === "string");

/** ¿Es una respuesta de resultado bien formada? */
function isResult(data: Record<string, unknown>): boolean {
  return (
    (data.best === null || typeof data.best === "string") &&
    typeof data.score === "number" &&
    typeof data.depth === "number" &&
    typeof data.nodes === "number" &&
    isStringArray(data.pv)
  );
}

export class EngineClient {
  private worker: WorkerLike | null = null;
  private pending: Pending | null = null;
  private nextId = 1;

  constructor(private readonly createWorker: () => WorkerLike) {}

  /** Pide la jugada del motor. Cancela la petición anterior si aún no había terminado. */
  think(request: ThinkRequest): Promise<SearchResult> {
    if (this.pending !== null) this.cancel();
    const worker = this.ensureWorker();
    const id = this.nextId++;
    return new Promise<SearchResult>((resolve, reject) => {
      this.pending = { id, resolve, reject };
      worker.postMessage({ type: "search", id, fen: request.fen, moves: [...request.moves], level: request.level });
    });
  }

  /** Detiene la búsqueda en curso, si la hay. */
  cancel(): void {
    const pending = this.pending;
    this.stopWorker();
    if (pending !== null) pending.reject(new EngineCancelledError());
  }

  /** Libera el Worker. Se puede seguir usando: el siguiente `think` crea otro. */
  dispose(): void {
    this.cancel();
  }

  private ensureWorker(): WorkerLike {
    if (this.worker !== null) return this.worker;
    const worker = this.createWorker();
    worker.onmessage = (event) => this.receive(event.data);
    worker.onerror = () => {
      const pending = this.pending;
      this.stopWorker();
      pending?.reject(new Error("El motor ha fallado"));
    };
    this.worker = worker;
    return worker;
  }

  private stopWorker(): void {
    this.pending = null;
    if (this.worker === null) return;
    this.worker.onmessage = null;
    this.worker.onerror = null;
    this.worker.terminate();
    this.worker = null;
  }

  private receive(data: unknown): void {
    const pending = this.pending;
    if (pending === null || typeof data !== "object" || data === null) return;
    const message = data as Record<string, unknown>;
    if (message.id !== pending.id) return; // respuesta de una petición ya cancelada
    if (message.type === "result" && isResult(message)) {
      this.pending = null;
      pending.resolve({
        best: message.best as string | null,
        score: message.score as number,
        depth: message.depth as number,
        nodes: message.nodes as number,
        pv: message.pv as string[],
      });
    } else if (message.type === "error" && typeof message.message === "string") {
      this.pending = null;
      pending.reject(new Error(`El motor no pudo pensar: ${message.message}`));
    }
  }
}

/** Cliente con el Worker real del navegador (módulo ES servido junto a este fichero). */
export function createEngineClient(): EngineClient {
  return new EngineClient(
    () => new Worker(new URL("./engine-worker.js", import.meta.url), { type: "module", name: "alfil-beta" }) as unknown as WorkerLike,
  );
}
