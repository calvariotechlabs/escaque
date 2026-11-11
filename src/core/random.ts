// Generador de números pseudoaleatorios propio (algoritmo mulberry32).
// Rápido, con semilla y reproducible: lo usan las claves Zobrist y el azar
// controlado del nivel fácil del motor. No sirve para criptografía.

/** Devuelve una función que da enteros sin signo de 32 bits, siempre la misma serie para la misma semilla. */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}
