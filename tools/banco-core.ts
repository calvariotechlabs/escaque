// Banco de posiciones de referencia (RC-04): datos, validación y métricas.
//
// Mide a Alfil Beta y al coach contra una referencia externa (Stockfish) que se calcula
// aparte, en desarrollo, con tools/stockfish-ref.mjs y se guarda en
// bench/referencia-stockfish.json. Aquí no se ejecuta Stockfish: solo se leen sus
// valoraciones. La metodología está en bench/README.md.
//
// Todo lo de este fichero es determinista y funciona sin Node (lo usan tools/banco.ts y
// tests/banco.test.ts).
import { Position, moveToUci } from "../src/core/index.js";
import type { Color, PieceType } from "../src/core/index.js";
import type { CoachReport, Verdict } from "../src/coach/index.js";

// --- Datos -------------------------------------------------------------------

export const CATEGORIAS = [
  "mate-inmediato",
  "mate-forzado",
  "doblete",
  "clavada",
  "descubierto",
  "sacrificio-correcto",
  "sacrificio-incorrecto",
  "ganancia-material",
  "perdida-material",
  "equivalentes",
  "tranquila",
  "final",
  "auditoria",
] as const;
export type Categoria = (typeof CATEGORIAS)[number];

/** Categorías tácticas: en ellas se mide el punto de parada del motor (sin errores de más de 2 peones). */
export const TACTICAS: ReadonlySet<Categoria> = new Set<Categoria>([
  "mate-inmediato",
  "mate-forzado",
  "doblete",
  "clavada",
  "descubierto",
  "sacrificio-correcto",
  "sacrificio-incorrecto",
  "ganancia-material",
  "perdida-material",
  "auditoria",
]);

export interface JugadaBanco {
  readonly uci: string;
  /** SAN inglesa, como la da el núcleo. */
  readonly san: string;
  /** Por qué está: «mate», «pierde pieza», «sacrificio correcto»… Solo informativo. */
  readonly nota: string;
}

export interface PosicionBanco {
  readonly id: string;
  readonly categoria: Categoria;
  readonly descripcion: string;
  readonly fen: string;
  /** Jugadas que el coach analiza además de la mejor de la referencia. */
  readonly jugadas: readonly JugadaBanco[];
  readonly etiquetas?: readonly string[];
  /** Jugadas desde la posición inicial (SAN inglesa) cuando la posición sale de una partida. */
  readonly origen?: string;
  /** Hallazgo de las auditorías (H-01…) para las posiciones de la categoría «auditoria». */
  readonly hallazgo?: string;
  readonly origenUci?: string;
}

/** Valoración de Stockfish de una jugada, vista por el bando que mueve (convención UCI). */
export interface JugadaReferencia {
  readonly uci: string;
  readonly cp?: number;
  /** Mate en N: positivo a favor de quien mueve, negativo en contra. */
  readonly mate?: number;
  readonly profundidad: number;
  readonly cota?: "lowerbound" | "upperbound";
  readonly pv: readonly string[];
}

export interface PosicionReferencia {
  readonly fen: string;
  readonly mejor: string;
  /** Todas las jugadas legales, de mejor a peor. */
  readonly jugadas: readonly JugadaReferencia[];
}

export interface Referencia {
  readonly metodologia: Readonly<Record<string, unknown>>;
  readonly posiciones: Readonly<Record<string, PosicionReferencia>>;
}

