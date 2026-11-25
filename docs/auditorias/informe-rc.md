# Escaque · Informe de la Release Candidate (B10, RC-11)

- Fecha: 24 de noviembre de 2026. **RC cerrada el 25 de noviembre de 2026** (apartados 1, 6 y 10 actualizados ese día; el resto describe el estado del 24-nov)
- Código descrito: `main` en `7e38bba` (incluye B1 a B7 y B11). Partida: `5e9e946`, el commit que revisaron las dos auditorías.
- Issue: [#74](https://github.com/calvariotechlabs/escaque/issues/74) · Plan: [consolidacion-rc.md](consolidacion-rc.md)
- Qué es este documento: el balance de la RC (qué se hizo, con qué evidencia, con qué cifras antes y después), las excepciones que quedan, lo que solo puede comprobar una persona y el protocolo para la auditoría independiente final. Las cifras de los apartados 3, 4 y 6 se han **vuelto a medir** al escribirlo (apartado 8); las demás vienen de los informes de cada bloque, enlazados.

## 1. Veredicto en una línea

**RC cerrada el 25 de noviembre de 2026.** Cumple la Definition of Done del plan. El único punto que dependía de una persona, las pruebas en móvil real, con lector de pantalla y de las cabeceras de producción, lo hizo Sergio ese día (apartado 6). Los defectos P0 del entrenador están cerrados: **0 de 152 informes con contradicción de las invariantes del propio coach** (antes, 39 de 152 con la regla externa) y, desde la corrección de H-08 ([#83](https://github.com/calvariotechlabs/escaque/issues/83)), **0 de 152 también con la regla externa del banco** (apartado 4.3).

## 2. Qué se hizo, bloque a bloque

| Bloque | Qué entrega | PR · issue | Estado | Revisiones y evidencia |
|---|---|---|---|---|
| B1 · Coach coherente (RC-01 a RC-03) | Una sola decisión del mensaje (`decide()`), refutación de la jugada hecha (`refutationOf()`), invariantes comprobables (`checkInvariants`), campos nuevos del informe (`alternative`, `category`, `lines`) | [#59](https://github.com/calvariotechlabs/escaque/pull/59) | Fusionada | `tests/coach-coherencia.test.ts`: H-01 a H-10 (fallaban 9 en `5e9e946`) y barrido de las dos partidas auditadas con 0 violaciones |
| B2 · Banco de posiciones (RC-04) | 82 posiciones en 13 categorías, referencia Stockfish 17.1 (8 M nodos, solo en desarrollo), `npm run bench:posiciones`, huella determinista, medición del «antes» | [#60](https://github.com/calvariotechlabs/escaque/pull/60), arreglo de compilación [#61](https://github.com/calvariotechlabs/escaque/pull/61) | Fusionadas | `bench/README.md` (metodología y limitaciones), `bench/resultados/antes-b1.md` |
| B3 · Calidad del análisis (RC-05) | Avisos confirmados con el motor (H-07), mates largos, confirmación de errores graves más hondo si cabe en 150 k nodos, un solo reloj | [#64](https://github.com/calvariotechlabs/escaque/pull/64) · [#62](https://github.com/calvariotechlabs/escaque/issues/62) | Fusionada | [b3-calidad-analisis.md](b3-calidad-analisis.md): se midió que más profundidad **no** mejora los veredictos y se descartó |
| B4 · Pruebas y regresión (RC-06) | Aserciones de reloj real aparte (`npm run test:perf`, job propio de la CI), límite único de 1.200 medias jugadas, `AnalysisGuard` (corrige un fallo real: un informe viejo caía en la partida nueva del repaso) | [#69](https://github.com/calvariotechlabs/escaque/pull/69) · [#68](https://github.com/calvariotechlabs/escaque/issues/68) | Fusionada | `npm run test:cobertura` ya no falla por reloj (H-19); H-20 cerrada |
| B5 · Marca: diseño | Firma «by CalvarioTechLabs» en cabecera (desde 720×500), pie en todas las pantallas, pantalla `#/acerca` | [#66](https://github.com/calvariotechlabs/escaque/pull/66) · [#65](https://github.com/calvariotechlabs/escaque/issues/65) | Fusionada | Diseño aprobado por Sergio; exportado a `docs/design` |
| B7 · Marca: código | Firma, pie, «Acerca de», metadatos y JSON-LD; nombre legal «Calvario TechLabs» en el ©, firma visible «CalvarioTechLabs» | [#67](https://github.com/calvariotechlabs/escaque/pull/67) | Fusionada | Pruebas unitarias, de CSP/metadatos y e2e |
| B6 · Validación integral (RC-08) | Validación en Chrome real con las cabeceras de `vercel.json`: CSP, privacidad, PWA, sin conexión, recuperación, PGN, móvil, teclado, rendimiento | [#76](https://github.com/calvariotechlabs/escaque/pull/76) · [#72](https://github.com/calvariotechlabs/escaque/issues/72) | **Fusionada** (15:35 UTC) | [b6-validacion-integral.md](b6-validacion-integral.md): sin defectos funcionales ni de seguridad; un hallazgo de texto (F-01, aviso de versión) corregido |
| B11 · Motor (RC-12) | PVS, jugada nula, asesinas, historial, LMR, aspiración, `maxNodes`; evaluación con seguridad del rey, estructura de peones, movilidad, pareja de alfiles y torres; coach ajustado al motor nuevo | [#78](https://github.com/calvariotechlabs/escaque/pull/78) · [#63](https://github.com/calvariotechlabs/escaque/issues/63) | Fusionada (16:32 UTC) | Duelo +96 =1 −3, banco `despues-b11`, tres excepciones (apartado 5) |
| B9 · Documentación viva (RC-09) | `npm run metrics` y `metrics:check` en la CI: el README no puede desfasarse de las cifras reales; «Capacidades verificadas» y «Limitaciones conocidas» | [#77](https://github.com/calvariotechlabs/escaque/pull/77) · [#73](https://github.com/calvariotechlabs/escaque/issues/73) | Fusionada (16:44 UTC) | Ver apartado 7 |
| B8 · Errores de entrada (RC-10) | — | — | Fuera de la RC por decisión de Sergio | H-16 y H-17 quedan para después |

## 3. Antes y después

### 3.1 Coach (banco de 82 posiciones, 152 informes, profundidad 4)

| Métrica | antes (`5e9e946`, `antes-b1`) | después de B3 | después de B11 | después de H-08 (`despues-h08`) |
|---|---|---|---|---|
| Informes con alguna contradicción | 39/152 (26 %) | 0/152 | 1/152 (1 %) | **0/152** |
| Falsos positivos (jugada equivalente llamada Error) | 7/123 (6 %) | 5/123 (4 %) | **3/123 (2 %)** | 3/123 (2 %) |
| Errores graves detectados | 20/23 (87 %) | 20/23 (87 %) | 20/23 (87 %) | 20/23 (87 %) |
| Errores llamados «Mejor» o «Buena» | 3 | 3 | 3 | 3 |
| Veredicto igual al de la referencia | 91/152 (60 %) | 99/152 (65 %) | 97/152 (64 %) | 97/152 (64 %) |
| Mejor jugada equivalente a la de Stockfish | 68/82 (83 %) | 68/82 (83 %) | 67/82 (82 %) | 67/82 (82 %) |
| Mate a favor visto / mate permitido visto | 20/20 · 4/4 | 20/20 · 4/4 | 20/20 · 4/4 | 20/20 · 4/4 |
| Tiempo por análisis (media · p95 · máximo) | 190 · 715 · 3.592 ms | 290 · 1.046 · 3.781 ms | **119 · 537 · 828 ms** | 104 · 456 · 650 ms (otro equipo) |

Lectura honesta: el coach ya no se contradice y da menos falsos positivos, pero **no ve más errores graves** (20/23 en las tres columnas) y el veredicto coincide con Stockfish en el 64 % de los informes. Los tres errores no vistos siguen siendo los mismos (Cxe5 del Blackburne-Shilling, Dxd4 del arca de Noé, 10…Da5 de H-14); dependen de que el motor vea la refutación. El tiempo máximo bajó de 3,6 s a 0,8 s gracias a la velocidad del motor nuevo, no a un cambio del coach.

### 3.2 Alfil Beta (mismas 82 posiciones)

| Perfil | Antes: errores > 2 peones (en tácticas) · pérdida media · máximo | Después de B11 |
|---|---|---|
| Fácil | 17 (15) · 175,8 cp · 66 ms | 18 (16) · 180,7 cp · 40 ms |
| Medio | 9 (8) · 65 cp · 502 ms | 7 (6) · 48,7 cp · 127 ms |
| **Difícil (0,9 s)** | **4 (4) · 31,8 cp · 906 ms** | **3 (3) · 25,8 cp · 905 ms** |
| Profundidad fija 5 | 3 (3) · 24,8 cp · 11.048 ms | 3 (3) · 28,4 cp · 727 ms |

- Difícil acierta la mejor jugada de Stockfish en 49/82 (60 %, antes 55 %) y una equivalente en 70/82 (85 %, antes 82 %); mantiene el 100 % de los mates (18/18).
- **Punto de parada del motor (B11)**, fijado antes de afinar:

| Criterio | Resultado |
|---|---|
| Difícil sigue respondiendo en menos de 1 s | Cumplido: máximo 905 ms en el banco; media 840 ms y máximo 939 ms en 4.945 jugadas del duelo |
| Gana a la versión anterior en al menos 100 partidas con aperturas variadas | **Cumplido**: +96 =1 −3 (96,5 % de los puntos; IC 95 %: 93,0 % a 100 %), `bench/resultados/duelo-b11-dificil.json` |
| Los niveles siguen ordenados | Cumplido: Difícil +10 =0 −0 contra azar y contra Fácil, +9 =1 −0 contra Medio; Medio +10 =0 −0 contra Fácil |
| Ningún error de más de 2 peones en las posiciones tácticas del banco | **No cumplido**: 3 (de 4 a 3). Son las tres excepciones del apartado 5 |

## 4. Definition of Done de la RC (§7 del plan)

| Criterio | Cómo se comprueba | Estado |
|---|---|---|
| Sin defectos P0 abiertos | RC-01 a RC-03 fusionadas (#59, #64); invariantes en verde | **Cumplido** con #83 fusionada (4.3: H-08 corregida) |
| P1 resueltos o con excepción aprobada | RC-04 a RC-06 y RC-12 fusionadas; excepciones escritas | **Cumplido** con tres excepciones aprobadas (apartado 5) |
| Regresiones cubiertas: una prueba por cada H reproducido | Tabla 4.1 | **Cumplido** salvo lo que está fuera de la RC |
| Banco reproducible | Dos ejecuciones del mismo commit dan la misma huella; metodología en `bench/README.md` | **Cumplido** (apartado 8) |
| El coach no se contradice | Cero violaciones en el banco | **Cumplido** con #83 fusionada: 0 de `checkInvariants` y 0 de la regla externa del banco (`despues-h08`, 4.3) |
| Pipeline completa en verde | CI: tipos y tests, perft completo, rendimiento, e2e y cero dependencias | **Cumplido**: `main` en `7e38bba` con los 5 trabajos de la CI en verde (apartado 8) |
| Sin degradaciones inaceptables | Tiempos del banco y de Difícil antes y después | **Cumplido**: el coach pasa de máximo 3,6 s a 0,8 s; Difícil se queda en 0,9 s |
| Principios de arquitectura | `dependencies: {}`, sin backend, Workers | **Cumplido**: B6 midió 0 peticiones a otros orígenes y 0 cookies |
| Documentación real | Prueba de cifras del README (RC-09) | **Cumplido** con #77 fusionada: `npm run metrics:check` pasa en `main` (apartado 7) |
| Limitaciones documentadas | Sección del README y de este informe | Apartado 9 de este informe y sección «Limitaciones conocidas» del README (#77) |

### 4.1 Regresión por hallazgo

| Hallazgo | Prueba o evidencia |
|---|---|
| H-01 a H-06, H-08 a H-10 (coach) | `tests/coach-coherencia.test.ts` |
| H-07 (aviso que ignora una clavada) | `tests/coach-analisis.test.ts` |
| H-11 (evaluaciones distintas) | Medido, sin cambio: 1 de 82 posiciones cambia un peón o más entre profundidad 4 y 5 |
| H-12 (el coach mira menos que el rival) | B3 midió que más profundidad no ayuda; el coach sigue en profundidad 4 y 3 s; B11 lo hace 3 a 5 veces más rápido |
| H-14 y H-02b (errores del motor) | `tests/engine-tacticas.test.ts` como `todo` (excepción, apartado 5) |
| H-15 (Difícil determinista) | Sin cambio: decisión de diseño (`marginCp: 0` en Difícil) |
| H-18 (README desfasado) | **PR #77** (fusionada): cifras generadas y comprobadas por la CI |
| H-19 y H-20 (reloj con cobertura, límites de PGN) | B4: `tests/rendimiento/reloj.perf.ts`, `PGN_MAX_PLIES` |
| H-21 y H-22 (cabeceras, PWA, dispositivos) | B6: parte automatizada ejecutada; el resto, apartado 6 |
| H-13, H-16, H-17, H-23, H-24, H-25, H-26 | Fuera de la RC o recomendaciones (apartado 9) |

### 4.2 Lo que ejecutó B6 en Chrome real

`npm test` 1.093/1.093 y e2e 97/97 en su momento; CSP sin violaciones en cuatro rutas; 0 peticiones a otros orígenes y 0 cookies; criterios de instalabilidad de Chrome sin errores; recarga sin red que restaura la partida y máquina Difícil sin conexión; seis casos de datos guardados corruptos que arrancan limpios; actualización del service worker conservando la partida; PGN de ida y vuelta y con errores; 40 combinaciones de tamaño sin desborde; zoom 200 %; primer pintado de 164 ms con CPU 4 veces más lenta. Detalle en [b6-validacion-integral.md](b6-validacion-integral.md).

### 4.3 La contradicción de H-08 (corregida)

`auditoria-h-08 Qd3+`: el informe decía «Dd3+ gana la dama y un peón a cambio de un caballo» y el panel enseñaba «13. Dd3+ Re7 14. Cd5+ Re8», que no captura nada. **Causa raíz**: tres horizontes distintos para la misma línea. El texto cuenta el material en 12 medias jugadas (`MATERIAL_PLIES`), el panel enseñaba 4 (`LINE_PLIES`) y la regla `pieza-no-capturada` del banco miraba 8; la dama cae en la novena (17. Cxf6+). `checkInvariants` no lo veía porque comprueba la línea entera del motor, no la parte visible.

**Corrección** ([#83](https://github.com/calvariotechlabs/escaque/issues/83)): el panel enseña la línea hasta la última captura que cuenta el texto (`shownPlies`; 4 medias jugadas si no hay capturas más tarde, como antes). `checkInvariants` comprueba ahora que la línea del panel llega hasta esa captura, y la regla del banco mira exactamente las medias jugadas que enseña el panel, no 8 fijas (más estricta en las líneas cortas). Prueba de regresión en `tests/coach-coherencia.test.ts` y `tests/banco.test.ts`. Las columnas anteriores de la tabla 3.1 se midieron con la regla de 8 medias jugadas; `despues-h08` usa la nueva. Banco `despues-h08`: 0/152 contradicciones, mismos falsos positivos (3/123) y misma detección (20/23). Efecto visible: 33 de las 118 jugadas marcadas del banco enseñan una línea más larga (hasta 11 medias jugadas).

**Lo que no cubre**: cuando el «por qué» describe la respuesta del rival a la jugada hecha («Tras d3, las negras responden 4… Cxh5 y ganan la dama»), el texto nombra la jugada pero el panel enseña la línea de la mejor jugada, no la de la jugada hecha. No es una contradicción (la regla del banco no la cuenta), pero esa captura no se ve en la línea. Son 20 de 268 informes en el banco y las dos partidas de las auditorías. Enseñar también esa línea es un cambio de interfaz que necesita diseño; queda propuesto a Sergio. **Actualización (25-nov, issue [#87](https://github.com/calvariotechlabs/escaque/issues/87), hallazgo A-02):** con el diseño «Coach: las dos líneas» aprobado (PR #88), el panel enseña también la línea de tu jugada, hasta el mate o la última captura que cuenta el texto, con la respuesta clave subrayada. La invariante 4c de `checkInvariants` y la regla `refutacion-sin-linea` del banco lo comprueban: 0 de 152 en `despues-87`.

## 5. Excepciones documentadas del motor

Alfil Beta falla en tres posiciones de las auditorías en el nivel Difícil. Las tres son ataques a un rey expuesto que Stockfish ve varias jugadas antes.

| ID | Posición | Pérdida | Qué pasa | Decisión |
|---|---|---|---|---|
| H-14 | 10…Da5 | −485 cp | No la ve ni a profundidad 9 | **Excepción aprobada** por Sergio (24-nov). Prueba `todo` en `tests/engine-tacticas.test.ts` |
| H-02b | 12.dxe5 | −204 cp (antes −398) | No la ve ni a profundidad 9 | **Excepción aprobada** por Sergio. Prueba `todo` |
| H-10 | 12…Dh4 | −569 cp | Acierta en cuanto llega a profundidad 7; en 0,9 s unas veces llega y otras no. Con presupuesto fijo de nodos la prueba pasa | **Excepción aprobada** por Sergio el 24-nov (consta en la issue #63), con la redacción «según cuánto llegue a mirar en 0,9 s» |

**Dato nuevo de esta verificación:** en una ejecución de Difícil en otro equipo, H-02b y H-10 salieron bien y solo falló H-14. Confirma que Difícil depende del reloj y de la máquina; los 3 fallos de la tabla 3.2 son el peor caso medido, no un valor fijo.

Qué se arregló por el camino: gana-arca-noe y pierde-arca-noe dejaron de fallar; H-02b mejoró de −398 a −204 cp. Los sacrificios correctos (6.Cxf7, sacrificio griego, Axf7+ del Traxler) siguen llamándose «Error grave» en 3 casos: el texto ya avisa de que puede ser un sacrificio con compensación que el coach no ve (B1 y B11), y capar el veredicto bajaría la detección de los sacrificios incorrectos.

Las tres excepciones constan como aprobadas (la de H-10, el 24-nov a las 16:35 UTC, en la issue #63) y coinciden con lo que dice el README de `main`.

## 6. Lo que solo puede comprobar una persona

Sergio confirmó el **25 de noviembre de 2026** que hizo estas comprobaciones: las pruebas en un móvil real, con lector de pantalla, y la revisión de las cabeceras en producción. Las pruebas de móvil, lector y cabeceras no dejaron informe aparte: consta su confirmación en el hilo del proyecto.

| Comprobación | Quién | Qué comprobar | Estado |
|---|---|---|---|
| Probar en un móvil real | Sergio | iPhone (Safari, «Añadir a pantalla de inicio») y Android (Chrome): aviso o botón de instalar, icono (también el maskable), pantalla completa, **modo avión tras abrir una vez**, jugar contra la máquina, aviso «Sin conexión», y que sale «Hay una versión nueva» tras la siguiente fusión | **Hecha** (25-nov) |
| Lector de pantalla | Sergio | Anuncio de jugadas, nombre de casillas, diálogo de PGN y avisos. B6 solo pudo comprobar el árbol de accesibilidad y la región `aria-live` | **Hecha** (25-nov) |
| Uso a una mano | Sergio | Alcance del pulgar a «Empezar partida», «Deshacer» y arrastrar piezas, en vertical y apaisado | **Hecha** (25-nov), con la prueba del móvil real |
| Cabeceras en producción | Sergio, desde su navegador | https://escaque.calvariotechlabs.com/ → cabeceras de la respuesta del documento (la Protección contra bots de Vercel devuelve 429 a los centros de datos, así que ningún hilo pudo medirlas) | **Hecha** (25-nov) |
| `x-robots-tag: noindex` | Sergio, en la misma medición | Debe **no** salir en `escaque.calvariotechlabs.com` | **Hecha** (25-nov), en la misma revisión de cabeceras |
| Texto del aviso de versión en Claude Design | Un hilo con acceso | «Al actualizar se recarga la página y tu partida se conserva.» (F-01) | **Hecha**: lámina «Avisos» y componente Notice actualizados (#81, #82) |
| Firma en la imagen Open Graph | Sergio | Pregunta abierta desde B5 | **Hecha**: firma añadida en #98 (issue #96) |

## 7. Documentación viva (#77)

La PR #77 (B9) se fusionó a las 16:44 UTC, después de actualizarla contra `main` con B11 dentro y regenerar sus cifras con el banco `despues-b11`. Comprobado en `main` tras su fusión: `npm test` da **1.167 pruebas (1.165 pasan, 2 `todo`)** y `npm run metrics:check` responde «Cifras al día: 1167 pruebas, 15 lecciones, 92 ficheros en el sitio».

- Las cifras del apartado 8 (1.152 pruebas) son las medidas **antes** de fusionar #77, sobre `7e38bba`; la diferencia con las 1.167 actuales son las pruebas que añadió #77 (`tools/metricas.test.mjs`). El resto de cifras del informe (banco, duelo, coach) no cambian.
- `npm run metrics:check` es ya un paso de la CI: cualquier PR que añada pruebas, lecciones o ficheros exigirá regenerar las cifras con `npm run metrics`.
- H-18 (README desfasado) queda cerrada.

## 8. Cómo se midió para este informe

Se rehicieron en un clon limpio de `main` (`7e38bba`), Node de la sesión, sin dependencias de ejecución:

| Comprobación | Resultado |
|---|---|
| `npm run typecheck` | Sin errores |
| `npm test` | 1.152 pruebas, 206 suites: 1.150 pasan, 0 fallan, 2 `todo` (H-14 y H-02b), 10 s |
| `npm run bench:posiciones` | Huella determinista `a9712a34`, **idéntica** a la de `despues-b11` (Fácil, profundidad 5, estabilidad e informes del coach reproducen). Coach: 1/152 contradicciones, 3/123 falsos positivos, 20/23 errores graves, 71 · 316 · 453 ms por análisis en este equipo (más rápido que el 119 · 537 · 828 ms de la tabla 3.1: los tiempos dependen del equipo). Difícil, que depende del reloj: 1 error de más de 2 peones en tácticas (solo H-14), 748 ms de media y 903 ms de máximo |
| CI de la PR #78 y de `main` tras fusionarla (`7e38bba`) | PR: 6 de 6 en verde. `main`: 5 de 5 en verde (tipos, tests y cobertura, perft completo, rendimiento con reloj real, cero dependencias, accesibilidad e2e) |

## 9. Limitaciones conocidas

- **El coach ve lo que ve Alfil Beta a profundidad 4 y en 3 s.** No detecta 3 de 23 errores graves del banco, y puede llamar «Error grave» a un sacrificio correcto con compensación lejana (3 casos).
- **Difícil es determinista** (H-15): la misma línea gana siempre. Decisión de diseño, no se ha tocado.
- **Alfil Beta no es un rival fuerte.** No hay Elo (82 posiciones elegidas a mano no dan validez estadística; ver `bench/README.md`). Las cifras comparan versiones del mismo código.
- **La referencia de Stockfish no es una verdad**: en finales que necesitan tablas puede discrepar.
- **El banco tiene 4 a 12 posiciones por categoría**: una diferencia de una o dos posiciones puede ser ruido de Difícil.
- **Fuera de la RC por decisión de Sergio:** H-13 (el coach no nombra el ahogado), H-16 (una jugada ilegal no muestra mensaje), H-17 (el PGN en notación española se rechaza con un mensaje engañoso), H-23 (panel del coach compacto), H-24 (medir el repaso de partidas largas con el banco), H-25 (aviso legal y de privacidad) y H-26 (separar tiempo de motor y tiempo hasta ver la respuesta).
- Validación en dispositivo físico, con lector de pantalla real y de las cabeceras de producción: hecha el 25-nov (apartado 6).

## 10. Decisiones y pasos que quedan

1. **H-08** (4.3): corregida y fusionada ([#84](https://github.com/calvariotechlabs/escaque/pull/84), issue [#83](https://github.com/calvariotechlabs/escaque/issues/83)).
2. #77 fusionada (apartado 7).
3. Este informe se fusionó en [#79](https://github.com/calvariotechlabs/escaque/pull/79) y [#80](https://github.com/calvariotechlabs/escaque/pull/80). Después se fusionaron la auditoría v2 y su contraste (#86, #90), el arreglo de las dos líneas del coach (#88, #91, issue #87), la corrección «Calvario TechLabs» (#93, #95), la firma en la imagen Open Graph (#98) y el arreglo de `metrics:check` con Node 24 (#99).
4. Sin pasos pendientes para la RC. Fuera de ella quedan los puntos del apartado 9 (B8 y los H-13, H-16, H-17, H-23 a H-26).

## 11. Registro de decisiones para el caso de estudio

| Decisión | Por qué | Alternativa descartada |
|---|---|---|
| Tratar la coherencia del coach como P0, por encima de la fuerza del motor | Las dos auditorías coinciden en que ahí está el defecto; una app de aprender no puede contradecirse | Seguir el criterio de ChatGPT, que reserva P0 a fallos de legalidad |
| Construir el banco **antes** de tocar el coach (B2 con B1) | Sin un «antes» medido no hay forma de saber si un cambio mejora | Medir al final, con riesgo de comparar contra algo ya cambiado |
| Stockfish como referencia solo de desarrollo | El principio rector prohíbe dependencias en ejecución; como regla de medir es válido | Elo de un torneo, imposible con 82 posiciones |
| No subir la profundidad del coach | B3 midió que 5 o 6 medias jugadas **no** mejoran los veredictos y multiplican el tiempo por 3 a 5 | Profundidad fija 6 |
| Arreglar el origen (evaluación del motor) en lugar de capar veredictos de sacrificio | Capar bajaría la detección de los sacrificios incorrectos | Excepción general para sacrificios |
| Separar las pruebas de reloj real de la suite funcional | Fallaban con cobertura por la instrumentación, no por un defecto | Subir los umbrales, que habría ocultado la lentitud real |
| Aceptar excepciones escritas en lugar de seguir afinando el motor | El proyecto exige un punto de parada antes de afinar | Seguir hasta cero errores |
| Medir las cifras del README por código, no a mano (B9) | Las cifras a mano se desfasan (894 pruebas escritas, 1.152 reales) | Revisión manual en cada PR |
| El texto del aviso de versión se corrige con la medición | Decía que se reiniciaba la partida; B6 comprobó que se conserva | Dejarlo |

## 12. Protocolo de la auditoría independiente final

Objetivo: que quien audite **no haya implementado nada** y trabaje contra producción, no contra el código que conoce.

**Quién y desde dónde.** Una o dos conversaciones nuevas, sin acceso a los hilos ni a la memoria de este proyecto. Pueden ser las mismas dos que auditaron `5e9e946` (ChatGPT y Claude) para poder comparar, y conviene una tercera ajena. Se les da solo la URL de producción, el repositorio en lectura y los cuatro documentos de entrada del apartado siguiente.

**Qué se les entrega:** [este informe](informe-rc.md) (sin el apartado 11, que explica el porqué de las decisiones y sesga), `bench/README.md`, las dos auditorías originales y el plan [consolidacion-rc.md](consolidacion-rc.md).

**Qué deben hacer:**

1. Fijar el commit: anotar el de producción (lo muestra Vercel) y comprobar que es el de la RC. Si no coincide, parar.
2. Repetir sus casos originales: los 11 del coach de la tabla de reproducción de `consolidacion-rc.md` y las 12 posiciones de las auditorías, en la interfaz real (no en Node).
3. Jugar al menos tres partidas completas contra Difícil y revisarlas con el repaso, y subir una partida PGN propia.
4. Ejecutar el banco en un clon: `npm ci`, `npm test`, `npm run bench:posiciones` y comprobar que la huella coincide con la del informe (apartado 8). Si no hay Stockfish, la referencia ya está guardada en `bench/referencia-stockfish.json`.
5. Medir las cabeceras de producción desde un navegador normal (no desde un centro de datos) y la instalación y el uso sin conexión.
6. Buscar contradicciones nuevas con partidas libres, no con las posiciones del banco.

**Criterios de aceptación:**

- Ningún defecto P0 nuevo (el coach no se contradice en partidas libres).
- Los 11 casos originales no reproducen, salvo las excepciones del apartado 5 (H-14, H-02b, H-10).
- La huella del banco coincide, y las pruebas y la CI pasan.
- Las cabeceras de producción coinciden con `vercel.json` y no hay `noindex` en el dominio propio.
- Todo lo que reporten se clasifica con la misma leyenda de la matriz (reproducido, confirmado en código, pendiente de validación, recomendación).

**Cómo se informa:** un documento por auditor, con la matriz de hallazgos, y un resumen con el balance contra los criterios de arriba. Los hallazgos nuevos entran como issues en GitHub con las etiquetas `rc` y `ola-6`; solo se corrige lo que sea P0 o P1 antes de dar la RC por cerrada.

**Qué no se les pide:** valorar el diseño visual (ya hubo dos revisiones visuales) ni probar los errores de entrada fuera de alcance (H-16, H-17).
