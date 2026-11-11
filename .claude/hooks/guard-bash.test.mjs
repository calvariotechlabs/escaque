// Tests del hook guard-bash.mjs: se ejecuta como lo hace Claude Code, con la
// llamada en JSON por la entrada estándar. Código 2 = bloqueado, 0 = permitido.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HOOK = fileURLToPath(new URL("./guard-bash.mjs", import.meta.url));

function exitCode(command) {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command } }),
    encoding: "utf8",
  });
  return r.status;
}

describe("guard-bash: borrados recursivos", () => {
  const blocked = [
    "rm -rf src",
    "rm -r tests",
    "rm -rf dist src",
    "rm -rf src dist",
    "rm -rf ./dist ./src",
    "rm -rf dist/ ../escaque",
    "rm -rf dist/../src",
    "rm -rf /",
    "rm -rf ~",
    "rm -rf $HOME",
    "rm -rf *",
    "rm -rf dist/$X",
    "rm -rf dist/`pwd`",
    "rm -Rf src",
    "rm -fr src",
    "rm -f -r src",
    "rm --recursive src",
    "rm --recursive --force src",
    "rm -rf -- src",
    "npm run build && rm -rf dist src",
    "echo ok; rm -rf src",
    "cd /tmp && /bin/rm -rf src",
    "sudo rm -rf src",
    "rm -rf 'src'",
    'rm -rf "dist" "src"',
    "(rm -rf src)",
    "echo $(rm -rf src)",
    "echo `rm -rf src`",
    "\\rm -rf src",
    "rm --rec src",
    "rm --r src",
    "{ rm -rf src; }",
    "rm -rf dist 2>/dev/null; rm -rf src",
    "rm -rf 2>&1 src",
    "rm -rf >/dev/null 2>&1 src",
    "rm -rf >&2 src",
    "rm -rf &>/dev/null src",
    "out=$(rm -rf src)",
    "x=`rm -rf src`",
    "echo rm -- $(rm -rf src)",
    "rm -f notas.txt && rm -rf src",
    "xargs rm -rf < lista",
    "cat lista | xargs rm -rf",
  ];
  for (const command of blocked) {
    it(`bloquea: ${command}`, () => assert.equal(exitCode(command), 2));
  }

  const allowed = [
    "rm -rf dist",
    "rm -rf dist/",
    "rm -rf ./dist",
    "rm -rf dist/tests",
    "rm -rf dist dist/tests",
    "rm --recursive --force dist",
    "rm -rf -- dist",
    "rm -f notas.txt",
    "npm test",
    "git status",
    "echo terminar",
    "npm run build && rm -rf dist",
    "rm -rf dist 2>/dev/null",
    "rm -rf dist >/dev/null 2>&1",
    "rm -rf dist > salida.log",
    "rm -rf >/dev/null 2>&1 dist",
    "out=$(rm -rf dist 2>&1)",
  ];
  for (const command of allowed) {
    it(`permite: ${command}`, () => assert.equal(exitCode(command), 0));
  }
});

describe("guard-bash: reglas de git", () => {
  it("bloquea push a main", () => assert.equal(exitCode("git push origin main"), 2));
  it("bloquea push forzado", () => assert.equal(exitCode("git push --force origin rama"), 2));
  it("bloquea cambiar a main", () => assert.equal(exitCode("git checkout main"), 2));
  it("permite push a una rama de trabajo", () => assert.equal(exitCode("git push -u origin claude/rama"), 0));
});
