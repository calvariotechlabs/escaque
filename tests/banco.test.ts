// Banco de posiciones de referencia (RC-04): datos válidos, referencia completa y métricas.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { CoachReport, Evaluation } from "../src/coach/index.js";
import {
  CATEGORIAS,
  calidad,
  capturasDe,
  invariantes,
  resumirCoach,
  resumirMotor,
  semilla,
  validarBanco,
  valorCp,
} from "../tools/banco-core.js";
import type { PosicionBanco, PosicionReferencia, Referencia, ResultadoCoach, ResultadoMotor } from "../tools/banco-core.js";
import { nodeProcess } from "../tools/node.js";

const fs = nodeProcess().getBuiltinModule("node:fs");
const banco = JSON.parse(fs.readFileSync("bench/posiciones.json", "utf8")) as PosicionBanco[];
const referencia = JSON.parse(fs.readFileSync("bench/referencia-stockfish.json", "utf8")) as Referencia;

describe("bench/posiciones.json y bench/referencia-stockfish.json", () => {
  it("son válidos: FEN canónicas, jugadas legales con su SAN y todas las jugadas legales valoradas", () => {
    assert.deepEqual(validarBanco(banco, referencia), []);
  });

  it("cubren todas las categorías del encargo con al menos 3 posiciones cada una", () => {
    assert.ok(banco.length >= 60, `${banco.length} posiciones`);
    for (const categoria of CATEGORIAS) {
      const n = banco.filter((p) => p.categoria === categoria).length;
      assert.ok(n >= 3, `${categoria}: ${n}`);
    }
  });

  it("incluyen las posiciones de las dos auditorías que se reprodujeron", () => {
    const hallazgos = new Set(banco.map((p) => p.hallazgo).filter(Boolean));
    for (const h of ["H-01", "H-02", "H-02b", "H-03", "H-04", "H-05", "H-06", "H-07", "H-08", "H-09", "H-10", "H-14"]) {
      assert.ok(hallazgos.has(h), h);
    }
  });

  it("registran cómo se calculó la referencia (motor, hilos, tabla, nodos y fecha)", () => {
    const m = referencia.metodologia;
    assert.match(String(m["motor"]), /^Stockfish /);
    assert.equal(m["hilos"], 1);
    assert.equal(m["tablaVaciadaPorPosicion"], true);
    assert.ok(Number(m["nodosPorPosicion"]) >= 1_000_000);
    assert.match(String(m["sha256"]), /^[0-9a-f]{64}$/);
    assert.match(String(m["fecha"]), /^\d{4}-\d{2}-\d{2}$/);
  });

  it("las posiciones de mate inmediato tienen de verdad un mate en 1 según la referencia", () => {
    for (const p of banco.filter((x) => x.categoria === "mate-inmediato")) {
      assert.equal(referencia.posiciones[p.id]!.jugadas[0]!.mate, 1, p.id);
    }
  });
});

// --- Datos sintéticos para las métricas ------------------------------------------------

const ref = (jugadas: PosicionReferencia["jugadas"]): PosicionReferencia => ({ fen: "x", mejor: jugadas[0]!.uci, jugadas });
const j = (uci: string, valor: number | { mate: number }) =>
  typeof valor === "number" ? { uci, cp: valor, profundidad: 20, pv: [uci] } : { uci, mate: valor.mate, profundidad: 20, pv: [uci] };

describe("valorCp() y calidad()", () => {
  it("los mates valen ±(10 000 − N): el más corto es mejor", () => {
    assert.equal(valorCp(j("a", { mate: 1 })), 9_999);
    assert.equal(valorCp(j("a", { mate: 3 })), 9_997);
    assert.equal(valorCp(j("a", { mate: -2 })), -9_998);
    assert.equal(valorCp(j("a", 35)), 35);
  });

  it("dentro de 30 cp es equivalente y cuenta como «mejor»", () => {
    const r = ref([j("e2e4", 32), j("d2d4", 26), j("g2g4", -100)]);
    const d4 = calidad(r, "d2d4");
    assert.equal(d4.equivalente, true);
    assert.equal(d4.veredicto, "mejor");
    assert.equal(d4.mejor, false);
    assert.equal(d4.puesto, 2);
    assert.equal(calidad(r, "e2e4").mejor, true);
    assert.equal(calidad(r, "g2g4").equivalente, false);
  });

  it("usa la misma curva y umbrales que el coach para el veredicto", () => {
    // Desde la igualdad: −40 cp es una caída de 0,037; −60, de 0,055; −120, de 0,109; −400, de 0,31.
    const r = ref([j("a", 0), j("e", -40), j("b", -60), j("c", -120), j("d", -400)]);
    assert.equal(calidad(r, "e").veredicto, "buena");
    assert.equal(calidad(r, "b").veredicto, "imprecision");
    assert.equal(calidad(r, "c").veredicto, "error");
    assert.equal(calidad(r, "d").veredicto, "error-grave");
  });

  it("recorta la pérdida: seguir ganando por más de 10 peones no es un error del motor", () => {
    const r = ref([j("mate", { mate: 2 }), j("gana", 1_500), j("tablas", 0)]);
    assert.equal(calidad(r, "gana").perdidaCp, 0);
    assert.equal(calidad(r, "gana").mateEscapado, true);
    assert.equal(calidad(r, "tablas").perdidaCp, 1_000);
  });

  it("distingue el mate permitido del que ya había", () => {
    const permite = ref([j("a", 50), j("b", { mate: -1 })]);
    assert.equal(calidad(permite, "b").matePermitido, true);
    const yaPerdido = ref([j("a", { mate: -5 }), j("b", { mate: -1 })]);
    assert.equal(calidad(yaPerdido, "b").matePermitido, false);
  });

  it("lanza si la jugada no está en la referencia", () => {
    assert.throws(() => calidad(ref([j("a", 0)]), "zz"));
  });
});

