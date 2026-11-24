// Puente entre la interfaz y el motor: mensajes que entran al Worker y cliente que los envía.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PGN_MAX_PLIES, START_FEN, parsePgn, writePgn } from "../src/core/index.js";
import { handleAnalyze, handleRequest, MAX_MOVES, EngineClient, EngineCancelledError } from "../src/worker/index.js";
import type { EngineResponse, WorkerLike } from "../src/worker/index.js";

const request = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  type: "search",
  id: 1,
  fen: START_FEN,
  moves: [],
  level: "medio",
  ...overrides,
});

const errorOf = (response: EngineResponse): string => {
  assert.equal(response.type, "error");
  return response.type === "error" ? response.message : "";
};

describe("handleRequest()", () => {
  it("responde con la jugada del motor y el mismo id", () => {
    const response = handleRequest(request({ id: 7, moves: ["e2e4", "e7e5"] }));
    assert.equal(response.type, "result");
    if (response.type !== "result") return;
    assert.equal(response.id, 7);
    assert.match(response.best ?? "", /^[a-h][1-8][a-h][1-8][qrbn]?$/);
    assert.ok(response.depth >= 1 && Number.isFinite(response.score));
  });

  it("aplica las jugadas antes de pensar: juega el bando al que le toca", () => {
    const response = handleRequest(request({ moves: ["e2e4"] }));
    assert.equal(response.type, "result");
    if (response.type === "result") assert.match(response.best ?? "", /^[a-h][78]/, "deben mover las negras");
  });

  it("devuelve null como jugada si la partida ha terminado", () => {
    const response = handleRequest(request({ moves: ["f2f3", "e7e5", "g2g4", "d8h4"] }));
    assert.equal(response.type, "result");
    if (response.type === "result") assert.equal(response.best, null);
  });

  it("rechaza mensajes mal formados sin lanzar", () => {
    const cases: Array<[unknown, RegExp]> = [
      [null, /objeto/],
      ["search", /objeto/],
      [[], /objeto/],
      [request({ type: "go" }), /tipo/],
      [request({ id: -1 }), /id/],
      [request({ id: 1.5 }), /id/],
      [request({ id: "1" }), /id/],
      [request({ fen: 3 }), /FEN/],
      [request({ fen: "x".repeat(200) }), /FEN/],
      [request({ fen: "8/8/8/8/8/8/8/8 w - - 0 1" }), /FEN/],
      [request({ moves: "e2e4" }), /jugadas/],
      [request({ moves: ["e2e5"] }), /no es legal/],
      [request({ moves: ["e2e4", 5] }), /jugadas/],
      [request({ moves: ["<script>"] }), /jugadas/],
      [request({ moves: new Array(2001).fill("g1f3") }), /jugadas/],
      [request({ level: "imposible" }), /nivel/],
      [request({ level: "__proto__" }), /nivel/],
    ];
    for (const [data, expected] of cases) assert.match(errorOf(handleRequest(data)), expected, JSON.stringify(data)?.slice(0, 80));
  });

  it("conserva el id en los errores si es válido", () => {
    const response = handleRequest(request({ id: 9, level: "x" }));
    assert.equal(response.type === "error" ? response.id : -1, 9);
    const bad = handleRequest(request({ id: "nueve" }));
    assert.equal(bad.type === "error" ? bad.id : -1, null);
  });

  it("no repite en el mensaje de error textos largos recibidos", () => {
    const message = errorOf(handleRequest(request({ moves: ["a".repeat(5000)] })));
    assert.ok(message.length < 200, `mensaje de ${message.length} caracteres`);
  });
});

/** Worker falso: guarda lo que recibe y deja contestar a mano. */
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

function clientWithFakes(): { client: EngineClient; workers: FakeWorker[] } {
  const workers: FakeWorker[] = [];
  const client = new EngineClient(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker;
  });
  return { client, workers };
}

const result = (id: number, best = "e2e4"): EngineResponse => ({ type: "result", id, best, score: 20, depth: 3, nodes: 100, pv: [best] });

