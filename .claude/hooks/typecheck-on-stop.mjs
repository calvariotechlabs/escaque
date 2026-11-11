// Stop: comprueba tipos antes de dar el trabajo por terminado (una sola vez por parada).
// No ejecuta `npm test`: durante el hito 1 los tests de referencia están en rojo a propósito
// (se escribieron antes que la implementación). Las pruebas se ejecutan a mano y en CI.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const input = JSON.parse(readFileSync(0, "utf8"));
if (input?.stop_hook_active) process.exit(0);
const r = spawnSync("npm", ["run", "--silent", "typecheck"], { encoding: "utf8" });
if (r.status !== 0) {
  console.error("typecheck falla; corrígelo antes de terminar:\n" + (r.stdout + r.stderr).slice(-3000));
  process.exit(2);
}
