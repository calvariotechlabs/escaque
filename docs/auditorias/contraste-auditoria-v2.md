# Contraste de la auditoría independiente de la RC (v2)

- Fecha: 24 de noviembre de 2026
- Informe contrastado: [auditoria-v2-2026-11-24.pdf](auditoria-v2-2026-11-24.pdf) (9 páginas, «Segunda auditoría», guardado tal como se entregó; el PDF no indica qué herramienta lo hizo).
- Commit auditado: `3050eb0108ed`, que es `main` en el momento del contraste (comprobado con `git rev-parse origin/main`).
- Issue: [#85](https://github.com/calvariotechlabs/escaque/issues/85). Criterios: apartado 12 de [informe-rc.md](informe-rc.md).
- Regla: nada se da por bueno sin evidencia propia. Producción devuelve 429 a este entorno (Bot Protection de Vercel), así que lo que solo se ve en producción queda como «evidencia del auditor» o «pendiente de Sergio».

## 1. Veredicto

**La RC queda aceptada con una condición y una decisión de Sergio.**

- Condición: fusionar la PR [#84](https://github.com/calvariotechlabs/escaque/pull/84). Arregla el único defecto que la auditoría reproduce sobre un caso original (13.Dd5+, H-08) y tiene la CI en verde (6 de 6 comprobaciones).
- Decisión: la prioridad P1 de la auditoría («enlazar cada afirmación material con la variante completa que la demuestra») va más allá de H-08. Cuando el «por qué» es la respuesta del rival, el panel enseña la línea de la mejor jugada, no la de la refutación (A-02). El texto es correcto, pero no se puede recorrer en el tablero. Arreglarlo es un cambio de interfaz y necesita diseño previo. Según el protocolo, un P1 se corrige antes de cerrar la RC. La alternativa es aprobarlo como excepción documentada, igual que H-14, H-02b y H-10.
- Sigue pendiente de Sergio, como antes de esta auditoría: cabeceras de producción completas (incluido que no haya `noindex`), móvil real, PWA instalada sin conexión y lector de pantalla.

| Criterio de aceptación (informe-rc §12) | Resultado | Evidencia |
|---|---|---|
| Ningún defecto P0 nuevo | **Cumple** | El auditor: «P0: ningún bloqueo de publicación observado». No he encontrado ninguno. |
| Los 11 casos originales no se reproducen, salvo H-14, H-02b y H-10 | **Cumple con #84 fusionada** | En `main`, H-08 se reproduce (A-01). En la rama de #84, no. El resto, como dice el auditor (A-14). |
| La huella del banco coincide; las pruebas y la CI pasan | **Cumple** | Huella `a9712a34`, la misma que en informe-rc §8. `npm test`: 1.167 pruebas, 1.165 pasan, 0 fallan, 2 `todo`. CI de #84: 6/6. Matiz: `metrics:check` falla con Node 24 (A-03). |
| Las cabeceras de producción coinciden con `vercel.json` y no hay `noindex` | **Parcial** | El auditor vio la CSP de origen propio, la protección contra marcos y HSTS. No revisó el conjunto completo ni `noindex`. Desde aquí, 429. Lo comprueba Sergio. |
| Hallazgos clasificados con la leyenda de la matriz | **Cumple** | Apartado 2. |

Desviaciones del protocolo, por transparencia: el auditor jugó 2 partidas completas contra Difícil (el protocolo pide 3) y es un solo auditor (el protocolo sugiere dos más uno ajeno). Ninguna invalida el resultado. Las anoto para que conste.

## 2. Matriz de hallazgos

Leyenda: **reproducido** (lo he ejecutado y sale lo mismo), **confirmado en código** (lo dice el código, sin ejecutarlo en la interfaz), **ya resuelto** (hay arreglo con evidencia), **discrepante** (mi medición no coincide), **pendiente de validación** (necesita producción o una persona), **recomendación** (no es un defecto), **conforme al diseño** (comportamiento buscado).

| ID | Hallazgo del auditor | Clasificación | Evidencia propia | Prioridad |
|---|---|---|---|---|
| A-01 | 13.Dd5+: «Dd3+ gana la dama a cambio de un caballo», pero la línea acaba en 14…Rf7, antes de Cxf6. El banco registra la misma discrepancia en `auditoria-h-08`. | **Reproducido en `main`, ya resuelto en #84** | `coach.mjs` en `main`: `line: 13. Dd3+ Re7 14. Cd5+ Rf7`. Banco en `main`: 1/152, `auditoria-h-08 Qd3+: pieza-no-capturada`. Rama de #84: `line: 13. Dd3+ Re7 14. Cd5+ Rf7 15. Cxf6+ Rxf6` y `--solo auditoria-h-08`: 0 contradicciones. Cubre las dos direcciones que pide el auditor (jugada hecha y alternativa). | P1 |
| A-02 | Criterio general P1: toda afirmación de captura y coste debe poder recorrerse en una línea legal. | **Confirmado en código y reproducido en una partida nueva** | `src/coach/analyze.ts:510`: si hay alternativa, el panel enseña `lines.best`, nunca `lines.played`. En la partida principal del auditor, 4.Ac4 dice «Tras Ac4, las negras responden 4… Dxg5 y ganan un caballo y un peón» y la línea es `4. h4 Cf6 5. Cc3 Dd4`. Es el caso que #84 dejó fuera (unos 20 de 268 informes, según su hilo). | P1 (decisión de Sergio) |
| A-03 | `npm run metrics:check` falla con Node 24.22.3 porque el resumen de `node --test` sale con el prefijo «ℹ» en vez de «#». | **Reproducido** | Node 22.23.5: sale con 0, «Cifras al día: 1167 pruebas». Node 24.22.3 (binario oficial, SHA-256 comprobado): sale con 1, «No se pudo leer el resumen de `node --test`». Una prueba mínima con Node 24 imprime `ℹ tests …`. `contarE2e()` tiene el mismo problema. La CI fija Node 22, así que no la rompe, pero `engines` admite `>=22.3`. Arreglo: `--test-reporter=tap` en los dos `spawnSync` de `tools/metricas.mjs` y una prueba del lector con los dos formatos. | P2 |
| A-04 | «No hay avisos en esta jugada» aparece justo debajo de un mate anunciado. | **Confirmado en código y reproducido** | `src/ui/coach-panel.ts:321-322`: el texto sale siempre que `findings` está vacío, sin mirar el veredicto. 6.d4 de la partida principal: «permite mate en 1», sin `findings`. Es un cambio de texto de interfaz: necesita diseño primero. | P3 |
| A-05 | La ficha pública `/projects/escaque` sigue en `main@5e9e946` y 1.045 pruebas, y dice que las auditorías «se citarán cuando estén en el README», cuando ya están. | **Reproducido** | `www.calvariotechlabs.com/projects/escaque` (200): «Verificado 24-11-2026 · main@5e9e946», «1.045 pruebas en 183 suites» y «Auditorías funcionales y técnicas … Pendiente». Hoy son 1.167 pruebas en 209 suites. La ficha no está en este repositorio. Además: el README todavía no cita esta segunda auditoría, y su línea 19 dice que el informe de la RC «va en su propia PR», cuando B10 ya está fusionado (#79, #80). | P2 |
| A-06 | `npm test`: 1.167 pruebas en 209 suites, 1.165 pasan, 0 fallos, 2 `todo`. H-14 pierde 485 cp con …Da5 y H-02b pasa en esa ejecución. | **Reproducido exacto** | Node 22: `# tests 1167`, `# suites 209`, `# pass 1165`, `# fail 0`, `# todo 2`. `d8a5 pierde 485 cp (profundidad 6)`. H-02b, `ok … # TODO`. `npm run typecheck`, sale con 0. | — |
| A-07 | Coach en el banco: 97/152 veredictos iguales, 20/23 graves detectados, 3/123 falsos positivos y la contradicción H-08. | **Reproducido exacto** | `npm run bench:posiciones` en `main`: las cuatro cifras coinciden, huella `a9712a34`. | — |
| A-08 | Difícil en el banco: 49/82 mejores, 71/82 equivalentes, 1 error táctico de más de 2 peones, 18/18 mates, 750 ms de media y 1.009 ms de máximo. «No lo presentaría como garantía inferior a un segundo.» | **Discrepante dentro de lo esperado, y recomendación** | En mi ejecución (4 núcleos): 50/82, 70/82, 1 error (solo H-14), 18/18, 748 ms de media y 903 ms de máximo. Difícil depende del reloj, así que la variación es normal. No he reproducido un máximo por encima de 1 s. La recomendación es válida: el README da «3 errores» (`despues-b11`) y el informe de la RC da «1» (§8). Conviene presentarlo como un rango y decir siempre que depende del equipo. | P2 (texto) |
| A-09 | 2.g4 (control): «Buena jugada» por medio peón y «no encuentra un motivo concreto». | **Reproducido; conforme al diseño** | `loss=48`, «Buena jugada», «Alfil Beta la prefiere por poco (−0,9 frente a −1,4)». La curva logística lo deja por debajo del umbral de imprecisión. Mejora pedagógica posible: explicar la debilidad del rey. | P3 |
| A-10 | 6.d4 permite mate en 1 y se califica como «Error», no «Error grave». | **Reproducido; conforme al diseño** | `loss=9489`, veredicto «Error» con −5,1 antes: en puntos esperados, una posición ya perdida cae poco. El auditor no lo trata como defecto. Lo anoto porque al lado de 2.g4 («Error grave») puede chocar a quien aprende. | Recomendación |
| A-11 | 16.Ab5+: ya no dice que el jaque salvó la dama, pero sigue siendo poco instructivo (0,1 peones, sin motivo concreto). | **Reproducido** | «Buena jugada … no encuentra un motivo concreto que explicarte.» Es la honestidad buscada en B1. | Recomendación |
| A-12 | Falsos positivos en sacrificios: el griego y el Traxler. | **Reproducido; limitación conocida** | Banco: «sacrificio-griego Bxh7+: error-grave; sacrificio-traxler Bxf7+: error-grave». Ya figura en las limitaciones del README. | Recomendación |
| A-13 | `src/coach/invariants.ts` solo se ejecuta en pruebas y en el banco, no en el panel de producción. | **Confirmado en código; conforme al diseño** | `checkInvariants` se exporta en `src/coach/index.ts` y no se llama desde `src/ui` ni desde `src/worker`. | Recomendación |
| A-14 | Corregidos: mate del loco (H-01), dos mejores jugadas (H-02), mate inevitable (H-04) y jaque intermedio (H-09). | **Reproducido** | `coach.mjs`: H-01 «Error grave … 2… Dh4#»; H-02 «Mejor jugada», `loss=0`; H-04 «Mejor jugada» con su mensaje de mate inevitable; H-09 sin la frase de la dama a salvo. | — |
| A-15 | Reglas, PGN de ida y vuelta, persistencia, deshacer y rehacer, confirmación, niveles, giro, lecciones de al paso y subcoronación, accesibilidad observable. | **Evidencia del auditor en producción** | No se puede repetir en producción desde aquí (429). Lo cubren las pruebas e2e de la CI (job «Accesibilidad de extremo a extremo», en verde en #84) y B6. Sin discrepancias. | — |
| A-16 | El service worker de producción coincide byte a byte con el del sitio generado. El sitio tiene 92 ficheros. | **Parcial** | `metrics:check`: «92 ficheros en el sitio». El SHA-256 de producción no se puede comprobar desde aquí (429). | — |
| A-17 | No probó teléfono físico, lector de pantalla, instalación ni recarga sin red. | **Pendiente de validación (Sergio)** | Igual que en informe-rc §6. | P2 |
| A-18 | Recomendaciones de UX: flecha h4–e1 en el mate del loco, patrón «mostrar la amenaza y reintentar», panel largo difícil de comparar con el tablero, texto sobre seguridad del rey. | **Recomendación** | Todas son de interfaz y requieren diseño previo. | P3 |

Observación propia, fuera de la auditoría: en 4.Ac4, el resumen dice «Ac4 deja el alfil sin protección», pero el «por qué» habla de ganar el caballo con Dxg5. Las dos cosas son verdad, porque la dama de d5 ataca c4 y g5. Aun así, el panel pone el acento en una pieza y la refutación en otra. Entra en A-02.

## 3. Backlog priorizado

| Orden | Qué | Tipo | Bloquea la RC | Necesita |
|---|---|---|---|---|
| 1 | Fusionar #84 (H-08) | Código ya hecho | **Sí** | OK de Sergio |
| 2 | Línea de la refutación visible cuando el «por qué» es la respuesta del rival (A-02) | Diseño y luego código | Sí según el protocolo, salvo excepción aprobada | Decisión de Sergio y diseño en Claude Design |
| 3 | `metrics:check` compatible con Node 22 y 24: `--test-reporter=tap` y prueba del lector (A-03); valorar Node 24 en la matriz de CI | Código pequeño | No | — |
| 4 | Ficha pública al día (commit, 1.167 pruebas, auditorías fechadas y enlazadas). README: citar esta segunda auditoría, corregir la línea 19 y dar las cifras de Difícil como rango (A-05, A-08) | Documentación (la ficha vive en otro repositorio) | No | — |
| 5 | Cabeceras completas en producción, móvil real, PWA sin conexión y lector de pantalla (A-17) | Prueba manual | Criterio de cabeceras: sí | Sergio |
| 6 | Ocultar «No hay avisos» cuando ya se ha anunciado un mate (A-04) | Diseño y luego código | No | Diseño |
| 7 | Mejoras pedagógicas: flecha de la amenaza, reintentar el movimiento, texto de seguridad del rey (A-09, A-18) | Diseño y luego código | No | Diseño |

## 4. Cómo se reprodujo

Entorno: contenedor Linux con 4 núcleos, Node 22.23.5 (el de la CI) y Node 24.22.3 (binario oficial de nodejs.org, SHA-256 comprobado con `SHASUMS256.txt`).

```sh
git rev-parse origin/main                     # 3050eb0108edd3a6f68a7dea5226a455a109bd2c
npm ci && npm run typecheck && npm test       # 1167 / 209 / pass 1165 / fail 0 / todo 2
npm run metrics:check                         # Node 22: sale con 0 · Node 24: sale con 1
npm run bench:posiciones                      # huella a9712a34
npm run build
node docs/auditorias/reproduccion/coach.mjs "$PWD" docs/auditorias/reproduccion/casos.json
node docs/auditorias/reproduccion/coach.mjs "$PWD" docs/auditorias/reproduccion/casos-v2.json
# Rama de #84 (claude/project-thread-k3m9tt, 47901f1): los mismos casos y
npm run bench:posiciones -- --solo auditoria-h-08   # 0 contradicciones
```

`reproduccion/casos-v2.json` contiene las jugadas de las dos partidas nuevas del auditor: 2.g4 de la partida de control, y 4.Ac4 y 6.d4 de la principal.