// --- Validación -----------------------------------------------------------------

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Problemas del banco y de su referencia; lista vacía si todo está bien. */
export function validarBanco(posiciones: readonly PosicionBanco[], referencia: Referencia | null): string[] {
  const errores: string[] = [];
  const ids = new Set<string>();
  for (const p of posiciones) {
    const donde = typeof p.id === "string" ? p.id : "(sin id)";
    if (typeof p.id !== "string" || !ID.test(p.id)) errores.push(`${donde}: id no válido`);
    if (ids.has(p.id)) errores.push(`${donde}: id repetido`);
    ids.add(p.id);
    if (!(CATEGORIAS as readonly string[]).includes(p.categoria)) errores.push(`${donde}: categoría desconocida ${String(p.categoria)}`);
    let pos: Position;
    try {
      pos = Position.fromFen(p.fen);
    } catch {
      errores.push(`${donde}: FEN no válida`);
      continue;
    }
    if (pos.status().kind !== "ongoing") errores.push(`${donde}: la partida ya ha terminado`);
    if (pos.toFen() !== p.fen) errores.push(`${donde}: FEN no canónica`);
    const vistas = new Set<string>();
    for (const j of p.jugadas) {
      const move = pos.moveFromUci(j.uci);
      if (move === null) errores.push(`${donde}: jugada ilegal ${j.uci}`);
      else if (pos.moveToSan(move) !== j.san) errores.push(`${donde}: la SAN de ${j.uci} es ${pos.moveToSan(move)}, no ${j.san}`);
      if (vistas.has(j.uci)) errores.push(`${donde}: jugada repetida ${j.uci}`);
      vistas.add(j.uci);
    }
    if (referencia === null) continue;
    const ref = referencia.posiciones[p.id];
    if (ref === undefined) {
      errores.push(`${donde}: falta en la referencia`);
      continue;
    }
    if (ref.fen !== p.fen) errores.push(`${donde}: la referencia es de otra FEN`);
    const legales = pos.legalMoves().map(moveToUci).sort();
    const valoradas = ref.jugadas.map((j) => j.uci).sort();
    if (legales.join(" ") !== valoradas.join(" ")) errores.push(`${donde}: la referencia no valora exactamente las jugadas legales`);
    for (const j of ref.jugadas) {
      if ((j.cp === undefined) === (j.mate === undefined)) errores.push(`${donde}: ${j.uci} necesita cp o mate`);
    }
    // `mejor` es el bestmove de Stockfish; la lista va ordenada por valoración. Pueden no
    // coincidir cuando la última iteración deja alguna línea como cota, pero no deben alejarse.
    const elegida = jugadaRef(ref, ref.mejor);
    if (elegida === undefined || valorCp(ref.jugadas[0]!) - valorCp(elegida) > TOLERANCIA_CP) {
      errores.push(`${donde}: el bestmove de la referencia está lejos de la mejor valorada`);
    }
  }
  if (referencia !== null) {
    for (const id of Object.keys(referencia.posiciones)) if (!ids.has(id)) errores.push(`${id}: está en la referencia pero no en el banco`);
  }
  return errores;
}

// --- Valores de la referencia -------------------------------------------------------

/** Un mate vale esto (menos la distancia), como en el coach. */
export const MATE_CP = 10_000;
/** Pérdida en centipeones: las valoraciones se recortan a ±LIMITE_CP (seguir ganando por más de 10 peones no es un error). */
export const LIMITE_CP = 1_000;
/** Dos jugadas cuya valoración difiere como mucho esto son equivalentes. */
export const TOLERANCIA_CP = 30;
/** Error de más de 2 peones (punto de parada del motor). */
export const ERROR_MOTOR_CP = 200;
/** Misma curva y mismos umbrales que el coach (src/coach/analyze.ts) para comparar veredictos. */
const PENDIENTE = 0.00368208;
const UMBRALES: readonly (readonly [number, Verdict])[] = [
  [0.15, "error-grave"],
  [0.1, "error"],
  [0.05, "imprecision"],
];

/** Centipeones de una jugada de la referencia; los mates, ±(MATE_CP − N). */
export function valorCp(j: JugadaReferencia): number {
  if (j.mate === undefined) return j.cp!;
  return j.mate > 0 ? MATE_CP - j.mate : -MATE_CP - j.mate;
}

export function jugadaRef(ref: PosicionReferencia, uci: string): JugadaReferencia | undefined {
  return ref.jugadas.find((j) => j.uci === uci);
}

