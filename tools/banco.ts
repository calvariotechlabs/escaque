// Mide a Alfil Beta y al coach con el banco de posiciones de referencia (RC-04).
//
//   npm run bench:posiciones                          (unos 4-6 minutos)
//   npm run bench:posiciones -- --etiqueta antes-b1   (guarda bench/resultados/antes-b1.{json,md})
//   npm run bench:posiciones -- --solo mate1-pastor   (una sola posición, sin guardar)
//
// No ejecuta Stockfish: compara con bench/referencia-stockfish.json, que se genera aparte
// (tools/stockfish-ref.mjs). Metodología y significado de cada cifra: bench/README.md.
import { Position, createRandom } from "../src/core/index.js";
import type { Color } from "../src/core/index.js";
import { COACH_LIMITS, analyzeMove, checkInvariants } from "../src/coach/index.js";
import { MATE_SCORE, TranspositionTable, chooseMove, search } from "../src/engine/index.js";
import type { Level, SearchResult } from "../src/engine/index.js";
import {
  LIMITE_CP,
  calidad,
  invariantes,
  resumirCoach,
  resumirMotor,
  semilla,
  validarBanco,
} from "./banco-core.js";
import type { PosicionBanco, Referencia, ResultadoCoach, ResultadoMotor, ResumenCoach, ResumenMotor } from "./banco-core.js";
import { nodeProcess } from "./node.js";

const proc = nodeProcess();
/** Mates en N jugadas o menos que el coach debería ver a su profundidad. */
const MATE_CORTO = 3;
const fs = proc.getBuiltinModule("node:fs");

interface Opciones {
  etiqueta: string | null;
  solo: string | null;
}

function leerOpciones(argv: readonly string[]): Opciones {
  const out: Opciones = { etiqueta: null, solo: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const valor = argv[i + 1];
    if ((a === "--etiqueta" || a === "--solo") && valor !== undefined && /^[a-z0-9][a-z0-9-]{0,63}$/.test(valor)) {
      if (a === "--etiqueta") out.etiqueta = valor;
      else out.solo = valor;
      i++;
    } else {
      throw new Error("Uso: npm run bench:posiciones -- [--etiqueta nombre] [--solo id] (nombres en minúsculas, cifras y guiones)");
    }
  }
  return out;
}

/** Commit actual leyendo .git (sin lanzar procesos). Admite worktrees, donde .git es un fichero «gitdir: …». */
function commitActual(): string {
  const leer = (ruta: string): string | null => {
    try {
      return fs.readFileSync(ruta, "utf8").trim();
    } catch {
      return null;
    }
  };
  let gitDir = ".git";
  let comun = ".git";
  const enlace = leer(".git");
  if (enlace !== null && enlace.startsWith("gitdir: ")) {
    gitDir = enlace.slice(8);
    const commondir = leer(`${gitDir}/commondir`);
    comun = commondir === null ? gitDir : commondir.startsWith("/") ? commondir : `${gitDir}/${commondir}`;
  }
  const head = leer(`${gitDir}/HEAD`);
  if (head === null) return "desconocido";
  if (!head.startsWith("ref: ")) return head.slice(0, 12);
  const ref = head.slice(5);
  const directo = leer(`${gitDir}/${ref}`) ?? leer(`${comun}/${ref}`);
  if (directo !== null) return directo.slice(0, 12);
  const linea = leer(`${comun}/packed-refs`)?.split("\n").find((l) => l.endsWith(` ${ref}`));
  return linea?.slice(0, 12) ?? "desconocido";
}

/** Puntuación del motor (para quien mueve) → centipeones recortados, con los mates como ±LIMITE_CP. */
const motorCp = (score: number): number => Math.max(-LIMITE_CP, Math.min(LIMITE_CP, Math.abs(score) > MATE_SCORE - 1_000 ? Math.sign(score) * LIMITE_CP : score));

/** FNV-1a de 32 bits en hexadecimal: huella de los resultados deterministas. */
function huella(texto: string): string {
  return semilla(texto).toString(16).padStart(8, "0");
}

interface Perfil {
  readonly nombre: string;
  readonly descripcion: string;
  readonly determinista: boolean;
  readonly elegir: (pos: Position, id: string) => SearchResult;
}

function nivel(level: Level): (pos: Position, id: string) => SearchResult {
  return (pos, id) => chooseMove(pos, level, { random: createRandom(semilla(id)) });
}

