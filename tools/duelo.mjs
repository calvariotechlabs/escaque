// Duelo entre dos versiones de Alfil Beta: mide si un cambio del motor lo hace más fuerte.
//
//   npm run build
//   node tools/duelo.mjs --a dist --b /ruta/a/otra/version/dist [--partidas 100] [--procesos 4] [--nivel dificil] [--salida fichero.json]
//   (--ms N en lugar de --nivel: búsqueda como la de Difícil pero con N ms por jugada, para pruebas rápidas)
//
// Cada versión es un `dist/` compilado de Escaque (por ejemplo, el de main en un worktree aparte).
// Las partidas salen de bench/aperturas.json: cada apertura se juega dos veces, una con cada
// color, así que ninguna versión tiene ventaja por las aperturas. Cada jugador usa su propio
// núcleo (src/core) y su propia tabla de transposición, vaciada al empezar cada partida.
//
// El resultado da el marcador de A, su porcentaje de puntos con un intervalo de confianza
// del 95 % y la probabilidad de que A sea más fuerte (LOS). La diferencia de Elo que se
// muestra es solo entre estas dos versiones, con este reloj y en este equipo: no es un
// Elo absoluto. Con el nivel Difícil (0,9 s por jugada) 100 partidas tardan unos 40-60
// minutos con 4 procesos. Solo para desarrollo: no entra en el sitio.
import { readFileSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const MAX_PLIES = 300;

function args(argv) {
  const out = { a: null, b: null, partidas: 100, procesos: Math.min(4, availableParallelism()), nivel: "dificil", salida: null, aperturas: "bench/aperturas.json", ms: null };
  for (let i = 0; i < argv.length; i++) {
    const clave = argv[i];
    const valor = argv[i + 1];
    if (valor === undefined) throw new Error(`Falta el valor de ${clave}`);
    i++;
    if (clave === "--a") out.a = valor;
    else if (clave === "--b") out.b = valor;
    else if (clave === "--partidas") out.partidas = Number(valor);
    else if (clave === "--procesos") out.procesos = Number(valor);
    else if (clave === "--nivel") out.nivel = valor;
    else if (clave === "--salida") out.salida = valor;
    else if (clave === "--aperturas") out.aperturas = valor;
    else if (clave === "--ms") out.ms = Number(valor);
    else throw new Error(`Argumento desconocido: ${clave}`);
  }
  if (out.a === null || out.b === null) throw new Error("Uso: node tools/duelo.mjs --a <dist> --b <dist> [--partidas N] [--procesos P] [--nivel facil|medio|dificil] [--salida f.json]");
  if (!Number.isInteger(out.partidas) || out.partidas < 2 || out.partidas % 2 !== 0) throw new Error("--partidas debe ser un entero par ≥ 2");
  if (!Number.isInteger(out.procesos) || out.procesos < 1 || out.procesos > 64) throw new Error("--procesos debe estar entre 1 y 64");
  if (!["facil", "medio", "dificil"].includes(out.nivel)) throw new Error("--nivel debe ser facil, medio o dificil");
  if (out.ms !== null && (!Number.isInteger(out.ms) || out.ms < 10)) throw new Error("--ms debe ser un entero ≥ 10");
  return out;
}

const carpeta = (ruta) => pathToFileURL((isAbsolute(ruta) ? ruta : resolve(ruta)) + "/").href;

async function cargar(dist) {
  const core = await import(new URL("src/core/index.js", carpeta(dist)).href);
  const engine = await import(new URL("src/engine/index.js", carpeta(dist)).href);
  return { core, engine };
}

/** Jugador: recibe las jugadas hechas (UCI) y devuelve la suya y el tiempo que tardó. */
function jugador({ core, engine }, nivel, ms) {
  const table = new engine.TranspositionTable();
  return (jugadas) => {
    const pos = core.Position.fromFen(START_FEN);
    for (const uci of jugadas) {
      const m = pos.moveFromUci(uci);
      if (m === null) throw new Error(`Jugada ilegal ${uci}`);
      pos.makeMove(m);
    }
    const t0 = performance.now();
    // Con --ms, como Difícil pero con otro reloj (para pruebas rápidas): búsqueda iterativa por tiempo.
    const { best } = ms === null ? engine.chooseMove(pos, nivel, { table }) : engine.search(pos, { timeMs: ms }, { table });
    return { best, ms: performance.now() - t0 };
  };
}

/** Juega una partida; el árbitro es el núcleo de A. */
function partida(arbitro, blancas, negras, apertura) {
  const pos = arbitro.core.Position.fromFen(START_FEN);
  const jugadas = [];
  for (const uci of apertura) {
    pos.makeMove(pos.moveFromUci(uci));
    jugadas.push(uci);
  }
  const tiempos = { w: [], b: [] };
  while (jugadas.length < MAX_PLIES) {
    const estado = pos.status();
    if (estado.kind !== "ongoing") {
      return { resultado: estado.kind === "checkmate" ? (estado.winner === "w" ? "1-0" : "0-1") : "1/2-1/2", motivo: estado.kind, jugadas, tiempos };
    }
    const turno = pos.turn;
    const { best, ms } = (turno === "w" ? blancas : negras)(jugadas);
    tiempos[turno].push(ms);
    const m = best === null ? null : pos.moveFromUci(best);
    if (m === null) throw new Error(`Jugada ilegal ${best} en ${pos.toFen()}`);
    pos.makeMove(m);
    jugadas.push(best);
  }
  const estado = pos.status();
  if (estado.kind === "checkmate") return { resultado: estado.winner === "w" ? "1-0" : "0-1", motivo: "checkmate", jugadas, tiempos };
  return { resultado: "1/2-1/2", motivo: estado.kind === "ongoing" ? "max-plies" : estado.kind, jugadas, tiempos };
}

/** Porcentaje de puntos con intervalo del 95 % (normal sobre la varianza observada), Elo relativo y LOS. */
export function estadistica(victorias, tablas, derrotas) {
  const n = victorias + tablas + derrotas;
  const puntos = (victorias + tablas / 2) / n;
  const varianza = (victorias * (1 - puntos) ** 2 + tablas * (0.5 - puntos) ** 2 + derrotas * (0 - puntos) ** 2) / n;
  const error = Math.sqrt(varianza / n);
  const elo = (p) => (p <= 0 ? -Infinity : p >= 1 ? Infinity : -400 * Math.log10(1 / p - 1));
  const bajo = Math.max(0, puntos - 1.96 * error);
  const alto = Math.min(1, puntos + 1.96 * error);
  // LOS: probabilidad de que A sea más fuerte, con las partidas decididas (las tablas no informan).
  const decididas = victorias + derrotas;
  const los = decididas === 0 ? 0.5 : 0.5 * (1 + erf((victorias - derrotas) / Math.sqrt(2 * decididas)));
  return { partidas: n, victorias, tablas, derrotas, puntos, intervalo: [bajo, alto], elo: elo(puntos), eloIntervalo: [elo(bajo), elo(alto)], los };
}

function erf(x) {
  // Abramowitz y Stegun 7.1.26 (error < 1,5e-7).
  const s = Math.sign(x);
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}

if (isMainThread) {
  const opciones = args(process.argv.slice(2));
  const aperturas = JSON.parse(readFileSync(opciones.aperturas, "utf8")).aperturas;
  const total = opciones.partidas;
  if (total > aperturas.length * 2) throw new Error(`Hay ${aperturas.length} aperturas: como mucho ${aperturas.length * 2} partidas`);
  const pendientes = Array.from({ length: total }, (_, i) => i);
  const resultados = [];
  const inicio = Date.now();
  await new Promise((hecho, fallo) => {
    let vivos = Math.min(opciones.procesos, total);
    for (let w = 0; w < vivos; w++) {
      const worker = new Worker(new URL(import.meta.url), { workerData: { a: opciones.a, b: opciones.b, nivel: opciones.nivel, ms: opciones.ms } });
      const siguiente = () => {
        const i = pendientes.shift();
        if (i === undefined) {
          worker.postMessage(null);
          return;
        }
        worker.postMessage({ indice: i, apertura: aperturas[Math.floor(i / 2)], aBlancas: i % 2 === 0 });
      };
      worker.on("message", (msg) => {
        if (msg.listo) return siguiente();
        resultados.push(msg);
        const a = msg.aBlancas ? "A" : "B";
        process.stderr.write(`#${msg.indice + 1} ${msg.apertura} (blancas ${a}): ${msg.resultado} por ${msg.motivo} en ${msg.medias} medias jugadas\n`);
        siguiente();
      });
      worker.on("error", fallo);
      worker.on("exit", () => {
        if (--vivos === 0) hecho();
      });
    }
  });
  resultados.sort((x, y) => x.indice - y.indice);
  let v = 0;
  let t = 0;
  let d = 0;
  const tiemposA = [];
  const tiemposB = [];
  for (const r of resultados) {
    const ganaBlancas = r.resultado === "1-0";
    const ganaNegras = r.resultado === "0-1";
    if (!ganaBlancas && !ganaNegras) t++;
    else if (ganaBlancas === r.aBlancas) v++;
    else d++;
    tiemposA.push(...r.tiemposA);
    tiemposB.push(...r.tiemposB);
  }
  const est = estadistica(v, t, d);
  const resumen = (ts) => ({ jugadas: ts.length, mediaMs: Math.round(ts.reduce((s, x) => s + x, 0) / ts.length), maxMs: Math.round(Math.max(...ts)) });
  const informe = {
    fecha: new Date().toISOString().slice(0, 10),
    a: opciones.a,
    b: opciones.b,
    nivel: opciones.ms === null ? opciones.nivel : `${opciones.ms} ms por jugada`,
    procesos: opciones.procesos,
    minutos: Math.round((Date.now() - inicio) / 60000),
    ...est,
    tiempos: { a: resumen(tiemposA), b: resumen(tiemposB) },
    partidas: resultados.map((r) => ({ apertura: r.apertura, aBlancas: r.aBlancas, resultado: r.resultado, motivo: r.motivo, jugadas: r.jugadas.join(" ") })),
  };
  const pct = (x) => `${(x * 100).toFixed(1)} %`;
  const num = (x) => (Number.isFinite(x) ? Math.round(x) : x > 0 ? "+∞" : "−∞");
  process.stdout.write(
    `A (${opciones.a}) contra B (${opciones.b}), ${informe.nivel}, ${est.partidas} partidas:\n` +
      `  +${v} =${t} -${d} · puntos de A ${pct(est.puntos)} (IC 95 %: ${pct(est.intervalo[0])} a ${pct(est.intervalo[1])})\n` +
      `  Elo relativo ${num(est.elo)} (IC 95 %: ${num(est.eloIntervalo[0])} a ${num(est.eloIntervalo[1])}) · LOS ${pct(est.los)}\n` +
      `  Tiempo por jugada: A media ${informe.tiempos.a.mediaMs} ms, máx. ${informe.tiempos.a.maxMs} ms · B media ${informe.tiempos.b.mediaMs} ms, máx. ${informe.tiempos.b.maxMs} ms\n`,
  );
  if (opciones.salida !== null) writeFileSync(opciones.salida, JSON.stringify(informe, null, 1) + "\n");
} else {
  const a = await cargar(workerData.a);
  const b = await cargar(workerData.b);
  parentPort.on("message", (tarea) => {
    if (tarea === null) return process.exit(0);
    const ja = jugador(a, workerData.nivel, workerData.ms);
    const jb = jugador(b, workerData.nivel, workerData.ms);
    const lista = tarea.apertura.jugadas.split(" ");
    const r = tarea.aBlancas ? partida(a, ja, jb, lista) : partida(a, jb, ja, lista);
    parentPort.postMessage({
      indice: tarea.indice,
      apertura: tarea.apertura.nombre,
      aBlancas: tarea.aBlancas,
      resultado: r.resultado,
      motivo: r.motivo,
      medias: r.jugadas.length,
      jugadas: r.jugadas,
      tiemposA: tarea.aBlancas ? r.tiempos.w : r.tiempos.b,
      tiemposB: tarea.aBlancas ? r.tiempos.b : r.tiempos.w,
    });
  });
  parentPort.postMessage({ listo: true });
}
