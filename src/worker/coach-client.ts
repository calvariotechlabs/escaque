// Cliente del Worker del coach, para la interfaz. Una petición cada vez: una
// nueva cancela la anterior. Lo que llega del Worker no es de confianza: se
// comprueba la forma del informe antes de entregarlo.
import type { CoachReport, Finding, Hint } from "../coach/index.js";
import { EngineCancelledError } from "./client.js";
import type { WorkerLike } from "./client.js";

export interface AnalyzeJob {
  /** FEN inicial de la partida y jugadas (UCI) hechas ANTES de la jugada revisada. */
  readonly fen: string;
  readonly moves: readonly string[];
  readonly move: string;
}

/** Partida hasta la posición en la que se pide la pista (CAL-394). */
export interface HintJob {
  readonly fen: string;
  readonly moves: readonly string[];
}

interface Pending {
  readonly id: number;
  readonly kind: "report" | "hint";
  readonly resolve: (value: never) => void;
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
    isText(v["why"]) &&
    isText(v["line"]) &&
    Array.isArray(v["findings"]) &&
    v["findings"].length <= 3 &&
    v["findings"].every(isFinding)
  );
}

/** ¿Tiene la pista la forma que la interfaz necesita? */
export function isHint(v: unknown): v is Hint {
  return (
    isObject(v) &&
    isMove(v["move"]) &&
    isText(v["idea"]) &&
    isText(v["piece"]) &&
    isText(v["play"]) &&
    SQUARE.test(v["from"] as string) &&
    SQUARE.test(v["to"] as string)
  );
}

/**
 * Cliente del Worker del coach. Una petición cada vez por cliente: la interfaz
 * usa uno para revisar jugadas y otro para las pistas, para que pedir una
 * pista no cancele la revisión en curso.
 */
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
      this.pending = { id, kind: "report", resolve: resolve as (value: never) => void, reject };
      worker.postMessage({ type: "analyze", id, fen: job.fen, moves: [...job.moves], move: job.move });
    });
  }

  /** Pide las pistas de la posición en la que toca mover. Cancela la petición anterior si seguía en curso. */
  hint(job: HintJob): Promise<Hint> {
    if (this.pending !== null) this.cancel();
    const worker = this.ensureWorker();
    const id = this.nextId++;
    return new Promise<Hint>((resolve, reject) => {
      this.pending = { id, kind: "hint", resolve: resolve as (value: never) => void, reject };
      worker.postMessage({ type: "hint", id, fen: job.fen, moves: [...job.moves] });
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
    const value = pending.kind === "report" ? data["report"] : data["hint"];
    if (data["type"] === pending.kind && (pending.kind === "report" ? isReport(value) : isHint(value))) {
      this.pending = null;
      pending.resolve(value as never);
    } else if (data["type"] === "error" || data["type"] === pending.kind) {
      this.pending = null;
      pending.reject(new Error(pending.kind === "report" ? "El coach no pudo revisar la jugada" : "El coach no pudo dar la pista"));
    }
  }
}

/** Cliente con el Worker real del navegador. */
export function createCoachClient(): CoachClient {
  return new CoachClient(
    () => new Worker(new URL("./coach-worker.js", import.meta.url), { type: "module", name: "coach" }) as unknown as WorkerLike,
  );
}