// --- Invariantes del coach ---------------------------------------------------------------

const ev = (cp: number, mate: Evaluation["mate"] = null): Evaluation => ({ cp, mate, text: mate ? `Mate en ${mate.moves} para las ${mate.winner === "w" ? "blancas" : "negras"}` : `${cp}` });

function informe(cambios: Partial<CoachReport>): CoachReport {
  return {
    color: "w",
    move: { uci: "e2e4", san: "e4" },
    best: { uci: "e2e4", san: "e4" },
    alternative: null,
    before: ev(30),
    after: ev(30),
    loss: 0,
    verdict: "mejor",
    category: "correcta",
    title: "Mejor jugada",
    summary: "Es la jugada que elige Alfil Beta.",
    findings: [],
    why: "",
    line: "1. e4",
    lines: { best: ["e2e4"], played: ["e2e4"] },
    depth: 4,
    ...cambios,
  };
}

const INICIAL = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("invariantes()", () => {
  it("un informe coherente no tiene ninguna violación", () => {
    assert.deepEqual(invariantes(INICIAL, informe({}), ["e2e4"]), []);
  });

  it("1. «Mejor jugada» con otra jugada como mejor", () => {
    const v = invariantes(INICIAL, informe({ move: { uci: "g1f3", san: "Nf3" } }), ["e2e4"]);
    assert.deepEqual(v.map((x) => x.regla), ["mejor-con-otra-mejor"]);
  });

  it("2. aviso táctico y «no hay un motivo táctico»", () => {
    const aviso = { kind: "mate-en-1", title: "Mate en 1 que se escapó", message: "m", label: "l", marks: [], move: { uci: "a", san: "a" } } as const;
    const v = invariantes(
      INICIAL,
      informe({ move: { uci: "g1f3", san: "Nf3" }, verdict: "error-grave", findings: [aviso], why: "No hay un motivo táctico: Alfil Beta la prefiere…" }),
      ["e2e4"],
    );
    assert.deepEqual(v.map((x) => x.regla), ["aviso-y-sin-motivo"]);
  });

  it("3 y 5. mate en contra tras la jugada con elogio de material y veredicto «Mejor»", () => {
    const v = invariantes(INICIAL, informe({ after: ev(-10_000, { winner: "b", moves: 1 }), summary: "exd5 gana un peón." }), ["e2e4"]);
    assert.deepEqual(v.map((x) => x.regla).sort(), ["mate-en-contra-con-elogio", "pieza-no-capturada", "veredicto-contra-evaluacion"]);
  });

  it("5. no salta si el mate en contra ya estaba antes de la jugada", () => {
    const mate = { winner: "b", moves: 1 } as const;
    const v = invariantes(INICIAL, informe({ before: ev(-10_000, mate), after: ev(-10_000, mate) }), ["e2e4"]);
    assert.deepEqual(v, []);
  });

  it("4. «gana una torre» exige que la línea capture una torre", () => {
    // 1.e4 d5 2.exd5: las blancas capturan un peón, no una torre.
    const linea = ["e2e4", "d7d5", "e4d5"];
    const mal = invariantes(INICIAL, informe({ move: { uci: "d2d4", san: "d4" }, verdict: "error", why: "e4 gana una torre." }), linea);
    assert.deepEqual(mal.map((x) => x.regla), ["pieza-no-capturada"]);
    const bien = invariantes(INICIAL, informe({ move: { uci: "d2d4", san: "d4" }, verdict: "error", why: "e4 gana un peón." }), linea);
    assert.deepEqual(bien, []);
  });
});

