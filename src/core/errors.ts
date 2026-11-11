/** FEN mal formada o que describe una posición imposible de cargar. */
export class FenError extends Error {
  override name = "FenError";
}

/** Error temporal del bloque 1: la interfaz existe, la implementación llega en el bloque 2. */
export class NotImplementedError extends Error {
  override name = "NotImplementedError";
  constructor(what: string) {
    super(`${what}: pendiente de implementar (hito 1, bloque 2)`);
  }
}
