// Referencia externa del banco de posiciones: valora con Stockfish TODAS las jugadas legales
// de cada posición de bench/posiciones.json y guarda el resultado en
// bench/referencia-stockfish.json.
//
//   npm run build && node tools/stockfish-ref.mjs <ruta del binario de Stockfish> [--nodos N] [--procesos P]
//
// Solo para desarrollo. Stockfish NO es una dependencia de Escaque: no está en package.json,
// no se descarga sola, no entra en el sitio y la app nunca lo llama. Sirve únicamente para
// contrastar a Alfil Beta y al coach (bench/README.md explica la metodología).
//
// Reproducible: 1 hilo, tabla de 64 MB vaciada antes de cada posición, MultiPV igual al
// número de jugadas legales y un presupuesto fijo de nodos. Con el mismo binario, dos
// ejecuciones dan el mismo fichero salvo la fecha.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

const ROOT = new URL("../", import.meta.url);
const { Position, moveToUci } = await import(new URL("dist/src/core/index.js", ROOT).href);

const HILOS = 1;
const HASH_MB = 64;

function args(argv) {
  const out = { binario: null, nodos: 8_000_000, procesos: 4, solo: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--nodos") out.nodos = Number(argv[++i]);
    else if (a === "--procesos") out.procesos = Number(argv[++i]);
    else if (a === "--solo") {
      out.solo = argv[++i];
      if (typeof out.solo !== "string" || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(out.solo)) throw new Error("--solo necesita el id de una posición");
    }
    else if (out.binario === null) out.binario = a;
    else throw new Error(`Argumento desconocido: ${a}`);
  }
  if (out.binario === null || !existsSync(out.binario)) throw new Error("Falta la ruta del binario de Stockfish (o no existe)");
  if (!Number.isInteger(out.nodos) || out.nodos < 10_000) throw new Error("--nodos debe ser un entero ≥ 10 000");
  if (!Number.isInteger(out.procesos) || out.procesos < 1 || out.procesos > 64) throw new Error("--procesos debe estar entre 1 y 64");
  return out;
}

/** Un proceso de Stockfish que habla UCI. */
class Motor {
  constructor(binario) {
    this.proc = spawn(binario, [], { stdio: ["pipe", "pipe", "inherit"] });
    // Si Stockfish no arranca o se cae, se para todo con un mensaje claro en vez de quedarse esperando.
    const fallo = (motivo) => {
      process.stderr.write(`Stockfish ha fallado (${motivo}). No se ha escrito la referencia.\n`);
      process.exit(1);
    };
    this.proc.on("error", (e) => fallo(e.message));
    this.proc.stdin.on("error", (e) => fallo(e.message));
    this.proc.on("exit", (code, signal) => { if (!this.cerrando) fallo(`salió con ${signal ?? code}`); });
    this.buf = "";
    this.oyentes = new Set();
    this.proc.stdout.setEncoding("utf8");
    this.proc.stdout.on("data", (d) => {
      this.buf += d;
      let i;
      while ((i = this.buf.indexOf("\n")) >= 0) {
        const linea = this.buf.slice(0, i).trim();
        this.buf = this.buf.slice(i + 1);
        for (const o of [...this.oyentes]) o(linea);
      }
    });
  }
  enviar(texto) { this.proc.stdin.write(texto + "\n"); }
  /** Envía `texto` y espera una línea que cumpla `fin`; devuelve todas las líneas recibidas hasta ella. */
  esperar(texto, fin) {
    return new Promise((resolve) => {
      const lineas = [];
      const o = (l) => { lineas.push(l); if (fin(l)) { this.oyentes.delete(o); resolve(lineas); } };
      this.oyentes.add(o);
      if (texto !== null) this.enviar(texto);
    });
  }
  async iniciar() {
    const lineas = await this.esperar("uci", (l) => l === "uciok");
    this.nombre = (lineas.find((l) => l.startsWith("id name ")) ?? "id name desconocido").slice(8);
    this.enviar(`setoption name Threads value ${HILOS}`);
    this.enviar(`setoption name Hash value ${HASH_MB}`);
    await this.esperar("isready", (l) => l === "readyok");
  }
  async analizar(fen, multipv, nodos) {
    this.enviar("ucinewgame");
    this.enviar("setoption name Clear Hash");
    this.enviar(`setoption name MultiPV value ${multipv}`);
    await this.esperar("isready", (l) => l === "readyok");
    this.enviar(`position fen ${fen}`);
    const lineas = await this.esperar(`go nodes ${nodos}`, (l) => l.startsWith("bestmove"));
    // Última línea de cada multipv: al agotar los nodos, Stockfish imprime todas las líneas
    // de la última iteración. Alguna puede ser una cota (lowerbound/upperbound); se anota.
    const porLinea = new Map();
    for (const l of lineas) {
      if (!l.startsWith("info ") || !l.includes(" pv ")) continue;
      const m = l.match(/ depth (\d+) .*multipv (\d+) score (cp|mate) (-?\d+)( (lowerbound|upperbound))? .* pv (.+)$/);
      if (m) porLinea.set(Number(m[2]), { profundidad: Number(m[1]), tipo: m[3], valor: Number(m[4]), cota: m[6] ?? null, pv: m[7].split(" ") });
    }
    const mejor = lineas.at(-1).split(" ")[1];
    return { mejor, lineas: [...porLinea.values()] };
  }
  cerrar() { this.cerrando = true; this.enviar("quit"); }
}

