// Pruebas de la documentación viva (RC-09, issue #73): el README no puede decir algo distinto de lo que
// hay en el repositorio. Lo caro (contar todas las pruebas, medir el sitio) lo hace `npm run metrics:check`
// en la CI; aquí va lo barato y las propias reglas de comparación.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, test } from "node:test";
import {
  MARCA_FIN,
  MARCA_INICIO,
  MARGEN_TAMANO,
  comparar,
  extraerBloque,
  insertarBloque,
  renderizarBloque,
  resumenBanco,
} from "./metricas.mjs";

// Mientras `npm run metrics` cuenta las pruebas, el README y docs/metricas.json aún no están
// regenerados: esas pruebas se saltan (siguen contando) y las vuelve a pasar `npm test`.
const saltar = process.env.METRICAS_GENERANDO ? "se comprueba tras generar las cifras" : false;
const prueba = (nombre, fn) => test(nombre, { skip: saltar }, fn);

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const leer = (ruta) => readFileSync(join(ROOT, ruta), "utf8");
const readme = leer("README.md");
const metricas = JSON.parse(leer("docs/metricas.json"));

function listar(dir) {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listar(join(dir, e.name)) : [join(dir, e.name)],
  );
}

describe("cifras del README", () => {
  prueba("la tabla del README es exactamente la que sale de docs/metricas.json", () => {
    const bloque = extraerBloque(readme);
    assert.notEqual(bloque, null, "faltan las marcas de metricas en el README");
    assert.equal(bloque, renderizarBloque(metricas), "README desfasado: ejecuta `npm run metrics`");
  });

  prueba("las pruebas registradas pasaban todas cuando se generaron", () => {
    assert.equal(metricas.pruebas.fallan, 0);
    assert.ok(metricas.pruebas.total > 0 && metricas.pruebas.suites > 0);
  });

  prueba("dependencias en ejecución: el registro y package.json coinciden y son cero", async () => {
    const paquete = JSON.parse(leer("package.json"));
    assert.deepEqual(Object.keys(paquete.dependencies ?? {}), []);
    assert.equal(metricas.dependencias.enEjecucion, 0);
    assert.deepEqual(metricas.dependencias.desarrollo, Object.keys(paquete.devDependencies ?? {}).sort());
  });

  prueba("lecciones y posiciones de perft registradas coinciden con el código", async () => {
    const { LESSONS } = await import(pathToFileURL(join(ROOT, "dist/src/lessons/index.js")).href);
    assert.equal(metricas.lecciones.total, LESSONS.length);
    assert.equal(metricas.lecciones.primerosPasos, LESSONS.filter((l) => l.group === "primeros-pasos").length);
    assert.equal(metricas.lecciones.tacticas, LESSONS.filter((l) => l.group === "tacticas").length);
    const { PERFT_POSITIONS } = await import(pathToFileURL(join(ROOT, "dist/tests/perft-positions.js")).href);
    assert.equal(metricas.perft.posiciones, PERFT_POSITIONS.length);
    assert.equal(metricas.perft.comprobaciones, PERFT_POSITIONS.reduce((t, r) => t + r.full, 0));
  });

  prueba("las cifras del banco registradas son las del fichero de resultados que citan", () => {
    assert.deepEqual(metricas.banco, resumenBanco(metricas.banco.etiqueta));
    const posiciones = JSON.parse(leer("bench/posiciones.json"));
    assert.equal(metricas.banco.posiciones, (posiciones.posiciones ?? posiciones).length);
  });

  prueba("el número de ficheros de pruebas de extremo a extremo registrado es el real", () => {
    const reales = readdirSync(join(ROOT, "e2e")).filter((f) => f.endsWith(".e2e.mjs")).length;
    assert.equal(metricas.registrado.e2e.ficheros, reales);
  });

  prueba("la CI comprueba las cifras", () => {
    assert.match(leer(".github/workflows/ci.yml"), /npm run metrics:check/);
  });
});

