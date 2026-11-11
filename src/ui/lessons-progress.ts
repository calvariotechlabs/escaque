// Progreso de las lecciones guardado en el dispositivo (localStorage), sin DOM.
// Lo leído del almacenamiento no es de confianza: solo se aceptan lecciones
// conocidas y números de pistas razonables; lo demás se descarta.
import type { KeyValueStore } from "./save.js";

export const PROGRESS_KEY = "escaque:lecciones";
const VERSION = 1;
const MAX_RAW_LENGTH = 10_000;
const MAX_HINTS = 99;

export type LessonState = "sin-empezar" | "en-curso" | "completada";

export interface LessonProgress {
  /** Lecciones completadas y las pistas de su mejor vez. */
  readonly done: ReadonlyMap<string, number>;
  /** La lección abierta sin completar, o `null`. */
  readonly current: string | null;
  /** Lecciones completadas que esta versión no conoce (renombradas o quitadas): se conservan por si vuelven. */
  readonly kept: ReadonlyMap<string, number>;
}

export const EMPTY_PROGRESS: LessonProgress = { done: new Map(), current: null, kept: new Map() };
const MAX_KEPT = 50;
const ID_SHAPE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function stateOf(progress: LessonProgress, id: string): LessonState {
  if (progress.done.has(id)) return "completada";
  return progress.current === id ? "en-curso" : "sin-empezar";
}

/** Marca `id` como la lección abierta, salvo que ya esté completada (entonces no cambia nada). */
export function openLesson(progress: LessonProgress, id: string): LessonProgress {
  if (progress.done.has(id) || progress.current === id) return progress;
  return { ...progress, current: id };
}

/** Marca `id` como completada con `hints` pistas; si ya lo estaba, se queda la mejor vez (las menos pistas). Si era la abierta, deja de serlo. */
export function completeLesson(progress: LessonProgress, id: string, hints: number): LessonProgress {
  const done = new Map(progress.done);
  const used = Math.max(0, Math.min(MAX_HINTS, Math.trunc(hints)));
  done.set(id, Math.min(used, progress.done.get(id) ?? used));
  return { ...progress, done, current: progress.current === id ? null : progress.current };
}

export function completedCount(progress: LessonProgress, ids: readonly string[]): number {
  return ids.filter((id) => progress.done.has(id)).length;
}

export function serializeProgress(progress: LessonProgress): string {
  return JSON.stringify({ v: VERSION, done: Object.fromEntries([...progress.kept, ...progress.done]), current: progress.current });
}

/** Reconstruye el progreso, o `EMPTY_PROGRESS` si el texto no vale. Ignora lecciones que ya no existen. */
export function parseProgress(raw: unknown, knownIds: readonly string[]): LessonProgress {
  if (typeof raw !== "string" || raw.length > MAX_RAW_LENGTH) return EMPTY_PROGRESS;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return EMPTY_PROGRESS;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return EMPTY_PROGRESS;
  const { v, done, current } = data as Record<string, unknown>;
  if (v !== VERSION || typeof done !== "object" || done === null || Array.isArray(done)) return EMPTY_PROGRESS;
  const known = new Set(knownIds);
  const result = new Map<string, number>();
  for (const id of knownIds) {
    const hints = (done as Record<string, unknown>)[id];
    if (Object.hasOwn(done, id) && typeof hints === "number" && Number.isInteger(hints) && hints >= 0 && hints <= MAX_HINTS) result.set(id, hints);
  }
  // Lo que no es de esta versión se guarda aparte (con el mismo control) para no perderlo al volver a escribir.
  const kept = new Map<string, number>();
  for (const [id, hints] of Object.entries(done as Record<string, unknown>)) {
    if (kept.size >= MAX_KEPT) break;
    if (!known.has(id) && ID_SHAPE.test(id) && typeof hints === "number" && Number.isInteger(hints) && hints >= 0 && hints <= MAX_HINTS) kept.set(id, hints);
  }
  const open = typeof current === "string" && known.has(current) && !result.has(current) ? current : null;
  return { done: result, current: open, kept };
}

/** Lee el progreso. Una entrada corrupta se borra para no tropezar con ella cada vez. */
export function loadProgress(store: KeyValueStore | null, knownIds: readonly string[]): LessonProgress {
  if (store === null) return EMPTY_PROGRESS;
  try {
    const raw = store.getItem(PROGRESS_KEY);
    if (raw === null) return EMPTY_PROGRESS;
    const progress = parseProgress(raw, knownIds);
    if (progress === EMPTY_PROGRESS && raw !== serializeProgress(EMPTY_PROGRESS)) store.removeItem(PROGRESS_KEY);
    return progress;
  } catch {
    return EMPTY_PROGRESS;
  }
}

/** Guarda el progreso; si no hay almacenamiento o falla (cuota, modo privado), no pasa nada. */
export function saveProgress(store: KeyValueStore | null, progress: LessonProgress): void {
  if (store === null) return;
  try {
    store.setItem(PROGRESS_KEY, serializeProgress(progress));
  } catch {
    // El progreso sigue en memoria; solo se pierde al cerrar la app.
  }
}
