// Cifras vivas de Escaque (RC-09, issue #73).
//
// Genera `docs/metricas.json` y la tabla de cifras del README a partir del propio
// repositorio, para que la documentación no pueda desfasarse sin que algo falle.
// Sin dependencias. Hay que compilar antes (`npm run metrics` ya lo hace).
//
//   npm run metrics                   regenera docs/metricas.json y el bloque del README
//   npm run metrics:check             comprueba (sin escribir) que ambos siguen al día; lo corre la CI
//   npm run metrics -- --e2e          además cuenta las pruebas de Chrome real (necesita Chrome; CHROME_PATH)
//   npm run metrics -- --rendimiento  además mide la velocidad de perft en este equipo
//   npm run metrics -- --banco <etiqueta>   cambia el resultado del banco que se cita (por defecto, el que ya figura)
//
// Qué se comprueba y qué no:
//   - Exactas: dependencias, nº de pruebas y suites, lecciones, posiciones de perft,
//     nº de ficheros del sitio, cifras del banco (leídas de bench/resultados/<etiqueta>.json).
//   - Con margen del 5 %: bytes del sitio y bytes comprimidos (cualquier cambio de código los mueve).
//   - Registradas, no comprobadas por la CI: velocidad de perft, recuento de e2e y las cifras de
//     tiempo del banco (dependen del equipo). Llevan su fecha y su comando.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const JSON_PATH = join(ROOT, "docs", "metricas.json");
const README_PATH = join(ROOT, "README.md");
export const MARCA_INICIO = "<!-- metricas:inicio (generado por `npm run metrics`; no editar a mano) -->";
export const MARCA_FIN = "<!-- metricas:fin -->";
/** Margen para las cifras de tamaño. */
export const MARGEN_TAMANO = 0.05;
const BANCO_POR_DEFECTO = "despues-b3";

function leerJson(ruta) {
  return JSON.parse(readFileSync(ruta, "utf8"));
}

function archivos(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...archivos(p));
    else out.push(p);
  }
  return out.sort();
}

function git(...args) {
  const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : "";
}

/** Corre las pruebas y devuelve cuántas hay y cuántas fallan (los mismos ficheros que `npm test`). */
function contarPruebas() {
  const r = spawnSync(
    process.execPath,
    ["--test", "--test-reporter=tap", "dist/tests/**/*.test.js", "tools/*.test.mjs", ".claude/hooks/*.test.mjs"],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, env: { ...process.env, METRICAS_GENERANDO: "1" } },
  );
  const salida = `${r.stdout}\n${r.stderr}`;
  const num = (nombre) => Number(new RegExp(`^# ${nombre} (\\d+)`, "m").exec(salida)?.[1] ?? NaN);
  const out = { pruebas: num("tests"), suites: num("suites"), fallan: num("fail") };
  if (![out.pruebas, out.suites, out.fallan].every(Number.isFinite)) throw new Error("No se pudo leer el resumen de `node --test`.");
  return out;
}

