// Rutas de la app, por el fragmento de la URL (#/jugar, #/lecciones, #/lecciones/<id>).
// Sin DOM y sin servidor: es una web estática. Lo que no se reconoce vale como «jugar».

export type Route =
  | { readonly kind: "jugar" }
  | { readonly kind: "lecciones" }
  | { readonly kind: "leccion"; readonly id: string };

export const PLAY_HASH = "#/jugar";
export const LESSONS_HASH = "#/lecciones";

/** Los identificadores de lección son letras minúsculas, cifras y guiones. */
const LESSON_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/");
  if (parts[0] === "lecciones" && parts.length === 1) return { kind: "lecciones" };
  if (parts[0] === "lecciones" && parts.length === 2 && parts[1] !== undefined && LESSON_ID.test(parts[1])) return { kind: "leccion", id: parts[1] };
  if (parts[0] === "lecciones") return { kind: "lecciones" };
  return { kind: "jugar" };
}

export function lessonHash(id: string): string {
  return `${LESSONS_HASH}/${id}`;
}