const opciones = args(process.argv.slice(2));
const posiciones = JSON.parse(readFileSync(new URL("bench/posiciones.json", ROOT), "utf8"));
const lista = opciones.solo ? posiciones.filter((p) => p.id === opciones.solo) : posiciones;
if (lista.length === 0) throw new Error(`No hay ninguna posición ${opciones.solo}`);

const resultados = new Map();
let siguiente = 0;
let nombre = "";
async function trabajador() {
  const motor = new Motor(opciones.binario);
  await motor.iniciar();
  nombre = motor.nombre;
  while (siguiente < lista.length) {
    const p = lista[siguiente++];
    const pos = Position.fromFen(p.fen);
    const legales = pos.legalMoves().map(moveToUci).sort();
    const { mejor, lineas } = await motor.analizar(p.fen, legales.length, opciones.nodos);
    const jugadas = lineas
      .map((l) => ({ uci: l.pv[0], ...(l.tipo === "cp" ? { cp: l.valor } : { mate: l.valor }), profundidad: l.profundidad, ...(l.cota ? { cota: l.cota } : {}), pv: l.pv.slice(0, 8) }))
      .sort((a, b) => valorOrden(b) - valorOrden(a) || (a.uci < b.uci ? -1 : 1));
    const faltan = legales.filter((u) => !jugadas.some((j) => j.uci === u));
    if (new Set(jugadas.map((j) => j.uci)).size !== jugadas.length) throw new Error(`${p.id}: jugada repetida en MultiPV`);
    if (faltan.length > 0) throw new Error(`${p.id}: Stockfish no valoró ${faltan.join(", ")}`);
    resultados.set(p.id, { fen: p.fen, mejor, jugadas });
    process.stderr.write(`${p.id}: ${mejor} (${jugadas.length} jugadas)\n`);
  }
  motor.cerrar();
}
/** Para ordenar: mate a favor primero (cuanto antes mejor), mate en contra al final. */
function valorOrden(j) {
  if (j.mate === undefined) return j.cp;
  return j.mate > 0 ? 1_000_000 - j.mate : -1_000_000 - j.mate;
}

await Promise.all(Array.from({ length: Math.min(opciones.procesos, lista.length) }, trabajador));

const binario = readFileSync(opciones.binario);
const salida = {
  metodologia: {
    motor: nombre,
    binario: basename(opciones.binario),
    sha256: createHash("sha256").update(binario).digest("hex"),
    hilos: HILOS,
    hashMB: HASH_MB,
    tablaVaciadaPorPosicion: true,
    multipv: "todas las jugadas legales",
    nodosPorPosicion: opciones.nodos,
    puntuacion: "centipeones o mate en N, vistos por el bando que mueve tras hacer cada jugada (convención UCI)",
    fecha: new Date().toISOString().slice(0, 10),
  },
  posiciones: Object.fromEntries(posiciones.filter((p) => resultados.has(p.id)).map((p) => [p.id, resultados.get(p.id)])),
};
const destino = opciones.solo ? new URL(`bench/referencia-${opciones.solo}.json`, ROOT) : new URL("bench/referencia-stockfish.json", ROOT);
writeFileSync(destino, JSON.stringify(salida, null, 1) + "\n");
process.stderr.write(`Escrito ${destino.pathname}\n`);