/** Cuenta las pruebas de Chrome real (necesita Chrome; devuelve null si no se pidió). */
function contarE2e() {
  const ficheros = readdirSync(join(ROOT, "e2e")).filter((f) => f.endsWith(".e2e.mjs"));
  const r = spawnSync(process.execPath, ["--test", "--test-reporter=tap", "--test-concurrency=1", ...ficheros.map((f) => join("e2e", f))], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  const salida = `${r.stdout}\n${r.stderr}`;
  const num = (nombre) => Number(new RegExp(`^# ${nombre} (\\d+)`, "m").exec(salida)?.[1] ?? NaN);
  const pruebas = num("tests");
  if (!Number.isFinite(pruebas) || num("fail") !== 0) throw new Error("Las pruebas e2e no pasan: no se registra su recuento.");
  return { pruebas, ficheros: ficheros.length };
}

/** Tamaño del sitio montado en `site/`. */
function medirSitio() {
  const dir = join(ROOT, "site");
  if (!existsSync(dir)) throw new Error("Falta site/: ejecuta `npm run build:site` (o `npm run metrics`).");
  const lista = archivos(dir);
  let bytes = 0;
  let gzip = 0;
  for (const f of lista) {
    const b = readFileSync(f);
    bytes += b.length;
    if (/\.(js|css|html)$/.test(f)) gzip += gzipSync(b, { level: 9 }).length;
  }
  return { ficheros: lista.length, bytes, gzipJsCssHtmlBytes: gzip };
}

async function contarLecciones() {
  const { LESSONS } = await import(pathToFileURL(join(ROOT, "dist", "src", "lessons", "index.js")).href);
  const porGrupo = {};
  for (const l of LESSONS) porGrupo[l.group] = (porGrupo[l.group] ?? 0) + 1;
  return { total: LESSONS.length, primerosPasos: porGrupo["primeros-pasos"] ?? 0, tacticas: porGrupo.tacticas ?? 0 };
}

async function contarPerft() {
  const { PERFT_POSITIONS } = await import(pathToFileURL(join(ROOT, "dist", "tests", "perft-positions.js")).href);
  // `comprobaciones`: las del perft completo (`npm run test:perft`), una por posición y profundidad.
  return { posiciones: PERFT_POSITIONS.length, comprobaciones: PERFT_POSITIONS.reduce((t, r) => t + r.full, 0) };
}

/** Cifras del banco de posiciones, leídas del resultado guardado (no se vuelve a ejecutar). */
export function resumenBanco(etiqueta) {
  const ruta = join(ROOT, "bench", "resultados", `${etiqueta}.json`);
  if (!existsSync(ruta)) throw new Error(`No existe bench/resultados/${etiqueta}.json`);
  const b = leerJson(ruta);
  const d = b.motor.dificil.resumen;
  const c = b.coach.resumen;
  return {
    etiqueta,
    fecha: b.fecha,
    commit: b.commit,
    posiciones: b.configuracion.posiciones,
    referencia: `${b.configuracion.referencia.motor}, ${b.configuracion.referencia.nodosPorPosicion} nodos por posición`,
    dificil: {
      coincide: d.coincide,
      equivalente: d.equivalente,
      erroresMas2Peones: d.erroresMas2Peones,
      erroresMas2PeonesTacticas: d.erroresMas2PeonesTacticas,
      matesMantenidos: d.matesMantenidos,
      matesDisponibles: d.matesDisponibles,
      msMedia: d.msMedia,
      msMax: d.msMax,
    },
    coach: {
      analisis: c.analisis,
      veredictoIgual: c.veredictoIgual,
      gravesDetectados: c.gravesDetectados,
      gravesReferencia: c.gravesReferencia,
      falsosPositivos: c.falsosPositivos,
      equivalentes: c.equivalentes,
      erroresNoVistos: c.erroresNoVistos,
      informesConViolaciones: c.informesConViolaciones,
      msMedia: c.msMedia,
      msP95: c.msP95,
      msMax: c.msMax,
    },
  };
}

/** Velocidad de perft en este equipo (la inicial a profundidad 5). */
async function medirPerft() {
  const { Position, START_FEN, perft } = await import(pathToFileURL(join(ROOT, "dist", "src", "core", "index.js")).href);
  const pos = Position.fromFen(START_FEN);
  perft(pos, 4);
  const t0 = performance.now();
  const nodos = perft(pos, 5);
  const ms = performance.now() - t0;
  return {
    posicion: "inicial, profundidad 5",
    nodos,
    nodosPorSegundo: Math.round(nodos / (ms / 1000)),
    node: process.version,
    nucleos: (await import("node:os")).cpus().length,
    comando: "npm run metrics -- --rendimiento",
  };
}

/** Mide todo lo que se puede volver a calcular. `previo` aporta lo que solo se registra a mano. */
export async function medir({ previo, e2e = false, rendimiento = false, banco } = {}) {
  const paquete = leerJson(join(ROOT, "package.json"));
  const pruebas = contarPruebas();
  const registrado = previo?.registrado ?? {};
  return {
    generado: { fecha: new Date().toISOString().slice(0, 10), commit: git("rev-parse", "--short=12", "HEAD") },
    dependencias: {
      enEjecucion: Object.keys(paquete.dependencies ?? {}).length,
      desarrollo: Object.keys(paquete.devDependencies ?? {}).sort(),
    },
    pruebas: { total: pruebas.pruebas, suites: pruebas.suites, fallan: pruebas.fallan },
    lecciones: await contarLecciones(),
    perft: await contarPerft(),
    sitio: medirSitio(),
    banco: resumenBanco(banco ?? previo?.banco?.etiqueta ?? BANCO_POR_DEFECTO),
    registrado: {
      e2e: e2e ? { ...contarE2e(), fecha: new Date().toISOString().slice(0, 10), comando: "npm run metrics -- --e2e" } : registrado.e2e,
      perft: rendimiento ? { ...(await medirPerft()), fecha: new Date().toISOString().slice(0, 10) } : registrado.perft,
    },
  };
}

// ---------------------------------------------------------------- formato

const n = (x) => {
  const r = Math.round(x);
  return r >= 1000 ? String(r).replace(/\B(?=(\d{3})+(?!\d))/g, ".") : String(r);
};
const kb = (bytes) => `${n(Math.round(bytes / 1024))} KB`;
const pc = (a, b) => `${Math.round((a / b) * 100)} %`;
const dec = (x) => String(x).replace(".", ",");

/** El bloque Markdown que va en el README, entre las marcas. Es una función pura de `m`. */
export function renderizarBloque(m) {
  const b = m.banco;
  const filas = [
    ["Dependencias en ejecución", `**${m.dependencias.enEjecucion}** (la única devDependency es ${m.dependencias.desarrollo.join(", ")}, solo para compilar)`, "CI (trabajo `dependencias`) y `tools/metricas.test.mjs`"],
    ["Pruebas funcionales", `**${n(m.pruebas.total)}** pruebas en ${n(m.pruebas.suites)} suites (`+"`node --test`"+`, sin las de reloj ni el perft completo)`, "`npm test`; `npm run metrics:check` en la CI"],
    [
      "Lecciones guiadas",
      `**${m.lecciones.total}**: ${m.lecciones.primerosPasos} de primeros pasos y ${m.lecciones.tacticas} de tácticas`,
      "Datos en `src/lessons`; `npm run metrics:check`",
    ],
    ["Posiciones de referencia de perft", `**${m.perft.posiciones}**, todas exactas (la inicial, Kiwipete, las posiciones 3 a 6 de la Chess Programming Wiki y las «trampa» de Sedlak)`, "`npm run test:perft` en la CI"],
    ["Comprobaciones de perft", `**${m.perft.comprobaciones}** cifras de nodos exactas (una por posición y profundidad) en el perft completo, que no entra en las ${n(m.pruebas.total)} pruebas funcionales`, "`npm run test:perft` en la CI"],
    [
      "Sitio publicado",
      `${n(m.sitio.ficheros)} ficheros, ${kb(m.sitio.bytes)} en disco; JS + CSS + HTML suman ${kb(m.sitio.gzipJsCssHtmlBytes)} comprimidos con gzip (cada fichero por separado)`,
      "`npm run metrics:check` (margen del 5 %)",
    ],
    [
      `Banco de ${b.posiciones} posiciones (\`${b.etiqueta}\`)`,
      `Alfil Beta Difícil: mejor jugada de la referencia en ${b.dificil.coincide} de ${b.posiciones} y equivalente (a menos de 30 cp) en ${b.dificil.equivalente}; ${b.dificil.erroresMas2PeonesTacticas} errores de más de 2 peones en tácticas; mantiene ${b.dificil.matesMantenidos} de ${b.dificil.matesDisponibles} mates. Coach: veredicto igual al de la referencia en ${b.coach.veredictoIgual} de ${b.coach.analisis} informes (${pc(b.coach.veredictoIgual, b.coach.analisis)}), detecta ${b.coach.gravesDetectados} de ${b.coach.gravesReferencia} errores graves, ${b.coach.falsosPositivos} falsos positivos en ${b.coach.equivalentes} jugadas equivalentes y ${b.coach.informesConViolaciones} informes con contradicciones`,
      `\`bench/resultados/${b.etiqueta}.json\` (${b.fecha}, commit \`${b.commit}\`); metodología en \`bench/README.md\``,
    ],
    [
      "Tiempo del banco, por análisis o jugada (depende del equipo)",
      `Difícil (una jugada): ${n(b.dificil.msMedia)} ms de media y ${n(b.dificil.msMax)} ms la más lenta. Coach (un análisis completo de una jugada): ${n(b.coach.msMedia)} ms de media, ${n(b.coach.msP95)} ms el percentil 95 y ${n(b.coach.msMax)} ms el más lento`,
      "Registrado en el mismo fichero; no lo vuelve a medir la CI",
    ],
  ];
  const reg = m.registrado ?? {};
  if (reg.e2e) {
    filas.push(["Pruebas de extremo a extremo", `**${reg.e2e.pruebas}** en ${reg.e2e.ficheros} ficheros, con Chrome real (teclado, ARIA, SAN, arrastre, PGN, instalación)`, `CI (trabajo \`accesibilidad\`) en cada PR; el recuento se registra con \`${reg.e2e.comando}\` (${reg.e2e.fecha})`]);
  }
  if (reg.perft) {
    filas.push(["Velocidad de perft (depende del equipo)", `${dec((reg.perft.nodosPorSegundo / 1e6).toFixed(1))} millones de nodos por segundo (${reg.perft.posicion}: ${n(reg.perft.nodos)} nodos; Node ${reg.perft.node}, ${reg.perft.nucleos} núcleos)`, `Registrado con \`${reg.perft.comando}\` (${reg.perft.fecha}); no lo comprueba la CI`]);
  }
  const lineas = [
    `Generado el ${m.generado.fecha} sobre el commit \`${m.generado.commit}\` con \`npm run metrics\` (datos en [\`docs/metricas.json\`](docs/metricas.json)).`,
    "",
    "| Qué | Cifra | Cómo se comprueba |",
    "| --- | --- | --- |",
    ...filas.map(([a, c, d]) => `| ${a} | ${c} | ${d} |`),
  ];
  return lineas.join("\n");
}

/** Sustituye el bloque entre marcas. Devuelve null si el README no las tiene. */
export function insertarBloque(readme, bloque) {
  const i = readme.indexOf(MARCA_INICIO);
  const f = readme.indexOf(MARCA_FIN);
  if (i < 0 || f < i) return null;
  return `${readme.slice(0, i + MARCA_INICIO.length)}\n\n${bloque}\n\n${readme.slice(f)}`;
}

export function extraerBloque(readme) {
  const i = readme.indexOf(MARCA_INICIO);
  const f = readme.indexOf(MARCA_FIN);
  if (i < 0 || f < i) return null;
  return readme.slice(i + MARCA_INICIO.length, f).trim();
}

/** Diferencias entre lo medido ahora y lo guardado. Vacío si coincide (con el margen en tamaños). */
export function comparar(ahora, guardado) {
  const dif = [];
  const exacto = (nombre, a, g) => {
    if (JSON.stringify(a) !== JSON.stringify(g)) dif.push(`${nombre}: medido ${JSON.stringify(a)}, guardado ${JSON.stringify(g)}`);
  };
  exacto("dependencias", ahora.dependencias, guardado.dependencias);
  exacto("pruebas", ahora.pruebas, guardado.pruebas);
  exacto("lecciones", ahora.lecciones, guardado.lecciones);
  exacto("perft", ahora.perft, guardado.perft);
  exacto("sitio.ficheros", ahora.sitio.ficheros, guardado.sitio.ficheros);
  exacto("banco", ahora.banco, guardado.banco);
  for (const campo of ["bytes", "gzipJsCssHtmlBytes"]) {
    const a = ahora.sitio[campo];
    const g = guardado.sitio[campo];
    if (Math.abs(a - g) > g * MARGEN_TAMANO) dif.push(`sitio.${campo}: medido ${a}, guardado ${g} (margen ${MARGEN_TAMANO * 100} %)`);
  }
  return dif;
}

// ---------------------------------------------------------------- CLI

async function main() {
  const args = process.argv.slice(2);
  const comprobar = args.includes("--check");
  const previo = existsSync(JSON_PATH) ? leerJson(JSON_PATH) : undefined;
  const idx = args.indexOf("--banco");
  const banco = idx >= 0 ? args[idx + 1] : undefined;
  const ahora = await medir({ previo, e2e: args.includes("--e2e"), rendimiento: args.includes("--rendimiento"), banco });

  if (ahora.pruebas.fallan > 0) {
    console.error(`Hay ${ahora.pruebas.fallan} pruebas que fallan: arréglalas antes de regenerar las cifras.`);
    process.exit(1);
  }

  if (comprobar) {
    if (!previo) throw new Error("No existe docs/metricas.json: ejecuta `npm run metrics`.");
    const dif = comparar(ahora, previo);
    const bloque = extraerBloque(readFileSync(README_PATH, "utf8"));
    if (bloque !== renderizarBloque(previo)) dif.push("el bloque de cifras del README no coincide con docs/metricas.json");
    if (dif.length) {
      console.error("Las cifras del README o de docs/metricas.json están desfasadas:");
      for (const d of dif) console.error(` - ${d}`);
      console.error("Ejecuta `npm run metrics` y confirma el resultado.");
      process.exit(1);
    }
    console.log(`Cifras al día: ${ahora.pruebas.total} pruebas, ${ahora.lecciones.total} lecciones, ${ahora.sitio.ficheros} ficheros en el sitio.`);
    return;
  }

  writeFileSync(JSON_PATH, `${JSON.stringify(ahora, null, 2)}\n`);
  const readme = readFileSync(README_PATH, "utf8");
  const nuevo = insertarBloque(readme, renderizarBloque(ahora));
  if (nuevo === null) throw new Error(`El README no tiene las marcas ${MARCA_INICIO} … ${MARCA_FIN}.`);
  writeFileSync(README_PATH, nuevo);
  console.log(`Escrito ${relative(ROOT, JSON_PATH).split(sep).join("/")} y el bloque de cifras del README.`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  });
}