const recorta = (cp: number, limite: number): number => Math.max(-limite, Math.min(limite, cp));
const esperado = (cp: number): number => 1 / (1 + Math.exp(-PENDIENTE * cp));

export interface Calidad {
  /** Centipeones que pierde respecto a la mejor, con valores recortados a ±LIMITE_CP. */
  readonly perdidaCp: number;
  /** Caída de puntos esperados (0-1), misma curva que el coach. */
  readonly caida: number;
  /** Puesto de la jugada en la referencia (1 = la mejor). */
  readonly puesto: number;
  readonly mejor: boolean;
  /** Dentro de la tolerancia de la mejor. */
  readonly equivalente: boolean;
  /** Veredicto que daría el coach con los valores de Stockfish (con «mejor» = equivalente). */
  readonly veredicto: Verdict;
  /** Deja escapar un mate propio o permite uno que antes no había. */
  readonly mateEscapado: boolean;
  readonly matePermitido: boolean;
}

/** Calidad de `uci` según la referencia. Lanza si la jugada no está en ella. */
export function calidad(ref: PosicionReferencia, uci: string): Calidad {
  const jugada = jugadaRef(ref, uci);
  if (jugada === undefined) throw new Error(`La referencia no tiene la jugada ${uci}`);
  const mejor = ref.jugadas[0]!;
  const vMejor = valorCp(mejor);
  const v = valorCp(jugada);
  const perdidaCp = Math.max(0, recorta(vMejor, LIMITE_CP) - recorta(v, LIMITE_CP));
  const caida = Math.max(0, esperado(recorta(vMejor, MATE_CP)) - esperado(recorta(v, MATE_CP)));
  const equivalente = vMejor - v <= TOLERANCIA_CP;
  const veredicto: Verdict = equivalente ? "mejor" : (UMBRALES.find(([limite]) => caida >= limite)?.[1] ?? "buena");
  return {
    perdidaCp,
    caida,
    puesto: ref.jugadas.findIndex((j) => j.uci === uci) + 1,
    mejor: jugada.uci === mejor.uci || v === vMejor,
    equivalente,
    veredicto,
    mateEscapado: (mejor.mate ?? 0) > 0 && !((jugada.mate ?? 0) > 0),
    matePermitido: (jugada.mate ?? 0) < 0 && !((mejor.mate ?? 0) < 0),
  };
}

// --- Invariantes del informe del coach --------------------------------------------------

export type Regla =
  | "mejor-con-otra-mejor"
  | "aviso-y-sin-motivo"
  | "mate-en-contra-con-elogio"
  | "pieza-no-capturada"
  | "veredicto-contra-evaluacion";

export interface Violacion {
  readonly regla: Regla;
  readonly detalle: string;
}

const SIN_MOTIVO = /no hay un motivo táctico/i;
const ELOGIO = /\bgana (un peón|dos peones|una pieza|una torre|la dama)\b|la diferencia con la mejor jugada es pequeña/i;
const GANA = /^(\S+) gana (un peón|dos peones|una pieza|una torre|la dama)\b/;
const PIEZAS_TEXTO: Readonly<Record<string, readonly PieceType[]>> = {
  "un peón": ["p"],
  "dos peones": ["p"],
  "una pieza": ["n", "b"],
  "una torre": ["r"],
  "la dama": ["q"],
};

const contrario = (c: Color): Color => (c === "w" ? "b" : "w");

/**
 * Comprueba que el informe no se contradice (las invariantes de RC-01 en la consolidación).
 * Se aplica desde fuera, sin tocar el coach, para medir el «antes». `lineaMejor` es la
 * variante principal (UCI) de la búsqueda de antes; con ella se comprueba que la pieza que el
 * texto dice ganar se captura de verdad.
 *
 * 1. «Mejor jugada» como veredicto y, debajo, otra jugada como «Mejor jugada».
 * 2. Hay un aviso táctico y el texto dice «no hay un motivo táctico».
 * 3. Tras la jugada hay mate en contra y el texto elogia material o dice que la diferencia es pequeña.
 * 4. El texto dice «X gana una torre» y en la línea no se captura ninguna torre.
 * 5. El veredicto es «Mejor» o «Buena» y la jugada permite un mate que antes no había.
 */
