# Escaque · Consolidación de auditorías y plan de la Release Candidate

- Fecha: 24 de noviembre de 2026
- Commit analizado: `5e9e946` (main, PR #57). Es el mismo commit que revisaron las dos auditorías: desde entonces no ha cambiado nada en main.
- Tarea: CAL-408
- Fuentes: [auditoría de ChatGPT](auditoria-chatgpt-2026-11-24.pdf) (11 páginas) y [auditoría de Claude](auditoria-claude-2026-11-24.md) ([original](https://claude.ai/artifact/7MJRot4Q9t4PvwxriCp1bE)). Se conservan sin cambios como evidencia.
- Alcance de esta fase: análisis, reproducción y plan. No se ha cambiado código.

## 1. Resumen

Las dos auditorías coinciden en lo esencial: reglas, arquitectura, pruebas y seguridad son sólidas, y el punto débil es el entrenador. He reproducido en Node, con el código del commit auditado y la profundidad real del coach, **los 11 casos del entrenador que citan** (tabla de la sección 3), y he contrastado las 12 posiciones (incluido el error del motor) con Stockfish 17.1 a profundidad 20.

Resultado: los defectos del coach no son 11 fallos sueltos. Salen de **cuatro causas raíz**:

1. **Nadie mira la respuesta del rival.** El coach explica por qué la *mejor* jugada es buena, pero no qué *permite* la jugada hecha. Por eso el mate del loco (2.g4) acaba en «No hay un motivo táctico».
2. **No hay una decisión única de qué mensaje manda.** Veredicto, «Mejor jugada: X», «Por qué», elogio y avisos se calculan por separado y nadie comprueba que no se contradigan.
3. **El veredicto confunde «misma puntuación» con «misma jugada»** y trata todos los mates como ±10.000 centipeones en una curva que se aplana.
4. **El coach mira menos que el rival al que comenta** (profundidad 4 fija; Difícil llega a 4-6 en 0,9 s) y da veredictos graves sin confirmarlos.

Además hay dos defectos de calidad (las pruebas de tiempo fallan con cobertura y los límites de PGN y del Worker no coinciden), el README desfasado y las validaciones que ninguna auditoría pudo hacer (PWA sin conexión, dispositivos reales, lector de pantalla, cabeceras medidas).

## 2. Matriz consolidada de hallazgos

Leyenda de estado: **Reproducido** (lo he visto en esta revisión), **Confirmado en código** (se ve en el código sin necesidad de ejecutar), **Pendiente de validación** (no se puede comprobar aquí o hace falta una persona o un dispositivo), **Recomendación** (no es un defecto). Ninguno de los hallazgos estaba ya resuelto: main no ha cambiado desde el commit auditado.

| ID | Hallazgo | ChatGPT | Claude | Relación | Estado | Prioridad |
|---|---|---|---|---|---|---|
| H-01 | Mate recibido explicado como «no hay un motivo táctico» (1.f3 e5 2.g4) | A (alta) | — | Única, misma familia que H-03 | Reproducido | P0 |
| H-02 | «Mejor jugada» y debajo «Mejor jugada: otra» (2.Cf3) | B (media) | ESC-02 (alta) | Duplicada | Reproducido en 2.Cf3. El caso 12.dxe5 de Claude no sale igual a profundidad 4 (ver nota 1) | P0 |
| H-03 | «No hay un motivo táctico» junto a un aviso de dama colgando (4.Dg5) | — | ESC-04 (media) | Complementaria de H-01 | Reproducido | P0 |
| H-04 | Elogio material («gxf5 gana una pieza», «Mejor jugada») en una posición con mate en 1 en contra (40.gxf5) | D (media) | — | Única | Reproducido | P0 |
| H-05 | «Buena jugada» tras regalar una torre con la partida perdida (32.Tc8+) | — | ESC-06 (media) | Misma causa que H-04 (mates) | Reproducido (a prof. 4 sale «Buena» con aviso de torre colgando; Stockfish: mate en 8 frente a mate en 5) | P0 |
| H-06 | Sacrificio correcto calificado de «Error grave» (6.Cxf7 en el Fegatello) | Menciona que trata mal la compensación | ESC-01 (alta) | Complementaria; ya la señaló la revisión visual 2 (CAL-401, sacrificio de Morphy) | Reproducido. Stockfish: 6.Cxf7 es la mejor (+0,87) | P0 (no penalizar sin confirmar) / P1 (más profundidad) |
| H-07 | «Pieza colgando» que ignora una clavada (13.O-O, peón de e5) | — | ESC-03 (media) | Única | Reproducido. Stockfish: 13.O-O es la mejor (+6,42 frente a +6,53) | P1 |
| H-08 | «Gana una torre» cuando la línea no captura ninguna torre (13.Dd3+) | C (media) | — | Única | Reproducido y confirmado en código (`amount()` traduce 420-699 cp a «una torre») | P0 |
| H-09 | «Pone a salvo la dama» con un jaque que solo aplaza la amenaza (16.Ab5+) | D (media) | — | Única | Reproducido el texto. El veredicto es correcto: Stockfish da Ab5+ como la mejor | P1 |
| H-10 | Error táctico del rival explicado como posicional (12…Df6, que permite Dd3+ y Cd5+) | Mencionado | — | Misma causa que H-01 | Reproducido | P0 |
| H-11 | Evaluaciones distintas de la misma posición en dos búsquedas seguidas (+1,1 y +2,2) | Mencionado | — | Única | Pendiente de medir (ver nota 2) | P1 |
| H-12 | El coach analiza menos que el rival y su resultado depende del dispositivo | — | Causa de ESC-01 | Complementaria de H-06 | Confirmado en código y medido: profundidad 4 fija; en 12.dxe5 tardó 3,7 s en Node, por encima del tope de 3 s | P1 |
| H-13 | El coach no nombra el ahogado cuando es la causa del error | — | ESC-09 (baja) | Única | Pendiente de reproducir | P2 |
| H-14 | Alfil Beta comete errores de 3-4 peones en posiciones abiertas (10…Da5) | Lo insinúa | ESC-05 (media) | Duplicada | Reproducido. Stockfish: −3,58 frente a +0,80 de 10…Ca6 | Decisión de Sergio (ver 6) |
| H-15 | Difícil es determinista: la misma línea gana siempre | — | ESC-11 (baja) | Única | Confirmado en código (`marginCp: 0`); es una decisión de diseño | Decisión de Sergio |
| H-16 | Una jugada ilegal no muestra ningún mensaje | — | ESC-07 (baja) | Única | Confirmado en código (`deselect()`) | P2 |
| H-17 | El PGN en notación española se rechaza con un mensaje engañoso | — | ESC-08 (baja) | Única | Reproducido: «La jugada 2. Cf3 no es legal en esa posición.» | P2 |
| H-18 | README desfasado: 894 tests, 150 suites, 64 ficheros, «seis lecciones», coach «como mucho 0,6 s» | E (baja) | ESC-10 (baja) | Duplicada | Confirmado (README líneas 11, 15, 24, 35 y 197). Medido hoy: 1.045 tests en 183 suites, 90 ficheros en `site/` (ChatGPT contó 89), 15 lecciones (9 de primeros pasos y 6 tácticas), 3 s | P2 |
| H-19 | Tres aserciones de tiempo fallan al medir cobertura | Sí | — | Única | Reproducido 2 de 3 (ver nota 3) | P1 |
| H-20 | Límites distintos: el PGN admite 1.200 medias jugadas y los Workers 1.000 | Lo señala como riesgo | — | Única | Confirmado en código (`PGN_MAX_PLIES = 1200`, `MAX_MOVES = 1000`). Una partida importada de más de 1.000 medias jugadas no se podría repasar | P2 |
| H-21 | Cabeceras de seguridad en producción | Observadas en una respuesta real | Solo leídas en vercel.json | Discrepante | Pendiente: un `curl` automático recibe el desafío de Vercel (429), así que hay que medirlas desde un navegador o una URL de despliegue | P2 |
| H-22 | PWA instalada, sin conexión, actualización del service worker, móvil físico, lector de pantalla | No verificado | No verificado | Duplicada | Pendiente de validación (parte automatizable, parte humana) | P2 |
| H-23 | Panel del coach demasiado denso; en móvil hay que bajar mucho | Sí | Sí | Duplicada | Recomendación. Es un rediseño: no entra en la RC salvo que lo pidas | Fuera de la RC |
| H-24 | Repaso lento (27 s en una partida de 70 medias jugadas frente a los 8 s del README) | — | Sí, con el panel oculto | Única | Pendiente de medir con el banco (las condiciones no eran comparables) | P2 |
| H-25 | Sin aviso legal ni de privacidad | — | Recomendación | Única | Recomendación; encaja en el bloque de marca (enlace del pie) | P2 |
| H-26 | Medir por separado el tiempo del motor y el tiempo hasta ver la respuesta | Recomendación | — | Única | Recomendación para la documentación | P2 |

Lo que ambas confirman como correcto y no requiere trabajo: reglas (perft, enroque, al paso, coronación, mate, ahogado, triple repetición), legalidad, persistencia, PGN de ida y vuelta, lecciones, teclado y anuncios, cero dependencias, `npm audit` limpio, CSP estricta y CI con permisos mínimos.

**Discrepancias entre auditores y cómo las resuelvo:**

- **Prioridad del coach.** ChatGPT reserva P0 para fallos de legalidad y pone el coach en P1; Claude lo pone en P0. Sigo tu encargo: la coherencia del entrenador es P0.
- **Qué es «la mejor jugada» en 12.dxe5.** Claude vio «Mejor jugada» con «Mejor jugada: Tb1» debajo. En Node, a profundidad 4 sin reloj, el coach elige dxe5 como mejor y no se contradice. La línea que muestra sí empieza por 13.Tb1. Mi hipótesis es que en el navegador la búsqueda se cortó antes por el reloj y salió otra jugada. La causa raíz (H-02) es la misma y está reproducida en 2.Cf3.
- **Cabeceras.** ChatGPT las vio servidas; Claude no pudo. Las dos cosas son ciertas en su entorno. Queda pendiente medirlas de forma reproducible.
- **Nota global.** ChatGPT da 9/10 como portfolio y 5/10 al coach; Claude, 8,0 global y 5,0 al coach. Coinciden en el coach.

Nota 1. 12.dxe5 en Node: «Mejor jugada. dxe5 gana un peón», línea «12. dxe5 Ac7 13. Tb1 Ca6». Stockfish da 12.axb4 (+5,63) por delante de 12.dxe5 (+3,58): el coach no ve la mejor jugada, pero en esta ejecución no se contradice.

Nota 2. El coach mide la posición de antes a profundidad *d* y la de después a *d − 1* desde el otro bando. Los dos números no tienen por qué coincidir (efecto par-impar). Se medirá con el banco de posiciones antes de cambiar nada.

Nota 3. `node --test --experimental-test-coverage` sobre motor y coach: fallan «Difícil responde en menos de 1 s» (Kiwipete: 916 ms pero solo profundidad 2) y «respeta el límite de tiempo» (420 ms con un tope de prueba de 400 ms). «Medio no pasa de 0,5 s» pasó en mi ejecución, pero va justo. Sin cobertura pasan las 52. La instrumentación hace el código unas 3 veces más lento y estas pruebas miden tiempo real.

## 3. Reproducción

Script en Node sobre `dist/` del commit `5e9e946`, llamando a `analyzeMove` con profundidad 4 (la de `COACH_LIMITS`) y sin reloj, para que sea determinista. Stockfish 17.1 (binario oficial `ubuntu-x86-64-avx2`, 1 hilo, 64 MB de tabla, profundidad 20) solo como referencia externa, fuera del repositorio. Valores de Stockfish vistos por quien mueve. Scripts, casos y salidas en [reproduccion/](reproduccion/). Dos ejecuciones seguidas de Stockfish a profundidad 20 difirieron hasta 0,25 peones: el banco (RC-04) fijará nodos y tabla limpia por posición para que sea repetible.

| Caso | Lo que dice el coach (reproducido) | Stockfish 17.1 |
|---|---|---|
| 1.f3 e5 **2.g4** | Error grave · «Hay una jugada mucho mejor…» · después: «Mate en 1 para las negras» · Por qué: «No hay un motivo táctico: Alfil Beta la prefiere por cómo quedan las piezas (−0,7 frente a mate en 1 de las negras)» | Mate en 1 en contra |
| 1.e4 e5 **2.Cf3** | Mejor jugada · «Es la jugada que elige Alfil Beta» · mejor: Cc3 · pérdida 0 | Cf3 es la mejor (+0,43) |
| Fegatello **6.Cxf7** | Error grave (−0,4 → −2,2) · aviso: caballo de f7 colgando · «No hay un motivo táctico» · línea 6.Cc3 Dxg5 | 6.Cxf7 es la mejor (+0,87) |
| Partida de Claude **13.O-O** | Imprecisión · «deja el peón en peligro» | O-O es la mejor (+6,42) |
| Partida de Claude **32.Tc8+** | Buena jugada · aviso de torre colgando · −19,5 → −24,7 | Mate en contra en los dos casos (M8 con Tc2, M5 con Tc8+) |
| Partida 2 de Claude **4.Dg5** | Error grave · aviso de dama colgando · y a la vez «No hay un motivo táctico» | Error confirmado (−0,19 → −6,94) |
| Partida de ChatGPT **13.Dd5+** | Error grave · mejor Dd3+ · «Dd3+ gana una torre» (la línea 13.Dd3+ Re7 14.Cd5+ Rf7 no captura ninguna torre) | Error confirmado (+5,10 → −1,54) |
| Partida de ChatGPT **40.gxf5** | Mejor jugada · «gxf5 gana una pieza» · antes y después «Mate en 1 para las negras» | Mate en 1 en contra con cualquier jugada |
| Partida de ChatGPT **16.Ab5+** | Buena · «pone a salvo la dama de c7» | Ab5+ es la mejor (−4,84) |
| Partida de ChatGPT **12…Df6** | Error grave · «No hay un motivo táctico» | Error confirmado (+3,10 → −5,42 para las negras) |
| Partida de Claude **10…Da5** (motor) | — | −3,58 frente a +0,80 de 10…Ca6 |

## 4. Causas raíz

Recorrido del flujo: posición → búsqueda → evaluación → clasificación → explicación → presentación (`src/coach/analyze.ts`, `explain.ts`, `exchange.ts`, `src/ui/coach.ts`).

**C1. El coach no analiza la refutación de la jugada hecha** (H-01, H-03, H-10). `analyzeMove` busca la jugada hecha y obtiene su línea (`playedLine.line`), que empieza por la mejor respuesta del rival, pero esa línea no se usa para explicar. Los detectores solo miran oportunidades perdidas de quien mueve (mate en 1 propio, captura no vista) y piezas colgando por intercambio estático. No hay ningún detector de «permite mate» ni de «permite una táctica». Cuando `explainMove` no encuentra motivo para la mejor jugada, se usa `positionalWhy()`, que escribe «no hay un motivo táctico» sin mirar si `after.mate` existe ni si hay avisos.

**C2. Falta una decisión única y comprobable de qué se dice** (H-02, H-03, H-04, H-05, H-08). Cada parte del informe se calcula por su lado: `verdict` en `analyzeMove`, `summary` con `praise` o `summarize`, `why` con `explainMove` o `positionalWhy`, y la interfaz muestra «Mejor jugada: X» siempre que `best.uci !== move.uci` (`src/ui/coach.ts:142`). No hay jerarquía (mate > táctica > material > posicional > sin evidencia) ni invariantes. Ejemplos concretos:
- `verdict = isBest || loss === 0 ? "mejor" : …` (`analyze.ts`) junto a `best: … !== move.uci ? sanToSpanish(...)` (`ui/coach.ts`).
- `explainMove` solo trata como mate las puntuaciones de mate *a favor* (`score > MATE_BOUND`). Con un mate en contra sigue y cuenta material, y así sale «gxf5 gana una pieza».
- `amount()` convierte un número de centipeones en el nombre de una pieza («una torre», «la dama») sin comprobar qué se captura.
- `SUMMARIES.buena` es una frase fija («la diferencia es pequeña») que se usa también cuando la caída en centipeones es grande pero la curva logística está saturada.

**C3. Clasificación sin tolerancia ni trato propio de los mates** (H-02, H-05). Empate de puntuación y coincidencia de jugada son lo mismo para el veredicto. Los mates se pasan a ±10.000 cp y entran en la curva logística, que con la partida decidida da caídas casi nulas. No se distingue «mate más rápido» de «mate más lento», ni «ya estaba perdido» de «aquí se pierde».

**C4. Profundidad insuficiente y veredictos graves sin confirmar** (H-06, H-07, H-12). `COACH_LIMITS` es profundidad 4 (tope de 3 s). Difícil llega a 4-6 en 0,9 s con su tabla de transposición. La evaluación no tiene seguridad del rey, así que a profundidad 4 un sacrificio contra el rey parece pérdida de material. Un «Error grave» no se vuelve a comprobar con más profundidad. El aviso de pieza colgando usa intercambio estático sin clavadas, y se activa cuando la pérdida *total* de la jugada supera 80 cp, aunque esa pérdida no venga de la pieza señalada (en 13.O-O la pérdida viene de no jugar Ad2, no del peón de e5). El reloj solo limita la búsqueda de antes: en un dispositivo lento la profundidad baja y el resultado cambia (12.dxe5 tardó 3,7 s en Node).

**C5. Pruebas de tiempo real mezcladas con pruebas funcionales** (H-19). Tres pruebas comprueban milisegundos de reloj real dentro de la suite general. Con la instrumentación de cobertura el motor va unas 3 veces más lento: Difícil se queda en profundidad 2 y la búsqueda de 150 ms se pasa a 420 ms. No es un fallo del producto, pero tampoco se resuelve relajando los umbrales: hay que separar el perfil de rendimiento del de cobertura.

**C6. Cifras escritas a mano** (H-18). El README copia números de una ejecución pasada y nadie comprueba que sigan siendo ciertos.

## 5. Backlog priorizado

Cada defecto confirmado termina con una prueba de regresión con la posición exacta. Los criterios de aceptación se comprueban con el banco de posiciones (bloque B2), no solo con los casos de las auditorías.

### P0 · Coherencia del entrenador

**RC-01 · Decisión única del mensaje e invariantes del informe** (H-02, H-03, H-04, H-05, H-08; causa C2 y C3)
- Impacto: elimina las contradicciones visibles en la misma pantalla.
- Qué: separar «clasificar» de «redactar». Un paso decide la categoría (mate forzado a favor o en contra, táctica, pérdida material, posicional, sin evidencia suficiente) y el resto del texto sale de esa decisión. Añadir `checkInvariants(report)` y aplicarlo a todos los informes de las pruebas y del banco.
- Invariantes mínimas:
  1. Si el veredicto es «mejor», no se muestra otra jugada como «Mejor jugada». Si dos jugadas puntúan igual dentro de una tolerancia, se dice que son equivalentes («Igual de buena que Cc3»).
  2. Si hay un aviso táctico, el «por qué» nunca dice «no hay un motivo táctico».
  3. Si después de la jugada hay mate en contra, ningún texto elogia material ni dice «la diferencia es pequeña».
  4. Ningún texto nombra una pieza ganada que la línea no capture de verdad.
  5. Ningún texto contradice la evaluación que muestra el mismo panel.
- Criterios de aceptación: los casos 2.Cf3, 4.Dg5, 40.gxf5, 32.Tc8+ y 13.Dd3+ dan textos coherentes; las invariantes pasan en todas las posiciones del banco; cero contradicciones en el banco.
- Dependencias: ninguna. Bloquea RC-02 y RC-05.

**RC-02 · Refutación: qué permite la jugada hecha** (H-01, H-10; causa C1)
- Impacto: el coach explica los errores tácticos y los mates que recibes, que es justo lo que más enseña.
- Qué: analizar la línea de la jugada hecha (respuesta del rival) con los mismos detectores: mate en N permitido, horquilla, clavada, pieza que se pierde. Texto esperado en 2.g4: «g4 deja libre la diagonal h4–e1: tras …Dh4# tu rey no tiene escape».
- Criterios de aceptación: en 2.g4 el coach dice que permite mate en 1 y muestra …Dh4; en 12…Df6 nombra el doble ataque de la línea; ningún informe con `after.mate` en contra dice «no hay un motivo táctico».
- Dependencias: RC-01.

**RC-03 · Reconocer la falta de evidencia** (H-06 en la parte de texto; causa C2 y C4)
- Impacto: cuando el coach no sabe, lo dice, en lugar de afirmar algo falso.
- Qué: si no hay motivo verificado, el texto dice que la diferencia es de evaluación a la profundidad analizada, sin inventar motivo. Un «Error grave» sin motivo táctico ni material confirmado no se emite sin la confirmación de RC-05.
- Criterios de aceptación: ninguna frase de motivo sin un hecho comprobado en la línea; 6.Cxf7 deja de ser «Error grave».
- Dependencias: RC-01; la parte de confirmación, RC-05.

### P1 · Calidad del análisis, banco y regresión

**RC-04 · Banco de posiciones reproducible con referencia de Stockfish** (deliverable del punto 5)
- Qué: `bench/posiciones.json` con 60-100 posiciones etiquetadas (mates inmediatos y forzados, dobletes, clavadas, descubiertas, sacrificios correctos e incorrectos, ganancias y pérdidas, jugadas equivalentes, posiciones tranquilas, finales y todas las de las auditorías). Valores de referencia de Stockfish precalculados y guardados en el repositorio con versión, binario, hilos, tabla, profundidad o nodos, y fecha. Un script de desarrollo (`tools/stockfish-ref.mjs`) los regenera si se le pasa la ruta del binario; Stockfish nunca entra en `package.json` ni en el sitio.
- `npm run bench:coach` (sin Stockfish) mide contra esos valores: coincidencia de mejor jugada, pérdida media frente a la referencia, detección de errores graves, falsos positivos del coach, detección de mates, número de contradicciones (invariantes de RC-01) y tiempos.
- Criterios de aceptación: mismo resultado en dos ejecuciones; metodología escrita en `bench/README.md`; se ejecuta antes de los cambios del coach para tener el «antes».
- Dependencias: ninguna (puede ir en paralelo con RC-01).

**RC-05 · Análisis del coach a la altura del rival** (H-06, H-07, H-11, H-12; causa C4)
- Qué, por orden, y cada paso con su medida en el banco:
  1. Profundidad mínima igual a la que alcanza Difícil en la misma posición y presupuesto adaptativo con tope en el Worker.
  2. Volver a buscar más hondo antes de emitir «Error» o «Error grave» (extensión selectiva en posiciones críticas: jaques, capturas, mates).
  3. Comparar jugada hecha y mejor jugada a la misma profundidad y desde el mismo bando; tolerancia para jugadas equivalentes.
  4. Mates por distancia: «mate más rápido» y «ya estaba perdido» como casos propios.
  5. Marcar posiciones inestables (la puntuación cambia mucho entre iteraciones) y bajar el tono del texto en ellas.
  6. Aviso de pieza colgando verificado con el motor sobre esa captura concreta (resuelve la clavada de 13.O-O).
  7. Cancelación de cálculos obsoletos del coach al cambiar de jugada en el repaso.
- Criterios de aceptación: 6.Cxf7 y 13.O-O no se penalizan; mejora medida en el banco sin empeorar ningún indicador; el análisis de una jugada no pasa de un tope fijado y medido (propuesta: 2 s en un portátil normal); la interfaz no se bloquea; el repaso de 80 medias jugadas no tarda más que hoy.
- Dependencias: RC-01, RC-04.

**RC-06 · Pruebas: separar rendimiento y cobertura, y regresiones** (H-19, H-20; causa C5)
- Qué: mover las aserciones de tiempo real a una suite de rendimiento propia (`npm run test:perf`) con su trabajo de CI, sin cambiar sus umbrales. Añadir una ejecución con cobertura que no las incluya. Pruebas de carreras entre Workers (respuestas viejas, cancelación) e integridad del estado en el repaso. Igualar los límites de PGN y Worker o validarlo al importar, con prueba.
- Criterios de aceptación: `npm test` y la cobertura en verde sin tocar ningún umbral; la suite de rendimiento sigue fallando si el motor se vuelve lento; prueba de una partida de 1.001 a 1.200 medias jugadas.
- Dependencias: ninguna.

### P2 · Validación del producto, marca y documentación

**RC-07 · Firma y vinculación con CalvarioTechLabs** (punto 13)
- Diseño primero en el lienzo «Design - Escaque» (Escritorio, Tablet y Móvil): firma «by CalvarioTechLabs» junto al logo, pie con enlace a https://calvariotechlabs.com/ y referencia en la información del proyecto. Hoy no hay pie ni sección «Acerca de», así que son elementos nuevos que hay que diseñar.
- Después, en código: pie, firma, metadatos (`author`, Open Graph), datos estructurados JSON-LD (`SoftwareApplication` con `creator` de tipo `Organization`) y README. El JSON-LD va como fichero o bloque de datos compatible con la CSP actual y con la prueba que prohíbe código en línea; no se relaja la CSP.
- Criterios de aceptación: diseño aprobado y exportado a docs/design; accesibilidad (contraste, foco, nombre del enlace) en claro y oscuro; sin desbordes a 320 px ni en apaisado; validador de datos estructurados sin errores.

**RC-08 · Validación integral** (H-21, H-22, H-24)
- Automatizable aquí: sin conexión real con emulación de red en Chrome por CDP (recarga y partida sin red), actualización del service worker entre dos versiones, recuperación de la partida, cabeceras medidas en una URL de despliegue o en navegador real, rendimiento del repaso, PGN de ida y vuelta con el mismo fichero.
- Solo con personas o dispositivos: instalación nativa en Android e iPhone, uso a una mano en vertical y apaisado, TalkBack y VoiceOver. Te dejo un guion de prueba corto.
- Criterios de aceptación: cada prueba marcada como «ejecutada» o «pendiente de persona», con evidencia.

**RC-09 · Documentación viva** (H-18, H-26)
- Qué: `npm run metrics` genera las cifras (tests, suites, lecciones, dependencias en ejecución, tamaño del sitio, resultados del banco) en un JSON fechado con el commit; una prueba de CI falla si el README no coincide. Limitaciones conocidas y capacidades verificadas en el README.
- Dependencias: al final, cuando ya no cambien las cifras.

**RC-10 · Errores de entrada** (H-16, H-17, H-13). Opcional para la RC (ver decisiones).
- Mensaje breve en la línea de estado ante una jugada ilegal; aceptar SAN española al importar PGN o explicar qué se espera; nombrar el ahogado en el coach.

**RC-11 · Informe de la RC y protocolo de revalidación** (puntos 11 y 12 del encargo)
- Informe de cambios, antes y después del banco, evidencias de regresión, limitaciones, preparación de la RC, protocolo para la auditoría independiente y registro de decisiones para el caso de estudio.

### Fuera de la RC salvo que lo pidas

- H-14 y H-15: mejorar la evaluación del motor (seguridad del rey, estructura de peones) o dar variedad a Difícil. Es afinar el motor, y la regla del proyecto dice que no se afina sin que lo pidas. Propuesta: documentarlo como limitación conocida.
- H-23: coach compacto («veredicto + una frase + ver más»). Es un rediseño del panel.

## 6. Plan de ejecución

Máximo dos hilos a la vez. Cada bloque con su tarea en Linear (subtarea de CAL-408), su rama, su PR y sus pruebas. Nada se fusiona sin tu OK.

| Ola | Bloque | Tareas | Modelo | Diseño previo | En paralelo con |
|---|---|---|---|---|---|
| 1 | B1 · Coherencia del coach | RC-01, RC-02, RC-03 (sin la confirmación profunda) | Opus | No: reutiliza los estados visuales actuales del panel; solo cambian textos | B2 |
| 1 | B2 · Banco de posiciones | RC-04 y medición del «antes» | Opus | No | B1 |
| 2 | B3 · Calidad del análisis | RC-05 y confirmación de RC-03 | Opus | No | B4 |
| 2 | B4 · Pruebas y regresión | RC-06 | Sonnet | No | B3 |
| 3 | B5 · Marca: diseño | RC-07, parte de lienzo | Sonnet | Es el diseño | B6 |
| 3 | B6 · Validación integral | RC-08 | Sonnet | No | B5 |
| 4 | B7 · Marca: código | RC-07, parte de código, tras tu OK al diseño | Sonnet | Sí (B5) | B8 |
| 4 | B8 · Errores de entrada (si lo apruebas) | RC-10 | Sonnet | Solo si el mensaje de jugada ilegal necesita un estado visual nuevo | B7 |
| 5 | B9 · Documentación viva | RC-09 | Sonnet | No | B10 |
| 5 | B10 · Informe de la RC | RC-11 | Opus | No | B9 |
| 6 | Auditoría independiente | Desde conversaciones que no hayan implementado nada | — | — | — |

Por qué este orden: B1 y B2 no tocan los mismos ficheros y B2 tiene que medir el «antes» antes de que B1 cambie el coach. B3 necesita las dos cosas. El diseño de la marca espera a la ola 3 porque necesita tu revisión y no bloquea nada técnico.

Skills por bloque: B1 y B3, `superpowers:systematic-debugging`, `superpowers:test-driven-development` y `superpowers:verification-before-completion`; B2, `engineering:testing-strategy`; B4, `engineering:testing-strategy`; B5 y B7, `impeccable:impeccable` o `design:design-critique` y `design:accessibility-review`; B6, `superpowers:verification-before-completion`; B9, `engineering:documentation`. Todas las PR: `code-review` y `security-review` sobre la diff.

Riesgos: (1) más profundidad en el coach cuesta tiempo en móviles lentos; se mitiga con tope adaptativo y medición en el banco. (2) Los textos nuevos del coach pueden pedir un estado visual que hoy no existe (por ejemplo, «equivalente»); si pasa, el hilo para y se diseña primero. (3) Las pruebas de coherencia pueden destapar más casos de los vistos; se tratan con la misma jerarquía, no caso a caso.

## 7. Definition of Done de la RC (traza)

| Criterio del encargo | Cómo se comprueba |
|---|---|
| Sin defectos P0 abiertos | RC-01 a RC-03 fusionadas; invariantes en verde en el banco |
| P1 resueltos o con excepción aprobada | RC-04 a RC-06 fusionadas o con tu excepción escrita |
| Regresiones cubiertas | Una prueba por cada H reproducido (tabla de la sección 3) |
| Banco reproducible | Dos ejecuciones con el mismo resultado; metodología escrita |
| El coach no se contradice | Cero violaciones de invariantes en el banco |
| Pipeline completa en verde | CI con tests, perft, e2e, rendimiento y cobertura |
| Sin degradaciones inaceptables | Tiempos del banco y de Difícil antes y después |
| Principios de arquitectura | Cero dependencias en ejecución (CI), sin backend, Workers |
| Documentación real | Prueba de cifras del README (RC-09) |
| Limitaciones documentadas | Sección del README y del informe de la RC |