describe("EngineClient", () => {
  it("envía la petición y resuelve con la respuesta del mismo id", async () => {
    const { client, workers } = clientWithFakes();
    const pending = client.think({ fen: START_FEN, moves: ["e2e4"], level: "dificil" });
    const worker = workers[0]!;
    assert.deepEqual(worker.sent[0], { type: "search", id: worker.lastId(), fen: START_FEN, moves: ["e2e4"], level: "dificil" });
    worker.reply(result(worker.lastId(), "e7e5"));
    assert.equal((await pending).best, "e7e5");
  });

  it("ignora respuestas de otro id y respuestas mal formadas", async () => {
    const { client, workers } = clientWithFakes();
    const pending = client.think({ fen: START_FEN, moves: [], level: "medio" });
    const worker = workers[0]!;
    worker.reply(result(worker.lastId() + 100, "a2a3"));
    worker.reply({ type: "result", id: worker.lastId(), best: 42 });
    worker.reply("basura");
    worker.reply(result(worker.lastId(), "d2d4"));
    assert.equal((await pending).best, "d2d4");
  });

  it("rechaza si el motor responde con un error", async () => {
    const { client, workers } = clientWithFakes();
    const pending = client.think({ fen: START_FEN, moves: [], level: "medio" });
    const worker = workers[0]!;
    worker.reply({ type: "error", id: worker.lastId(), message: "FEN no válida" });
    await assert.rejects(pending, /FEN no válida/);
  });

  it("cancelar detiene el Worker y rechaza la petición; la siguiente usa un Worker nuevo", async () => {
    const { client, workers } = clientWithFakes();
    const pending = client.think({ fen: START_FEN, moves: [], level: "dificil" });
    client.cancel();
    await assert.rejects(pending, EngineCancelledError);
    assert.equal(workers[0]!.terminated, true);
    const next = client.think({ fen: START_FEN, moves: [], level: "facil" });
    assert.equal(workers.length, 2);
    workers[1]!.reply(result(workers[1]!.lastId()));
    assert.equal((await next).best, "e2e4");
  });

  it("una petición nueva cancela la que estaba en curso", async () => {
    const { client, workers } = clientWithFakes();
    const first = client.think({ fen: START_FEN, moves: [], level: "dificil" });
    const second = client.think({ fen: START_FEN, moves: ["e2e4"], level: "dificil" });
    await assert.rejects(first, EngineCancelledError);
    workers.at(-1)!.reply(result(workers.at(-1)!.lastId(), "c7c5"));
    assert.equal((await second).best, "c7c5");
  });

  it("si el Worker falla, rechaza y crea otro para la siguiente", async () => {
    const { client, workers } = clientWithFakes();
    const pending = client.think({ fen: START_FEN, moves: [], level: "medio" });
    workers[0]!.onerror?.({ message: "boom" });
    await assert.rejects(pending, /motor/);
    client.think({ fen: START_FEN, moves: [], level: "medio" }).catch(() => {});
    assert.equal(workers.length, 2);
    client.dispose();
  });
});

describe("carreras del cliente del motor (RC-06)", () => {
  it("la respuesta tardía de un Worker ya cancelado no resuelve la petición nueva", async () => {
    const { client, workers } = clientWithFakes();
    const first = client.think({ fen: START_FEN, moves: [], level: "dificil" });
    const staleHandler = workers[0]!.onmessage!;
    const staleId = workers[0]!.lastId();
    const second = client.think({ fen: START_FEN, moves: ["e2e4"], level: "dificil" });
    await assert.rejects(first, EngineCancelledError);
    staleHandler({ data: result(staleId, "a2a3") }); // llega con el Worker viejo ya detenido
    workers[1]!.reply(result(workers[1]!.lastId(), "c7c5"));
    assert.equal((await second).best, "c7c5");
  });

  it("una respuesta repetida no resuelve dos veces ni afecta a la siguiente petición", async () => {
    const { client, workers } = clientWithFakes();
    const first = client.think({ fen: START_FEN, moves: [], level: "medio" });
    const worker = workers[0]!;
    const id = worker.lastId();
    worker.reply(result(id, "d2d4"));
    worker.reply(result(id, "a2a3"));
    assert.equal((await first).best, "d2d4");
    const second = client.think({ fen: START_FEN, moves: ["d2d4"], level: "medio" });
    worker.reply(result(id, "h2h3")); // eco del id anterior
    worker.reply(result(worker.lastId(), "d7d5"));
    assert.equal((await second).best, "d7d5");
  });
});

describe("límite de medias jugadas (RC-06, H-20)", () => {
  /** Partida legal de `plies` medias jugadas: los caballos van y vienen sin que nadie dé mate. */
  const shuffle = (plies: number): string[] => {
    const cycle = ["g1f3", "g8f6", "f3g1", "f6g8"];
    return Array.from({ length: plies }, (_, i) => cycle[i % 4]!);
  };

  it("el Worker admite exactamente lo que admite el importador de PGN", () => {
    assert.equal(MAX_MOVES, PGN_MAX_PLIES);
  });

  it("acepta una partida de 1.001 a 1.200 medias jugadas (antes se rechazaba pasadas 1.000)", () => {
    for (const plies of [1001, PGN_MAX_PLIES]) {
      const response = handleRequest(request({ level: "facil", moves: shuffle(plies) }));
      assert.notEqual(response.type === "error" ? response.message : "", "Lista de jugadas no válida", `${plies} medias jugadas`);
    }
  });

  it("rechaza una media jugada de más", () => {
    assert.match(errorOf(handleRequest(request({ moves: shuffle(PGN_MAX_PLIES + 1) }))), /Lista de jugadas/);
  });

  it("una partida importada de 1.200 medias jugadas llega entera al Worker del motor y al del coach", () => {
    const uci = shuffle(PGN_MAX_PLIES);
    const game = parsePgn(writePgn({ startFen: START_FEN, moves: uci, result: "*" }));
    assert.equal(game.moves.length, PGN_MAX_PLIES);
    const notMoveList = (r: { type: string; message?: string }): string => (r.type === "error" ? (r.message ?? "") : "");
    assert.notEqual(notMoveList(handleRequest(request({ level: "facil", moves: game.moves }))), "Lista de jugadas no válida");
    const coach = handleAnalyze(
      { type: "analyze", id: 1, fen: START_FEN, moves: game.moves.slice(0, -1), move: game.moves.at(-1)! },
      { limits: { maxDepth: 1 } },
    );
    assert.notEqual(notMoveList(coach), "Lista de jugadas no válida");
  });
});
