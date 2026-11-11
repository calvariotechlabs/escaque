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
  // Fuera redirecciones con su destino («2>&1», «>/dev/null», «&> log», «>&2»): no son
  // objetivos del borrado, y su «&» no separa órdenes.
  const withoutRedirections = command.replace(/(?:\d*|&)[<>]{1,2}&?\s*[^\s;&|<>()`]*/g, " ");
  for (const segment of withoutRedirections.split(/[;&|\n]+/)) {
    // Sin comillas alrededor ni el cierre de un subshell o bloque: «'src'», «dist)».
    const words = segment
      .trim()
      .split(/\s+/)
      .map((w) => w.replace(/^['"]|['"]$/g, "").replace(/[)}]+$/, ""));
    // «rm» también tras «(», «$(», «`», «{», «x=» o la «\» que salta un alias.
    const isRm = (w) => {
      const name = w.replace(/^.*[=($`{\\]/, "");
      return name === "rm" || name.endsWith("/rm");
    };
    // Cada «rm» del trozo, con sus palabras hasta el siguiente «rm».
    for (let at = words.findIndex(isRm); at !== -1; ) {
      const next = words.findIndex((w, i) => i > at && isRm(w));
      const args = words.slice(at + 1, next === -1 ? undefined : next);
      if (rmOutsideDist(args)) return true;
      at = next;
    }
  }
  return false;
}

/** ¿Borran estos argumentos de `rm` algo fuera de dist/ de forma recursiva? */
function rmOutsideDist(args) {
  let recursive = false;
  let endOfOptions = false;
  const targets = [];
  for (const word of args) {
    if (word === "") continue;
    if (!endOfOptions && word === "--") endOfOptions = true;
    // GNU acepta abreviaturas de opciones largas: «--rec» es «--recursive».
    else if (!endOfOptions && word.startsWith("--")) recursive ||= word.length >= 3 && "--recursive".startsWith(word);
    else if (!endOfOptions && word.startsWith("-") && word.length > 1) recursive ||= /[rR]/.test(word);
    else targets.push(word);
  }
  if (!recursive) return false;
  // Sin objetivos a la vista vienen de otra parte («xargs rm -rf»): no se puede comprobar.
  return targets.length === 0 || targets.some((t) => !DIST_PATH.test(t) || t.split("/").includes(".."));
}

const blocked = rules.find(([re]) => re.test(cmd))?.[1] ?? (recursiveRmOutsideDist(cmd) ? "rm -r fuera de dist/" : null);
if (blocked !== null) {
  console.error(`Bloqueado por el hook del repo (${blocked}). Pide autorización explícita a Sergio.`);
  process.exit(2);
}
