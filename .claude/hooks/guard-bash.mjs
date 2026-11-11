// PreToolUse(Bash): bloquea push a main, cambio de rama a main y borrados fuera de dist/.
import { readFileSync } from "node:fs";
const input = JSON.parse(readFileSync(0, "utf8"));
const cmd = String(input?.tool_input?.command ?? "");
const rules = [
  [/\bgit\s+push\b[^\n;&|]*\b(main|master)\b/, "push a main"],
  [/\bgit\s+push\b[^\n;&|]*(--force|-f)\b/, "push forzado"],
  [/\bgit\s+(checkout|switch)\s+(-[bcBC]\s+\S+\s+)?(main|master)\b/, "cambio de rama a main"],
  [/\brm\s+-[a-zA-Z]*[rR][a-zA-Z]*\s+(?!(\.\/)?dist\/?(\s|$))/, "rm -r fuera de dist/"],
];
for (const [re, what] of rules) {
  if (re.test(cmd)) {
    console.error(`Bloqueado por el hook del repo (${what}). Pide autorización explícita a Sergio.`);
    process.exit(2);
  }
}