export function invariantes(fen: string, informe: CoachReport, lineaMejor: readonly string[]): Violacion[] {
  const v: Violacion[] = [];
  const rival = contrario(informe.color);
  const textos = `${informe.summary} ${informe.why}`;

  if (informe.verdict === "mejor" && informe.best.uci !== informe.move.uci) {
    v.push({ regla: "mejor-con-otra-mejor", detalle: `«Mejor jugada» y debajo «Mejor jugada: ${informe.best.san}»` });
  }
  if (informe.findings.length > 0 && SIN_MOTIVO.test(textos)) {
    v.push({ regla: "aviso-y-sin-motivo", detalle: `aviso «${informe.findings[0]!.title}» y «no hay un motivo táctico»` });
  }
  if (informe.after.mate?.winner === rival && ELOGIO.test(informe.summary)) {
    v.push({ regla: "mate-en-contra-con-elogio", detalle: `${informe.after.text} y «${informe.summary}»` });
  }
  // «X gana …»: en el «por qué» (línea de la mejor) y en el resumen cuando la jugada es la mejor.
  const afirmaciones: string[] = [informe.why];
  if (informe.best.uci === informe.move.uci) afirmaciones.push(informe.summary);
  for (const texto of afirmaciones) {
    const m = GANA.exec(texto);
    if (m === null) continue;
    const capturadas = capturasDe(fen, lineaMejor, informe.color);
    const buscadas = PIEZAS_TEXTO[m[2]!]!;
    const necesarias = m[2] === "dos peones" ? 2 : 1;
    if (capturadas.filter((t) => t !== "coronación" && buscadas.includes(t)).length < necesarias && !(m[2] === "la dama" && capturadas.includes("coronación"))) {
      v.push({ regla: "pieza-no-capturada", detalle: `«${m[0]}» y la línea solo captura: ${capturadas.join(", ") || "nada"}` });
    }
  }
  const mateAntesEnContra = informe.before.mate?.winner === rival;
  if ((informe.verdict === "mejor" || informe.verdict === "buena") && informe.after.mate?.winner === rival && !mateAntesEnContra) {
    v.push({ regla: "veredicto-contra-evaluacion", detalle: `«${informe.title}» y ${informe.after.text}` });
  }
  return v;
}

/** Piezas que captura `color` en las 8 primeras medias jugadas de `linea` (y «coronación» si corona a dama). */
export function capturasDe(fen: string, linea: readonly string[], color: Color): (PieceType | "coronación")[] {
  const pos = Position.fromFen(fen);
  const out: (PieceType | "coronación")[] = [];
  for (const uci of linea.slice(0, 8)) {
    const move = pos.moveFromUci(uci);
    if (move === null) break;
    if (pos.turn === color) {
      const victima = pos.pieceAt(move.to);
      if (victima !== null) out.push(victima.type);
      else if (pos.pieceAt(move.from)?.type === "p" && (move.from & 7) !== (move.to & 7)) out.push("p"); // al paso
      if (move.promotion === "q") out.push("coronación");
    }
    pos.makeMove(move);
  }
  return out;
}

// --- Resúmenes ---------------------------------------------------------------------

export interface ResultadoMotor {
  readonly id: string;
  readonly categoria: Categoria;
  readonly uci: string | null;
  readonly calidad: Calidad | null;
  /** La referencia tiene un mate a favor de quien mueve. */
  readonly mateDisponible: boolean;
  readonly profundidad: number;
  readonly ms: number;
}

