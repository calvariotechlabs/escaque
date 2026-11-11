// Acceso tipado a lo poco que usamos de Node (proceso y node:fs) sin añadir @types/node
// ni declaraciones globales: así src/core y src/engine no pueden usar Node por accidente
// sin que el compilador lo note. Solo para tools/ y tests/.

export interface NodeFs {
  readFileSync(path: string, encoding: "utf8"): string;
}

export interface NodeProcess {
  readonly argv: readonly string[];
  readonly env: Readonly<Record<string, string | undefined>>;
  exitCode?: number;
  readonly stdout: { write(text: string): unknown };
  readonly stderr: { write(text: string): unknown };
  /** Node >= 22.3. */
  getBuiltinModule(id: "node:fs"): NodeFs;
}

/** El objeto `process` de Node; lanza si no se ejecuta en Node. */
export function nodeProcess(): NodeProcess {
  const proc = (globalThis as { process?: NodeProcess }).process;
  if (proc === undefined) throw new Error("Esta herramienta necesita Node.js");
  return proc;
}
