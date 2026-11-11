// PostToolUse(Edit|Write): tras tocar un .ts, comprueba tipos.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const input = JSON.parse(readFileSync(0, "utf8"));
const file = String(input?.tool_input?.file_path ?? "");
if (!file.endsWith(".ts")) process.exit(0);
const r = spawnSync("npm", ["run", "--silent", "typecheck"], { encoding: "utf8" });
if (r.status !== 0) {
  console.error(r.stdout + r.stderr);
  process.exit(2);
}