export interface ResumenMotor {
  readonly posiciones: number;
  /** Juega la mejor de la referencia (o una de igual valor). */
  readonly coincide: number;
  /** Dentro de la tolerancia de la mejor. */
  readonly equivalente: number;
  readonly perdidaMediaCp: number;
  /** Errores de más de 2 peones en todo el banco y solo en las posiciones tácticas. */
  readonly erroresMas2Peones: number;
  readonly erroresMas2PeonesTacticas: number;
  readonly erroresTacticas: readonly string[];
  /** Posiciones con mate a favor según la referencia y cuántas juega manteniendo el mate. */
  readonly matesDisponibles: number;
  readonly matesMantenidos: number;
  readonly msMedia: number;
  readonly msMax: number;
}

export function resumirMotor(filas: readonly ResultadoMotor[]): ResumenMotor {
  const conCalidad = filas.filter((f): f is ResultadoMotor & { calidad: Calidad } => f.calidad !== null);
  const graves = conCalidad.filter((f) => f.calidad.perdidaCp > ERROR_MOTOR_CP);
  const gravesTacticas = graves.filter((f) => TACTICAS.has(f.categoria));
  const conMate = conCalidad.filter((f) => f.mateDisponible);
  const tiempos = filas.map((f) => f.ms);
  return {
    posiciones: filas.length,
    coincide: conCalidad.filter((f) => f.calidad.mejor).length,
    equivalente: conCalidad.filter((f) => f.calidad.equivalente).length,
    perdidaMediaCp: redondea(media(conCalidad.map((f) => f.calidad.perdidaCp))),
    erroresMas2Peones: graves.length,
    erroresMas2PeonesTacticas: gravesTacticas.length,
    erroresTacticas: gravesTacticas.map((f) => `${f.id} (${f.uci}, −${Math.round(f.calidad.perdidaCp)} cp)`),
    matesDisponibles: conMate.length,
    matesMantenidos: conMate.filter((f) => !f.calidad.mateEscapado).length,
    msMedia: Math.round(media(tiempos)),
    msMax: Math.round(Math.max(0, ...tiempos)),
  };
}

export interface ResultadoCoach {
  readonly id: string;
  readonly categoria: Categoria;
  readonly uci: string;
  readonly san: string;
  readonly referencia: Calidad;
  readonly veredicto: Verdict;
  readonly mejorCoach: string;
  /** El coach ve el mate a favor que hay antes de la jugada (cuando la referencia lo tiene). */
  readonly mateAntes: boolean | null;
  /** El coach ve el mate en contra que permite la jugada (cuando la referencia lo tiene). */
  readonly mateDespues: boolean | null;
  readonly violaciones: readonly Violacion[];
  readonly texto: string;
  readonly ms: number;
}

const VEREDICTOS: readonly Verdict[] = ["mejor", "buena", "imprecision", "error", "error-grave"];
const esError = (v: Verdict): boolean => v === "error" || v === "error-grave";

export interface ResumenCoach {
  readonly analisis: number;
  /** Veredicto igual al que daría la referencia. */
  readonly veredictoIgual: number;
  /** Matriz de confusión: filas = referencia, columnas = coach. */
  readonly matriz: Readonly<Record<Verdict, Readonly<Record<Verdict, number>>>>;
  /** Errores graves según la referencia (caída ≥ 0,15) y cuántos marca el coach como Error o Error grave. */
  readonly gravesReferencia: number;
  readonly gravesDetectados: number;
  /** Jugadas equivalentes a la mejor que el coach llama Error o Error grave (falso positivo). */
  readonly equivalentes: number;
  readonly falsosPositivos: number;
  readonly listaFalsosPositivos: readonly string[];
  /** Jugadas que la referencia considera Error o peor y que el coach llama «Mejor jugada» o «Buena jugada». */
  readonly erroresNoVistos: number;
  readonly listaErroresNoVistos: readonly string[];
  /** La mejor jugada del coach coincide con la de la referencia (o es equivalente). */
  readonly mejorCoincide: number;
  readonly posicionesConMate: number;
  readonly matesVistos: number;
  readonly matesPermitidos: number;
  readonly matesPermitidosVistos: number;
  readonly violaciones: Readonly<Record<Regla, number>>;
  readonly informesConViolaciones: number;
  readonly msMedia: number;
  readonly msP95: number;
  readonly msMax: number;
}