describe("afirmaciones del README que se pueden contrastar", () => {
  prueba("toda mención «N lecciones» es el número real de lecciones", () => {
    const menciones = [...readme.matchAll(/\b(\d+) lecciones\b/g)].map((m) => Number(m[1]));
    assert.ok(menciones.length > 0);
    for (const n of menciones) assert.equal(n, metricas.lecciones.total);
    if (metricas.lecciones.total !== 6) assert.doesNotMatch(readme, /\bseis lecciones\b/i);
  });

  prueba("toda mención «banco de N posiciones» y «N posiciones de referencia» es la real", () => {
    const banco = [...readme.matchAll(/banco de (\d+) posiciones/g)].map((m) => Number(m[1]));
    assert.ok(banco.length > 0);
    for (const n of banco) assert.equal(n, metricas.banco.posiciones);
    for (const m of readme.matchAll(/(\d+) jugadas del banco/g)) assert.equal(Number(m[1]), metricas.banco.coach.analisis);
    for (const m of readme.matchAll(/\b(\d+) posiciones de referencia/g)) assert.equal(Number(m[1]), metricas.perft.posiciones);
  });

  prueba("el README no dice que el motor carece de una técnica que ya tiene", () => {
    const fuentes = [...listar("src/engine"), ...listar("src/core")].filter((f) => f.endsWith(".ts")).map((f) => leer(f)).join("\n");
    if (/makeNullMove|nullMove|NullMove/.test(fuentes)) {
      assert.doesNotMatch(readme, /no usa poda por jugada nula/i, "el motor ya usa jugada nula: actualiza «Fuerza del motor» y «Qué haría distinto»");
    }
    if (/\blmr\b|lateMoveReduction|reduccion(?:es)?\s*de\s*jugadas\s*tard/i.test(fuentes)) {
      assert.doesNotMatch(readme, /no usa[^.]*reducciones de jugadas tardías/i, "el motor ya reduce jugadas tardías: actualiza el README");
    }
  });

  prueba("no quedan cifras sueltas de pruebas ni de ficheros fuera de la tabla generada", () => {
    const fuera = readme.replace(extraerBloque(readme) ?? "", "");
    assert.doesNotMatch(fuera, /\b\d[\d.]* tests\b(?! de perft)/i, "cifra de tests escrita a mano: ponla en la tabla generada");
    assert.doesNotMatch(fuera, /\b\d+ ficheros, \d+ KB/, "tamaño del sitio escrito a mano: ponlo en la tabla generada");
  });

  prueba("README y diseño de docs/ apuntan a ficheros que existen", () => {
    for (const m of readme.matchAll(/\]\((docs\/[^)#\s]+|bench\/[^)#\s]+)\)/g)) {
      assert.ok(existsSync(join(ROOT, m[1])), `enlace roto en el README: ${m[1]}`);
    }
  });
});

describe("reglas de comparación", () => {
  const base = JSON.parse(JSON.stringify(metricas));

  test("coincide consigo mismo y tolera el margen de tamaño", () => {
    assert.deepEqual(comparar(base, metricas), []);
    const cerca = JSON.parse(JSON.stringify(base));
    cerca.sitio.bytes = Math.round(base.sitio.bytes * (1 + MARGEN_TAMANO / 2));
    assert.deepEqual(comparar(cerca, metricas), []);
  });

  test("detecta una prueba de más, una lección de menos y un tamaño fuera de margen", () => {
    const x = JSON.parse(JSON.stringify(base));
    x.pruebas.total += 1;
    x.lecciones.total -= 1;
    x.sitio.gzipJsCssHtmlBytes = Math.round(base.sitio.gzipJsCssHtmlBytes * (1 + MARGEN_TAMANO * 2));
    const dif = comparar(x, metricas);
    assert.equal(dif.length, 3);
    assert.match(dif.join("\n"), /pruebas/);
    assert.match(dif.join("\n"), /lecciones/);
    assert.match(dif.join("\n"), /gzipJsCssHtmlBytes/);
  });

  test("insertarBloque solo toca lo que hay entre las marcas y es idempotente", () => {
    const texto = `antes\n${MARCA_INICIO}\n\nviejo\n\n${MARCA_FIN}\ndespués\n`;
    const uno = insertarBloque(texto, "nuevo");
    assert.equal(uno, `antes\n${MARCA_INICIO}\n\nnuevo\n\n${MARCA_FIN}\ndespués\n`);
    assert.equal(insertarBloque(uno, "nuevo"), uno);
    assert.equal(insertarBloque("sin marcas", "x"), null);
  });
});