describe("capturasDe()", () => {
  it("cuenta las capturas del bando pedido, la captura al paso y la coronación a dama", () => {
    const alPaso = "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1";
    assert.deepEqual(capturasDe(alPaso, ["e5d6"], "w"), ["p"]);
    const corona = "1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1";
    assert.deepEqual(capturasDe(corona, ["a7b8q"], "w"), ["n", "coronación"]);
    assert.deepEqual(capturasDe(INICIAL, ["e2e4", "d7d5", "e4d5", "d8d5"], "b"), ["p"]);
  });

  it("se para en la primera jugada ilegal", () => {
    assert.deepEqual(capturasDe(INICIAL, ["e2e5", "d7d5"], "w"), []);
  });
});

describe("validarBanco()", () => {
  const base: PosicionBanco = { id: "x", categoria: "tranquila", descripcion: "d", fen: INICIAL, jugadas: [{ uci: "e2e4", san: "e4", nota: "n" }] };

  it("detecta id repetido, jugada ilegal, SAN equivocada y categoría desconocida", () => {
    const errores = validarBanco(
      [
        base,
        { ...base },
        { ...base, id: "y", jugadas: [{ uci: "e2e5", san: "e5", nota: "n" }] },
        { ...base, id: "z", jugadas: [{ uci: "e2e4", san: "d4", nota: "n" }] },
        { ...base, id: "w", categoria: "otra" as never },
      ],
      null,
    );
    assert.ok(errores.some((e) => e.includes("id repetido")));
    assert.ok(errores.some((e) => e.includes("jugada ilegal")));
    assert.ok(errores.some((e) => e.includes("la SAN")));
    assert.ok(errores.some((e) => e.includes("categoría desconocida")));
  });

  it("detecta una referencia incompleta o de otra posición", () => {
    const r: Referencia = { metodologia: {}, posiciones: { x: { fen: INICIAL, mejor: "e2e4", jugadas: [j("e2e4", 30)] } } };
    assert.ok(validarBanco([base], r).some((e) => e.includes("no valora exactamente")));
    const otra: Referencia = { metodologia: {}, posiciones: { x: { ...r.posiciones["x"]!, fen: "8/8/8/8/8/8/8/K6k w - - 0 1" } } };
    assert.ok(validarBanco([base], otra).some((e) => e.includes("otra FEN")));
    assert.ok(validarBanco([base], { metodologia: {}, posiciones: {} }).some((e) => e.includes("falta en la referencia")));
  });
});

describe("resúmenes", () => {
  const r = ref([j("a", 50), j("b", 40), j("c", -400)]);

  it("resumirMotor cuenta coincidencias, errores de más de 2 peones (también en tácticas) y tiempos", () => {
    const fila = (id: string, uci: string, categoria: ResultadoMotor["categoria"], ms: number): ResultadoMotor => ({
      id,
      categoria,
      uci,
      calidad: calidad(r, uci),
      mateDisponible: false,
      profundidad: 4,
      ms,
    });
    const s = resumirMotor([fila("p1", "a", "tranquila", 100), fila("p2", "b", "doblete", 300), fila("p3", "c", "doblete", 900), fila("p4", "c", "final", 200)]);
    assert.equal(s.coincide, 1);
    assert.equal(s.equivalente, 2);
    assert.equal(s.erroresMas2Peones, 2);
    assert.equal(s.erroresMas2PeonesTacticas, 1);
    assert.equal(s.msMax, 900);
    assert.equal(s.msMedia, 375);
  });

  it("resumirCoach cuenta falsos positivos, errores no vistos y la matriz de veredictos", () => {
    const fila = (uci: string, veredicto: ResultadoCoach["veredicto"]): ResultadoCoach => ({
      id: "p",
      categoria: "tranquila",
      uci,
      san: uci,
      referencia: calidad(r, uci),
      veredicto,
      mejorCoach: "a",
      mateAntes: null,
      mateDespues: null,
      violaciones: [],
      texto: "",
      ms: 10,
    });
    const s = resumirCoach([fila("a", "mejor"), fila("b", "error"), fila("c", "buena")], { p: r });
    assert.equal(s.analisis, 3);
    assert.equal(s.equivalentes, 2);
    assert.equal(s.falsosPositivos, 1);
    assert.equal(s.gravesReferencia, 1);
    assert.equal(s.gravesDetectados, 0);
    assert.equal(s.erroresNoVistos, 1);
    assert.equal(s.matriz.mejor.mejor, 1);
    assert.equal(s.matriz.mejor.error, 1);
    assert.equal(s.matriz["error-grave"].buena, 1);
    assert.equal(s.mejorCoincide, 1);
  });
});

describe("semilla()", () => {
  it("es estable y distingue textos", () => {
    assert.equal(semilla("mate1-pastor"), semilla("mate1-pastor"));
    assert.notEqual(semilla("a"), semilla("b"));
  });
});
