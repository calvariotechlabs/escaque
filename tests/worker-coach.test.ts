// Worker del coach: mensajes que entran y cliente que los envía.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { START_FEN } from "../src/core/index.js";
import { analyzeMove } from "../src/coach/index.js";
import { CoachClient, EngineCancelledError, handleAnalyze, isReport } from "../src/worker/index.js";
import type { CoachResponse, WorkerLike } from "../src/worker/index.js";

const request = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  type: "analyze",
  id: 1,
  fen: START_FEN,
  moves: ["e2e4"],
  move: "e7e5",
  ...overrides,
});

const errorOf = (response: CoachResponse): string => {
  assert.equal(response.type, "error");
  return response.type === "error" ? response.message : "";
};

const OPTIONS = { limits: { maxDepth: 2 } } as const;

describe("handleAnalyze()", () => {
  it("responde con el informe y el mismo id", () => {
    const response = handleAnalyze(request({ id: 5 }), OPTIONS);
    assert.equal(response.type, "report");
    if (response.type !== "report") return;
    assert.equal(response.id, 5);
    assert.equal(response.report.move.uci, "e7e5");
    assert.ok(isReport(response.report));
  });

  it("rechaza mensajes mal formados sin lanzar ni repetir textos largos", () => {
    const cases: Array<[unknown, RegExp]> = [
      [null, /objeto/],
      [[], /objeto/],
      [request({ type: "search" }), /tipo/],
      [request({ id: -1 }), /id/],
      [request({ fen: 3 }), /FEN/],
      [request({ fen: "x".repeat(300) }), /FEN/],
      [request({ moves: "e2e4" }), /jugadas/],
      [request({ moves: ["<script>"] }), /jugadas/],
      [request({ moves: new Array(2001).fill("g1f3") }), /jugadas/],
      [request({ move: 7 }), /Jugada/],
      [request({ move: "e7e5q!" }), /Jugada/],
    ];
    for (const [data, expected] of cases) {
      const message = errorOf(handleAnalyze(data));
      assert.match(message, expected, JSON.stringify(data)?.slice(0, 60));
      assert.ok(message.length < 100);
    }
  });

  it("dice que no puede analizar una jugada ilegal, una FEN inválida o una partida terminada", () => {
    assert.match(errorOf(handleAnalyze(request({ move: "e7e3" }))), /No se puede analizar/);
    assert.match(errorOf(handleAnalyze(request({ fen: "8/8/8/8/8/8/8/8 w - - 0 1" }))), /No se puede analizar/);
    assert.match(errorOf(handleAnalyze(request({ moves: ["f2f3", "e7e5", "g2g4", "d8h4"], move: "a2a3" }))), /No se puede analizar/);
  });

  it("conserva el id válido en los errores", () => {
    assert.equal((handleAnalyze(request({ id: 9, move: "zz" })) as { id: number | null }).id, 9);
    assert.equal((handleAnalyze(request({ id: "9" })) as { id: number | null }).id, null);
  });
});

class FakeWorker implements WorkerLike {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  readonly sent: unknown[] = [];
  terminated = false;
  postMessage(message: unknown): void {
    this.sent.push(message);
  }
  terminate(): void {
    this.terminated = true;
  }
  reply(data: unknown): void {
    this.onmessage?.({ data });
  }
  lastId(): number {
    return (this.sent.at(-1) as { id: number }).id;
  }
}

function clientWithFakes(): { client: CoachClient; workers: FakeWorker[] } {
  const workers: FakeWorker[] = [];
  const client = new CoachClient(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker;
  });
  return { client, workers };
}

const JOB = { fen: START_FEN, moves: ["e2e4"], move: "e7e5" };
const report = analyzeMove({ fen: START_FEN, moves: ["e2e4"] }, "e7e5", OPTIONS);

describe("isReport()", () => {
  it("exige el campo que corresponde a cada tipo de aviso", () => {
    const mate = { kind: "mate-en-1", title: "t", message: "m", label: "l", marks: [], move: { uci: "d1f7", san: "Qxf7#" } };
    const ok = { ...report, findings: [mate] };
    assert.ok(isReport(ok));
    const { move: _move, ...withoutMove } = mate;
    assert.equal(isReport({ ...report, findings: [{ ...withoutMove, capture: { uci: "d1f7", san: "Qxf7#" } }] }), false);
  });
});

describe("CoachClient", () => {
  it("cancel() sin petición en curso no detiene el Worker", () => {
    const { client, workers } = clientWithFakes();
    void client.analyze(JOB);
    workers[0]!.reply({ type: "report", id: workers[0]!.lastId(), report });
    client.cancel();
    assert.equal(workers[0]!.terminated, false);
  });

  it("envía la petición y resuelve con el informe del mismo id", async () => {
    const { client, workers } = clientWithFakes();
    const pending = client.analyze(JOB);
    const worker = workers[0]!;
    assert.deepEqual(worker.sent[0], { type: "analyze", id: worker.lastId(), ...JOB });
    worker.reply({ type: "report", id: worker.lastId() + 50, report });
    worker.reply({ type: "report", id: worker.lastId(), report });
    assert.equal((await pending).move.uci, "e7e5");
  });

  it("rechaza informes que no tienen la forma esperada y errores del Worker", async () => {
    const { client, workers } = clientWithFakes();
    const bad = client.analyze(JOB);
    workers[0]!.reply({ type: "report", id: workers[0]!.lastId(), report: { ...report, verdict: "genial" } });
    await assert.rejects(bad, /no pudo/);
    const failed = client.analyze(JOB);
    workers[0]!.reply({ type: "error", id: workers[0]!.lastId(), message: "x" });
    await assert.rejects(failed, /no pudo/);
  });

  it("una petición nueva cancela la anterior y detiene su Worker", async () => {
    const { client, workers } = clientWithFakes();
    const first = client.analyze(JOB);
    const second = client.analyze({ ...JOB, move: "c7c5" });
    await assert.rejects(first, EngineCancelledError);
    assert.equal(workers[0]!.terminated, true);
    assert.equal(workers.length, 2);
    workers[1]!.reply({ type: "report", id: workers[1]!.lastId(), report });
    await second;
  });

  it("cancel() rechaza la petición en curso y un fallo del Worker también", async () => {
    const { client, workers } = clientWithFakes();
    const pending = client.analyze(JOB);
    client.cancel();
    await assert.rejects(pending, EngineCancelledError);
    const crashed = client.analyze(JOB);
    workers[1]!.onerror?.({});
    await assert.rejects(crashed, /ha fallado/);
  });
});