export function resumirCoach(filas: readonly ResultadoCoach[], refs: Readonly<Record<string, PosicionReferencia>>): ResumenCoach {
  const matriz = Object.fromEntries(VEREDICTOS.map((r) => [r, Object.fromEntries(VEREDICTOS.map((c) => [c, 0]))])) as Record<Verdict, Record<Verdict, number>>;
  for (const f of filas) matriz[f.referencia.veredicto][f.veredicto]++;
  const graves = filas.filter((f) => f.referencia.veredicto === "error-grave");
  const equivalentes = filas.filter((f) => f.referencia.equivalente);
  const falsos = equivalentes.filter((f) => esError(f.veredicto));
  const noVistos = filas.filter((f) => esError(f.referencia.veredicto) && (f.veredicto === "mejor" || f.veredicto === "buena"));
  const violaciones = { "mejor-con-otra-mejor": 0, "aviso-y-sin-motivo": 0, "mate-en-contra-con-elogio": 0, "pieza-no-capturada": 0, "veredicto-contra-evaluacion": 0 } as Record<Regla, number>;
  for (const f of filas) for (const x of f.violaciones) violaciones[x.regla]++;
  const conMate = filas.filter((f) => f.mateAntes !== null);
  const permitidos = filas.filter((f) => f.mateDespues !== null);
  // Una vez por posición: ¿la mejor del coach es la de la referencia o equivalente?
  const porPosicion = new Map<string, ResultadoCoach>();
  for (const f of filas) if (!porPosicion.has(f.id)) porPosicion.set(f.id, f);
  let mejorCoincide = 0;
  for (const f of porPosicion.values()) {
    const ref = refs[f.id];
    if (ref !== undefined && jugadaRef(ref, f.mejorCoach) !== undefined && calidad(ref, f.mejorCoach).equivalente) mejorCoincide++;
  }
  const tiempos = filas.map((f) => f.ms).sort((a, b) => a - b);
  return {
    analisis: filas.length,
    veredictoIgual: filas.filter((f) => f.veredicto === f.referencia.veredicto).length,
    matriz,
    gravesReferencia: graves.length,
    gravesDetectados: graves.filter((f) => esError(f.veredicto)).length,
    equivalentes: equivalentes.length,
    falsosPositivos: falsos.length,
    listaFalsosPositivos: falsos.map((f) => `${f.id} ${f.san}: ${f.veredicto}`),
    erroresNoVistos: noVistos.length,
    listaErroresNoVistos: noVistos.map((f) => `${f.id} ${f.san}: ${f.veredicto} (referencia ${f.referencia.veredicto})`),
    mejorCoincide,
    posicionesConMate: conMate.length,
    matesVistos: conMate.filter((f) => f.mateAntes === true).length,
    matesPermitidos: permitidos.length,
    matesPermitidosVistos: permitidos.filter((f) => f.mateDespues === true).length,
    violaciones,
    informesConViolaciones: filas.filter((f) => f.violaciones.length > 0).length,
    msMedia: Math.round(media(tiempos)),
    msP95: Math.round(tiempos[Math.min(tiempos.length - 1, Math.floor(tiempos.length * 0.95))] ?? 0),
    msMax: Math.round(tiempos.at(-1) ?? 0),
  };
}

const media = (xs: readonly number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
const redondea = (x: number): number => Math.round(x * 10) / 10;

/** Semilla estable (FNV-1a de 32 bits) a partir del id, para el azar del nivel Fácil. */
export function semilla(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}
