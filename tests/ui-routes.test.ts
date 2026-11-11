// Rutas por el fragmento de la URL.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lessonHash, parseRoute } from "../src/ui/routes.js";

describe("rutas", () => {
  it("sin fragmento o con fragmentos desconocidos, jugar", () => {
    for (const hash of ["", "#", "#/", "#/jugar", "#/otra", "#lecciones-no", "#/jugar/lecciones"]) assert.deepEqual(parseRoute(hash), { kind: "jugar" }, hash);
  });

  it("la lista de lecciones", () => {
    assert.deepEqual(parseRoute("#/lecciones"), { kind: "lecciones" });
    assert.deepEqual(parseRoute("#lecciones"), { kind: "lecciones" });
    assert.deepEqual(parseRoute("#/lecciones/"), { kind: "lecciones" });
  });

  it("una lección por su identificador", () => {
    assert.deepEqual(parseRoute("#/lecciones/mate-del-pasillo"), { kind: "leccion", id: "mate-del-pasillo" });
    assert.deepEqual(parseRoute(lessonHash("enroque")), { kind: "leccion", id: "enroque" });
  });

  it("un identificador raro o más ruta cae en la lista, nunca llega a la interfaz", () => {
    for (const hash of ["#/lecciones/<img>", "#/lecciones/A", "#/lecciones/a/b", "#/lecciones/%3Cb%3E", `#/lecciones/${"a".repeat(65)}`, "#/lecciones/-x"]) {
      assert.deepEqual(parseRoute(hash), { kind: "lecciones" }, hash);
    }
  });
});
