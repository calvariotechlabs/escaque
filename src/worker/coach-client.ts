// Cliente del Worker del coach, para la interfaz. Una petición cada vez: una
// nueva cancela la anterior. Lo que llega del Worker no es de confianza: se
// comprueba la forma del informe antes de entregarlo.
import type { CoachReport, Finding } from "../coach/index.js";
import { EngineCancelledError } from "./client.js";
import type { WorkerLike } from "./client.js";

export interface AnalyzeJob {
  /** FEN inicial de la partida y jugadas (UCI) hechas ANTES de la jugada revisada. */
  readonly fen: string;
  readonly moves: readonly string[];
  readonly move: string;
}

interface Pending {
  readonly id: number;
  readonly resolve: (report: CoachReport) => void;
  readonly reject: (error: Error) => void;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === "string" && v.length <= 2000;
const isColor = (v: unknown): boolean => v === "w" || v === "b";
const VERDICTS = ["mejor", "buena", "imprecision", "error", "error-grave"];
const KINDS = ["mate-en-1", "pieza-colgando", "captura-gratis"];
const SQUARE = /^[a-h][1-8]$/;

const isMove = (v: unknown): boolean => isObject(v) && isText(v["uci"]) && isText(v["san"]);

function isEvaluation(v: unknown): boolean {
  if (!isObject(v) || typeof v["cp"] !== "number" || !isText(v["text"])) return false;
  const mate = v["mate"];
  return mate === null || (isObject(mate) && isColor(mate["winner"]) && typeof mate["moves"] === "number");
}

function isFinding(v: unknown): v is Finding {
  if (!isObject(v) || !KINDS.includes(v["kind"] as string)) return false;
  if (!isText(v["title"]) || !isText(v["message"]) || !isText(v["label"])) return false;
  if (!isMove(v["kind"] === "mate-en-1" ? v["move"] : v["capture"])) return false;
  const marks = v["marks"];
  return (
    Array.isArray(marks) &&
    marks.length <= 8 &&
    marks.every((m) => isObject(m) && SQUARE.test(m["square"] as string) && (m["mark"] === "selected" || m["mark"] === "capture"))
  );
}

/** ¿Tiene el informe la forma que la interfaz necesita para pintarlo? */
export function isReport(v: unknown): v is CoachReport {
  return (
    isObject(v) &&
    isColor(v["color"]) &&
    isMove(v["move"]) &&
    isMove(v["best"]) &&
    isEvaluation(v["before"]) &&
    isEvaluation(v["after"]) &&
    VERDICTS.includes(v["verdict"] as string) &&
    isText(v["title"]) &&
    isText(v["summary"]) &&
    Array.isArray(v["findings"]) &&
    v["findings"].length <= 3 &&
    v["findings"].every(isFinding)
  );
}

export class CoachClient {
  private worker: WorkerLike | null = null;
  private pending: Pending | null = null;
  private nextId = 1;

  constructor(private readonly createWorker: () => WorkerLike) {}

  /** Pide revisar una jugada. Cancela la petición anterior si seguía en curso. */
  analyze(job: AnalyzeJob): Promise<CoachReport> {
    if (this.pending !== null) this.cancel();
    const worker = this.ensureWorker();
    const id = this.nextId++;
    return new Promise<CoachReport>((resolve, reject) => {
      this.pending = { id, resolve, reject };
      worker.postMessage({ type: "analyze", id, fen: job.fen, moves: [...job.moves], move: job.move });
    });
  }

  /** Detiene la revisión en curso, si la hay. */
  cancel(): void {
    const pending = this.pending;
    if (pending === null) return; // sin petición en curso el Worker se queda para la siguiente
    this.stopWorker();
    pending.reject(new EngineCancelledError());
  }

  private ensureWorker(): WorkerLike {
    if (this.worker !== null) return this.worker;
    const worker = this.createWorker();
    worker.onmessage = (event) => this.receive(event.data);
    worker.onerror = () => {
      const pending = this.pending;
      this.stopWorker();
      pending?.reject(new Error("El coach ha fallado"));
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
    if (pending === null || !isObject(data) || data["id"] !== pending.id) return;
    if (data["type"] === "report" && isReport(data["report"])) {
      this.pending = null;
      pending.resolve(data["report"]);
    } else if (data["type"] === "error" || data["type"] === "report") {
      this.pending = null;
      pending.reject(new Error("El coach no pudo revisar la jugada"));
    }
  }
}

/** Cliente con el Worker real del navegador. */
export function createCoachClient(): CoachClient {
  return new CoachClient(
    () => new Worker(new URL("./coach-worker.js", import.meta.url), { type: "module", name: "coach" }) as unknown as WorkerLike,
  );
}
