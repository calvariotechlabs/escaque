// PreToolUse(Bash): bloquea push a main, push forzado, cambio de rama a main y
// borrados recursivos fuera de dist/.
import { readFileSync } from "node:fs";
const input = JSON.parse(readFileSync(0, "utf8"));
const cmd = String(input?.tool_input?.command ?? "");

const rules = [
  [/\bgit\s+push\b[^\n;&|]*\b(main|master)\b/, "push a main"],
  [/\bgit\s+push\b[^\n;&|]*(--force|-f)\b/, "push forzado"],
  [/\bgit\s+(checkout|switch)\s+(-[bcBC]\s+\S+\s+)?(main|master)\b/, "cambio de rama a main"],
];

/** Solo dist/ o algo dentro: «dist», «./dist/», «dist/tests». Nada con «..», variables ni comodines fuera. */
const DIST_PATH = /^(\.\/)?dist(\/[^\s$`]*)?$/;

/**
 * ¿Hay algún `rm` recursivo con un objetivo fuera de dist/? Se mira cada orden
 * de la línea (separadas por ; & | o saltos de línea) y basta un objetivo fuera
 * para bloquear: «rm -rf dist src» borra src aunque empiece por dist.
 */
function recursiveRmOutsideDist(command) {
  for (const segment of command.split(/[;&|\n]+/)) {
    const words = segment.trim().split(/\s+/).map((w) => w.replace(/^['"]|['"]$/g, ""));
    const at = words.findIndex((w) => w === "rm" || w.endsWith("/rm"));
    if (at === -1) continue;
    let recursive = false;
    let endOfOptions = false;
    const targets = [];
    for (const word of words.slice(at + 1)) {
      if (!endOfOptions && word === "--") endOfOptions = true;
      else if (!endOfOptions && word.startsWith("--")) recursive ||= word === "--recursive";
      else if (!endOfOptions && word.startsWith("-") && word.length > 1) recursive ||= /[rR]/.test(word);
      else targets.push(word);
    }
    if (recursive && targets.some((t) => !DIST_PATH.test(t) || t.split("/").includes(".."))) return true;
  }
  return false;
}

const blocked = rules.find(([re]) => re.test(cmd))?.[1] ?? (recursiveRmOutsideDist(cmd) ? "rm -r fuera de dist/" : null);
if (blocked !== null) {
  console.error(`Bloqueado por el hook del repo (${blocked}). Pide autorización explícita a Sergio.`);
  process.exit(2);
}