const PERFILES: readonly Perfil[] = [
  { nombre: "facil", descripcion: "Nivel Fácil (azar con semilla fija por posición)", determinista: true, elegir: nivel("facil") },
  { nombre: "medio", descripcion: "Nivel Medio (profundidad 3, tope 0,5 s: en posiciones pesadas el reloj decide)", determinista: false, elegir: nivel("medio") },
  { nombre: "dificil", descripcion: "Nivel Difícil (0,9 s de reloj real: depende del equipo)", determinista: false, elegir: nivel("dificil") },
  {
    nombre: "prof5",
    descripcion: "Alfil Beta a profundidad fija 5 (determinista)",
    determinista: true,
    elegir: (pos) => search(pos, { maxDepth: 5 }, { table: new TranspositionTable() }),
  },
];

function ejecutar(lista: readonly PosicionBanco[]): void {
  proc.stderr.write(`Banco: ${lista.length} posiciones. Commit ${commitActual()}.\n`);
  // Calentamiento: la primera búsqueda paga la compilación del JIT.
  search(Position.fromFen(lista[0]!.fen), { maxDepth: 3 });

  const motor: Record<string, { resumen: ResumenMotor; filas: ResultadoMotor[] }> = {};
  for (const perfil of PERFILES) {
    proc.stderr.write(`Motor · ${perfil.descripcion}…\n`);
    const filas: ResultadoMotor[] = [];
    for (const p of lista) {
      const ref = referencia.posiciones[p.id]!;
      const pos = Position.fromFen(p.fen);
      const t0 = performance.now();
      const r = perfil.elegir(pos, p.id);
      const ms = performance.now() - t0;
      filas.push({
        id: p.id,
        categoria: p.categoria,
        uci: r.best,
        calidad: r.best === null ? null : calidad(ref, r.best),
        mateDisponible: (ref.jugadas[0]!.mate ?? 0) > 0,
        profundidad: r.depth,
        ms: Math.round(ms),
      });
    }
    motor[perfil.nombre] = { resumen: resumirMotor(filas), filas };
  }

  // Estabilidad: misma posición a profundidad 4 (la del coach) y 5.
  proc.stderr.write("Estabilidad de la evaluación (profundidad 4 frente a 5)…\n");
  const estabilidad: { id: string; prof4: number; prof5: number; diferencia: number }[] = [];
  for (const p of lista) {
    const r4 = search(Position.fromFen(p.fen), { maxDepth: COACH_LIMITS.maxDepth }, { table: new TranspositionTable() });
    const r5 = search(Position.fromFen(p.fen), { maxDepth: 5 }, { table: new TranspositionTable() });
    const a = motorCp(r4.score);
    const b = motorCp(r5.score);
    estabilidad.push({ id: p.id, prof4: a, prof5: b, diferencia: Math.abs(a - b) });
  }
  const inestables = estabilidad.filter((e) => e.diferencia >= 100);

  proc.stderr.write("Coach…\n");
  const filasCoach: ResultadoCoach[] = [];
  for (const p of lista) {
    const ref = referencia.posiciones[p.id]!;
    // La primera de la referencia (la que usan las métricas), el bestmove de Stockfish si es otra y las marcadas.
    const ucis = [ref.jugadas[0]!.uci, ref.mejor, ...p.jugadas.map((j) => j.uci)].filter((u, i, all) => all.indexOf(u) === i);
    for (const uci of ucis) {
      const t0 = performance.now();
      const informe = analyzeMove({ fen: p.fen }, uci, { limits: { maxDepth: COACH_LIMITS.maxDepth } });
      const ms = performance.now() - t0;
      const q = calidad(ref, uci);
      const color: Color = informe.color;
      const rival: Color = color === "w" ? "b" : "w";
      // Solo los mates cortos (en 3 o menos): los largos quedan fuera del alcance del coach a profundidad 4.
      const mateRef = ref.jugadas[0]!.mate ?? 0;
      const hayMate = mateRef > 0 && mateRef <= MATE_CORTO;
      filasCoach.push({
        id: p.id,
        categoria: p.categoria,
        uci,
        san: informe.move.san,
        referencia: q,
        veredicto: informe.verdict,
        mejorCoach: informe.best.uci,
        mateAntes: hayMate ? informe.before.mate?.winner === color : null,
        mateDespues: q.matePermitido ? informe.after.mate?.winner === rival : null,
        violaciones: [
          ...invariantes(p.fen, informe, informe.alternative === null ? informe.lines.played : informe.lines.best),
          ...checkInvariants(informe, { fen: p.fen }).map((detalle) => ({ regla: "invariante-del-coach" as const, detalle })),
        ],
        texto: [`${informe.title}. ${informe.summary}`, informe.why, ...informe.findings.map((f) => `[${f.title}] ${f.message}`)].filter(Boolean).join(" | "),
        ms: Math.round(ms),
        profundidad: informe.depth,
      });
    }
  }
  const coach = { resumen: resumirCoach(filasCoach, referencia.posiciones), filas: filasCoach };

  // Huella de lo determinista: sin tiempos y sin el nivel Difícil.
  const deterministas = {
    motor: Object.fromEntries(PERFILES.filter((p) => p.determinista).map((p) => [p.nombre, motor[p.nombre]!.filas.map((f) => [f.id, f.uci, f.profundidad])])),
    estabilidad,
    coach: filasCoach.map((f) => [f.id, f.uci, f.veredicto, f.mejorCoach, f.texto]),
  };
  const resultado = {
    fecha: new Date().toISOString().slice(0, 10),
    commit: commitActual(),
    huellaDeterminista: huella(JSON.stringify(deterministas)),
    configuracion: {
      posiciones: lista.length,
      coach: `analyzeMove con profundidad ${COACH_LIMITS.maxDepth} y sin reloj (determinista)`,
      perfiles: PERFILES.map((p) => ({ nombre: p.nombre, descripcion: p.descripcion, determinista: p.determinista })),
      referencia: referencia.metodologia,
    },
    motor,
    estabilidad: { inestables: inestables.length, umbralCp: 100, posiciones: estabilidad },
    coach,
  };
  const informe = markdown(resultado.fecha, resultado.commit, resultado.huellaDeterminista, lista, motor, coach.resumen, inestables, filasCoach);
  if (opciones.etiqueta !== null && opciones.solo === null) {
    fs.mkdirSync("bench/resultados", { recursive: true });
    fs.writeFileSync(`bench/resultados/${opciones.etiqueta}.json`, `${JSON.stringify(resultado, null, 1)}\n`);
    fs.writeFileSync(`bench/resultados/${opciones.etiqueta}.md`, informe);
    proc.stderr.write(`Guardado en bench/resultados/${opciones.etiqueta}.{json,md}\n`);
  }
  proc.stdout.write(informe);
}

const pct = (a: number, b: number): string => (b === 0 ? "—" : `${a}/${b} (${Math.round((100 * a) / b)} %)`);

function markdown(
  fecha: string,
  commit: string,
  huellaTexto: string,
  lista: readonly PosicionBanco[],
  motor: Record<string, { resumen: ResumenMotor; filas: ResultadoMotor[] }>,
  coach: ResumenCoach,
  inestables: readonly { id: string; prof4: number; prof5: number; diferencia: number }[],
  filasCoach: readonly ResultadoCoach[],
): string {
  const l: string[] = [];
  const porCategoria = new Map<string, number>();
  for (const p of lista) porCategoria.set(p.categoria, (porCategoria.get(p.categoria) ?? 0) + 1);
  l.push(`# Banco de posiciones · ${fecha} · commit ${commit}`, "");
  l.push(`Huella de los resultados deterministas: \`${huellaTexto}\` (igual en dos ejecuciones del mismo commit).`, "");
  l.push(`Posiciones: ${lista.length} (${[...porCategoria].map(([c, n]) => `${c} ${n}`).join(", ")}).`, "");
  l.push(`Referencia: ${String(referencia.metodologia["motor"])}, ${String(referencia.metodologia["nodosPorPosicion"])} nodos por posición, 1 hilo, todas las jugadas valoradas. Metodología en bench/README.md.`, "");

  l.push("## Alfil Beta", "");
  l.push("| Perfil | Mejor jugada | Equivalente (≤ 30 cp) | Pérdida media | Errores > 2 peones | En tácticas | Mates mantenidos | Tiempo medio | Máximo |");
  l.push("|---|---|---|---|---|---|---|---|---|");
  for (const perfil of PERFILES) {
    const r = motor[perfil.nombre]!.resumen;
    l.push(
      `| ${perfil.descripcion} | ${pct(r.coincide, r.posiciones)} | ${pct(r.equivalente, r.posiciones)} | ${r.perdidaMediaCp} cp | ${r.erroresMas2Peones} | ${r.erroresMas2PeonesTacticas} | ${pct(r.matesMantenidos, r.matesDisponibles)} | ${r.msMedia} ms | ${r.msMax} ms |`,
    );
  }
  l.push("");
  const dificil = motor["dificil"]!.resumen;
  l.push(`Punto de parada del motor (B11): Difícil < 1 s → máximo ${dificil.msMax} ms; sin errores de más de 2 peones en tácticas → ${dificil.erroresMas2PeonesTacticas}.`, "");
  if (dificil.erroresTacticas.length > 0) l.push(`Errores de Difícil en tácticas: ${dificil.erroresTacticas.join("; ")}.`, "");

  l.push("## Coach", "");
  l.push(`Informes analizados: ${coach.analisis} (la mejor jugada de la referencia y las jugadas marcadas en cada posición), a profundidad ${COACH_LIMITS.maxDepth}.`, "");
  l.push("| Métrica | Resultado |", "|---|---|");
  l.push(`| Veredicto igual al de la referencia | ${pct(coach.veredictoIgual, coach.analisis)} |`);
  l.push(`| Errores graves detectados (Error o Error grave) | ${pct(coach.gravesDetectados, coach.gravesReferencia)} |`);
  l.push(`| Falsos positivos (jugada equivalente a la mejor llamada Error o Error grave) | ${pct(coach.falsosPositivos, coach.equivalentes)} |`);
  l.push(`| Errores llamados «Mejor» o «Buena» | ${coach.erroresNoVistos} |`);
  l.push(`| Mejor jugada del coach equivalente a la de la referencia | ${pct(coach.mejorCoincide, new Set(filasCoach.map((f) => f.id)).size)} |`);
  l.push(`| Mate a favor en ${MATE_CORTO} o menos visto antes de la jugada | ${pct(coach.matesVistos, coach.posicionesConMate)} |`);
  l.push(`| Mate permitido visto después de la jugada | ${pct(coach.matesPermitidosVistos, coach.matesPermitidos)} |`);
  l.push(`| Informes con alguna contradicción | ${pct(coach.informesConViolaciones, coach.analisis)} |`);
  l.push(`| Tiempo por análisis (media · p95 · máximo) | ${coach.msMedia} · ${coach.msP95} · ${coach.msMax} ms |`);
  const profundidades = filasCoach.map((f) => f.profundidad ?? 0);
  if (profundidades.length > 0) {
    const media = profundidades.reduce((a, b) => a + b, 0) / profundidades.length;
    l.push(`| Profundidad de la búsqueda de antes (media · mínimo · máximo) | ${media.toFixed(1)} · ${Math.min(...profundidades)} · ${Math.max(...profundidades)} |`);
  }
  l.push("");
  l.push("Contradicciones por regla:", "");
  for (const [regla, n] of Object.entries(coach.violaciones)) l.push(`- ${regla}: ${n}`);
  l.push("");
  l.push("Matriz de veredictos (filas: referencia; columnas: coach):", "");
  const vs = Object.keys(coach.matriz) as (keyof ResumenCoach["matriz"])[];
  l.push(`| Referencia \\ Coach | ${vs.join(" | ")} |`, `|---|${vs.map(() => "---").join("|")}|`);
  for (const r of vs) l.push(`| ${r} | ${vs.map((c) => coach.matriz[r][c]).join(" | ")} |`);
  l.push("");
  if (coach.listaFalsosPositivos.length > 0) l.push(`Falsos positivos: ${coach.listaFalsosPositivos.join("; ")}.`, "");
  if (coach.listaErroresNoVistos.length > 0) l.push(`Errores no vistos: ${coach.listaErroresNoVistos.join("; ")}.`, "");
  const conViolacion = filasCoach.filter((f) => f.violaciones.length > 0);
  if (conViolacion.length > 0) {
    l.push("Contradicciones encontradas:", "");
    for (const f of conViolacion) l.push(`- ${f.id} ${f.san}: ${f.violaciones.map((v) => `${v.regla} (${v.detalle})`).join("; ")}`);
    l.push("");
  }
  l.push("## Estabilidad", "");
  l.push(`Posiciones cuya evaluación cambia 1 peón o más entre profundidad 4 y 5: ${inestables.length} de ${lista.length}.`);
  if (inestables.length > 0) l.push("", inestables.map((e) => `${e.id} (${e.prof4} → ${e.prof5} cp)`).join("; ") + ".");
  l.push("");
  return `${l.join("\n")}\n`;
}

const opciones = leerOpciones(proc.argv.slice(2));
const banco = JSON.parse(fs.readFileSync("bench/posiciones.json", "utf8")) as PosicionBanco[];
const referencia = JSON.parse(fs.readFileSync("bench/referencia-stockfish.json", "utf8")) as Referencia;
const errores = validarBanco(banco, referencia);
if (errores.length > 0) {
  proc.stderr.write(`El banco o la referencia no son válidos:\n${errores.map((e) => `  - ${e}`).join("\n")}\n`);
  proc.exitCode = 1;
} else {
  const lista = opciones.solo === null ? banco : banco.filter((p) => p.id === opciones.solo);
  if (lista.length === 0) throw new Error(`No hay ninguna posición ${opciones.solo ?? ""}`);
  ejecutar(lista);
}
