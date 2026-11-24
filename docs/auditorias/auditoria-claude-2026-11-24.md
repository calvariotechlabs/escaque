> Copia textual de la auditoría de Claude (Claude Docs, revisión 18), exportada el 24-nov-2026 para conservarla como evidencia. Original: https://claude.ai/artifact/7MJRot4Q9t4PvwxriCp1bE. Las capturas y la gráfica de Stockfish solo están en el original.

# Auditoría de Escaque

2026-11-24 · Sergio (CalvarioTechLabs)

## Alcance y método

Auditoría hecha el 24 de noviembre de 2026 sobre la versión en producción ([escaque.calvariotechlabs.com](https://escaque.calvariotechlabs.com/)) y sobre el repositorio en el commit `5e9e946` (PR #57). No se ha modificado ni la app ni el repositorio.

| Fuente de evidencia | Qué se hizo | Cómo distinguirla en el informe |
|---|---|---|
| Uso real de la app | Navegador integrado del escritorio. Partidas, lecciones, PGN, recarga, móvil, teclado. Clics reales y, para mover piezas con rapidez, eventos de puntero sobre las casillas del propio tablero | **Verificado (app)** |
| Análisis externo posterior | Stockfish 16 (profundidad 18) sobre el PGN de la partida 1, **después** de jugarla, solo para medir la calidad de las jugadas. Las jugadas las elegí yo durante la partida | **Verificado (Stockfish)** |
| Ejecución del código | Clon del repo, `npm ci`, `npm test`, `npm audit` y un script propio que llama a `chooseMove` del motor compilado | **Verificado (código)** |
| Lectura de documentación | README y comentarios del código | **Documentado (no verificado)** |

Limitaciones del entorno, que no son defectos de Escaque:

- El panel del navegador quedó oculto durante parte de la sesión. Con el panel oculto el navegador ralentiza los temporizadores, así que solo doy tiempos de respuesta medidos con el panel visible (partida 1, jugadas 1 a 33).
- No pude cortar la red ni instalar la PWA desde el panel: el modo sin conexión se ha comprobado de forma indirecta (service worker activo y caché completa), no desconectando.
- El terminal de la auditoría no puede leer cabeceras HTTP de producción (proxy) y la CSP de la página bloquea `fetch` desde la consola. Las cabeceras de seguridad se dan como configuradas en `vercel.json`, no como medidas.
- No hay lector de pantalla real: la accesibilidad se ha probado con teclado real y leyendo los anuncios ARIA.

## Resumen ejecutivo

**Veredicto: publícalo en el portfolio, pero antes corrige el coach.** Escaque está muy por encima de un proyecto de demostración en reglas, accesibilidad, ingeniería y honestidad documental. Su punto débil es justo lo que promete: que el entrenador enseñe bien.

Lo que funciona (verificado):

- **Reglas completas y correctas.** Enroque (incluido el bloqueo por casilla atacada), captura al paso, coronación con subpromoción, jaque mate, ahogado y triple repetición se comportaron bien en la app. 1.045 tests pasan en 22 s y el generador de jugadas está validado con perft.
- **Motor estable y rápido de respuesta.** En Difícil respondió siempre entre 0,91 y 0,98 s (33 jugadas medidas con el panel visible). Nunca hizo una jugada ilegal y aprovechó todos los errores groseros que cometí a propósito.
- **Accesibilidad de primer nivel.** Se juega entera con teclado (flechas + Intro) y cada jugada se anuncia para lector de pantalla.
- **Producto cuidado.** Persistencia tras recargar, confirmación antes de perder una partida, PGN de ida y vuelta, 15 lecciones con corrección específica, tema claro y oscuro, móvil sin desbordes, PWA con 90 ficheros precacheados, cero dependencias en ejecución.

Lo que falla:

- **El coach es más débil que el rival y a veces se contradice.** Analiza a profundidad 4. Calificó de «Error grave» el sacrificio 6.Cxf7, que Stockfish da como la mejor jugada (+1,0), y muestra «Mejor jugada» junto a otra jugada recomendada distinta.
- **El motor juega mal posiciones tácticas abiertas.** En la partida 1 Alfil Beta llegó a estar a −8,5 según Stockfish (10…Da5 pierde 4 peones de valor); ganó porque yo no rematé y luego regalé la dama. Lo reproduje en Node: elige 10…Da5 a profundidad 4.
- **Documentación desfasada en detalles** (dice 894 tests y seis lecciones; hay 1.045 y quince).

No atribuyo Elo: dos partidas no bastan, y el propio README tampoco lo hace. Nota global ponderada: **8,0 / 10**.

## Partidas disputadas

**Partida 1: derrota por jaque mate en 35 jugadas** (yo con blancas contra Alfil Beta, nivel Difícil). Fue una partida ganada que perdí: Alfil Beta cometió errores graves en la apertura, yo no los rematé y después regalé la dama.

`1. e4 e5 2. Cf3 Cc6 3. Ac4 Cf6 4. Cg5 d5 5. exd5 Cxd5 6. Cxf7 Rxf7 7. Df3+ Re6 8. Cc3 Cb4 9. De4 c6 10. a3 Da5 11. d4 Ad6 12. dxe5 Ac7 13. O-O Ca6 14. Td1 Td8 15. b4 Cxb4 16. Ab2 Ca6 17. Dg4+ Rf7 18. e6+ Axe6 19. Df3+ Rg8 20. Axd5 cxd5 21. De3 Cc5 22. Ce2 Ce4 23. Cd4 Ab6 24. Dh3 Axh3 25. gxh3 Td6 26. Cf5 Tg6+ 27. Cg3 Axf2+ 28. Rg2 Dc7 29. Rf1 Dc4+ 30. Rg2 Dxc2 31. Tac1 De2 32. Tc8+ Txc8 33. Tf1 Axg3+ 34. Tf2 Dxf2+ 35. Rh1 Dxh2# 0-1`

_[embed: imagen o gráfico del original, no incluido]_

| Momento | Quién | Stockfish (antes → después) | Qué pasó |
|---|---|---|---|
| 5…Cxd5 | Alfil Beta | +0,25 → +1,38 | Entra en el Fegatello («Fried Liver»). Lo teórico es 5…Ca5 |
| 10…Da5 | Alfil Beta | −0,82 → +3,29 | Error grave del motor; lo correcto era 10…Ca6 |
| 11…Ad6 / 12…Ac7 | Alfil Beta | hasta +6,60 | Dos errores más; el rey negro queda expuesto en e6 |
| 12.dxe5, 14.Td1, 16.Ab2, 17.Dg4+ | Yo | +8,5 → +4,6 | No vi 12.axb4, 16.axb4 ni 17.Dxh7, que ganaban |
| 18.e6+ | Yo | +4,60 → 0,00 | Tiré la ventaja entera |
| 24.Dh3 | Yo | −3,94 → −10,07 | Dejé la dama atacada por el alfil de e6 |

Tiempo de respuesta en Difícil (jugadas 1 a 33, panel visible): mínimo 0,91 s, máximo 0,98 s, siempre por debajo del segundo que promete la pantalla. Las jugadas 34 y 35 marcaron 18,8 s, pero coincidieron con el panel oculto y con un fallo de mi script al detectar el final; no lo cuento como dato.

**Partida 2: prueba de errores deliberados** (blancas contra Difícil, sin terminar). `1. e4 e5 2. Ac4 Cc6 3. Dh5 De7 4. Dg5?? Dxg5` (deshecha con «Deshacer») `4. Axf7+? Dxf7 5. Dxf7+ Rxf7 6. Ca3 Cf6 7. g4? Cxe4 8. d3 Ab4+`. El motor capturó la dama colgada, el alfil sacrificado sin compensación y el peón libre de e4, y no cayó en el mate del pastor (3…De7). El coach marcó los tres errores con el aviso correcto.

**Pruebas cortas de nivel.** Medio (con negras): capturó al momento un alfil regalado en a3. Fácil (tres partidas con 1.e4 2.Dg4): respondió 1…Ca6, 1…b6 y 1…d5, es decir, varía de verdad; cuando la dama quedó colgada (tras 1…d5) la capturó, y cuando no lo estaba jugó h5 o h6, jugadas flojas propias de un nivel de iniciación.

## Comportamiento del motor

**Alfil Beta es un motor fiable para aprender pero débil en posiciones abiertas con el rey expuesto.** Castiga los errores de una jugada y responde siempre en menos de un segundo, pero a profundidad 4 o 5 no ve los ataques de varias jugadas.

| Aspecto | Resultado | Evidencia |
|---|---|---|
| Legalidad | Ninguna jugada ilegal en 2 partidas y 6 pruebas cortas | Verificado (app) |
| Castigo de errores groseros | Capturó dama colgada, alfil regalado y peón libre en los tres casos; no cayó en el mate del pastor | Verificado (app) |
| Remate | Dio mate en 10 jugadas desde una posición ganada; Stockfish coincide en 7 de esas 10 jugadas y las otras 3 también mantienen el mate | Verificado (Stockfish) |
| Aperturas | Sin libro: juega teoría por casualidad. Ante el Fegatello eligió 5…Cxd5, la línea dudosa | Verificado (Stockfish) |
| Táctica en posición abierta | 10…Da5 (−4,1 peones), 11…Ad6 (−3,9) y 12…Ac7 (−3,1) seguidas | Verificado (Stockfish y Node) |
| Tiempo por jugada en Difícil | 0,91–0,98 s en el navegador; 0,90–0,91 s en Node | Verificado (app y código) |
| Profundidad alcanzada en Difícil | 5 en la apertura, 4 en la posición de la partida y en Kiwipete, 6 en un final de torres | Verificado (código) |
| Velocidad | 115.000 a 380.000 nodos/s en un hilo | Verificado (código) |
| Determinismo | En Difícil repite exactamente las mismas respuestas (1.e4 e5 en ambas partidas) | Verificado (app) |
| Variedad en Fácil | Tres respuestas distintas a 1.e4 en tres partidas | Verificado (app) |

Por qué falla (código): la evaluación es solo material más tablas por casilla, sin seguridad del rey, movilidad ni estructura de peones. Con el rey negro en e6, para el motor la posición vale poco más que el recuento de piezas, y a profundidad 4 no llega a ver el castigo. Reproduje el error fuera del navegador: `chooseMove` en Difícil sobre la posición tras 10.a3 devuelve `d8a5` a profundidad 4 en 0,9 s.

El determinismo en Difícil tiene una consecuencia práctica: quien encuentra una línea ganadora puede repetirla siempre. Para un motor de aprendizaje es aceptable; conviene decirlo o añadir algo de variedad en la apertura.

Sobre la fuerza: el README dice que cada nivel gana 20 de 20 al anterior, lo que da más de 300 puntos Elo entre niveles, y declara que no hay Elo absoluto. Lo comparto: con dos partidas mías no hay base para dar una cifra.

## Evaluación del entrenador

**El coach detecta muy bien los errores groseros y explica mal todo lo demás.** Las piezas colgadas, las capturas no vistas y las pistas graduales funcionan. Pero evalúa a profundidad 4, menos que el rival al que comenta, y en posiciones tácticas se equivoca de signo.

| Jugada | Lo que dijo el coach | Stockfish 16 | Juicio |
|---|---|---|---|
| 4.Dg5?? (partida 2) | Error grave. «Pieza colgando: tu dama de g5 está atacada por la dama de e7» | Pierde la dama | Correcto |
| 7.g4? (partida 2) | Imprecisión. Dos piezas colgando, recomienda d3 para salvar e4 | Pierde un peón | Correcto y bien explicado |
| 24.Dh3?? | Error grave, dama atacada por el alfil de e6 | −3,94 → −10,07 | Correcto |
| Pistas 1-2-3 | «Mira las jugadas que dan jaque», «Mueve la dama de h5», «Alfil Beta jugaría Dxf7+» con flecha | Dxf7+ es lo mejor | Muy buen diseño pedagógico |
| 6.Cxf7 | Error grave (−0,4 → −2,2). Recomienda 6.Cc3, cuya línea deja el caballo de g5 en prise (6…Dxg5) | Es la mejor jugada (+1,38 → +1,01) | **Incorrecto** y enseña algo falso |
| 13.O-O | Imprecisión: «deja el peón de e5 en peligro» | Mejor jugada (+6,83). Si 13…Axe5, el alfil queda clavado y f4 lo gana | **Incorrecto**: el aviso cuenta atacantes sin ver clavadas |
| 12.dxe5 | «Mejor jugada. dxe5 gana un peón» y debajo «Mejor jugada: Tb1» | Pierde 2,25 (lo mejor era axb4) | **Contradictorio** |
| 2.Cf3 | «Mejor jugada. Es la jugada que elige Alfil Beta» y debajo «Mejor jugada: Cc3» | Mejor jugada | **Contradictorio** |
| 32.Tc8+ | «Buena jugada. La diferencia con la mejor jugada es pequeña» tras regalar una torre (−19,5 → −24,7) | Mate inevitable en ambos casos | Defendible en el cálculo, engañoso en el texto |
| 10.De6 (ahogado, partida a dos) | Error grave: «no aprovecha la captura del alfil de f8» | Tablas con +19 | Bien clasificado; no menciona el ahogado, que es la lección |

**Coherencia de la evaluación.** Entre las jugadas 8 y 12 de la partida 1 el coach mostró entre −1,3 y −2,1 para las blancas; Stockfish daba entre −0,7 y +5,8, y +3,3 o más desde 10…Da5. Un principiante que se fíe del coach aprenderá que el sacrificio fue malo cuando ganó la partida.

**Explicaciones genéricas.** Muchas jugadas acaban en «No hay un motivo táctico: Alfil Beta la prefiere por cómo quedan las piezas (−0,5 frente a −9,7)». En 4.Dg5?? esa frase convive con el aviso de dama colgada: dice que no hay motivo táctico justo cuando lo hay.

Causas en el código (`src/coach/analyze.ts`):

- `COACH_LIMITS` es profundidad 4 y 3 s; el rival en Difícil llega a 4-5 en 0,9 s y sigue profundizando. El README dice «como mucho 0,6 s».
- El veredicto es «mejor» si la pérdida es 0 aunque la jugada recomendada sea otra (`isBest || loss === 0`). La interfaz pinta las dos cosas a la vez.
- El aviso de pieza colgando compara atacantes y defensores sin mirar clavadas.
- Los veredictos usan puntos esperados (curva logística). Es la práctica habitual, pero con la partida decidida casi todo sale «Buena jugada» y el texto fijo «la diferencia es pequeña» queda falso.

**Utilidad pedagógica.** Para principiantes, el coach es útil en lo que más necesitan: no colgar piezas y ver capturas. Para jugadores con experiencia hoy resta, porque contradice la teoría y a Stockfish en posiciones tácticas. Las lecciones guiadas, en cambio, son correctas y bien explicadas (ver pruebas funcionales).

## Pruebas funcionales

**26 de 30 pruebas pasan; 2 muestran limitaciones menores y 2 no se pudieron hacer en este entorno.** Nada de lo probado rompió la app ni dejó errores en la consola.

| Área | Prueba | Resultado |
|---|---|---|
| Movimientos | Mostrar jugadas legales al seleccionar una pieza | Pasa: puntos en las casillas destino |
| Movimientos | Jugada ilegal (caballo b8→d5; mover otra pieza estando en jaque; hxg3 sin salir del jaque) | Pasa: se rechaza sin cambiar nada |
| Movimientos | Aviso al usuario tras una jugada ilegal | **Limitación**: se deselecciona en silencio, sin explicar por qué |
| Fin de partida | Jaque mate (mate del loco, dos jugadores) | Pasa: «Jaque mate. Ganan las negras.» |
| Fin de partida | Ahogado (secuencia de 10 jugadas) | Pasa: «Tablas. Por ahogado.» |
| Fin de partida | Triple repetición (Cf3 Cf6 Cg1 Cg8 ×2) | Pasa, se declara automáticamente y bloquea más jugadas |
| Fin de partida | Material insuficiente y 50 jugadas | No probado en la app; cubierto por tests (`insufficient-material`, `fifty-move`) |
| Reglas especiales | Captura al paso con clics | Pasa |
| Reglas especiales | Coronación con selector y subpromoción a caballo | Pasa: `cxb8=C` |
| Reglas especiales | Enroque con la casilla de llegada atacada | Pasa: rechazado; tras quitar el alfil atacante, permitido |
| Niveles | Fácil, Medio y Difícil; jugar con negras (el tablero gira solo) | Pasa |
| Deshacer / rehacer | Deshacer contra la máquina | Pasa: quita tu jugada y la respuesta; «Rehacer» se activa y se desactiva al jugar otra cosa |
| Reiniciar | «Nueva partida» a mitad de partida | Pasa: pide confirmación («Se perderán las 14 jugadas») |
| Repaso | Análisis de 70 medias jugadas, gráfica, errores clave, navegación | Pasa: listo en 27 s con el panel oculto (el README dice unos 8 s; no comparable) |
| PGN | Exportar | Pasa: PGN estándar válido (`escaque-2026-11-24.pgn`, SAN en inglés) |
| PGN | Importar con al paso, coronación y enroques | Pasa: posición final exacta |
| PGN | Importar con jugada ilegal | Pasa: «La jugada 2. Nf6 no es legal en esa posición.» |
| PGN | Importar en notación española (`2. Cf3`) | **Limitación**: se rechaza como «no legal», aunque la app muestra las jugadas en español |
| PGN | Cabeceras con HTML (`<b id=xss>`) | Pasa: se muestran como texto, no se inyectan |
| Lecciones | Lista: 9 de primeros pasos + 6 tácticas | Pasa |
| Lecciones | «Corona sin ahogar»: respuesta errónea y correcta | Pasa: explica por qué c8=D ahoga; con c8=T responde Ra6 y acepta Ta8# |
| Persistencia | Recargar a mitad de partida | Pasa: tablero, lista, coach y nivel intactos |
| Persistencia | Recargar mientras piensa la máquina | Pasa: al volver, responde (8…Ab4+) |
| Robustez | Partida guardada corrupta en `localStorage` | Pasa: se descarta y se abre la pantalla inicial, sin errores en consola |
| Pistas | Tres pistas progresivas | Pasa |
| Accesibilidad | Jugar con teclado (flechas + Intro) | Pasa: Cb8→c6 y anuncio «Negras: Cc6. Caballo de b8 a c6.» |
| Móvil | 375 × 812 px | Pasa: sin desplazamiento horizontal; casillas de 41 px |
| Temas | Claro y oscuro según el sistema | Pasa |
| PWA | Service worker y precaché | Pasa: activo, 90 ficheros en caché (incluidos los dos Workers); la navegación ya se sirve desde la caché |
| PWA | Instalar y jugar sin red | No probado: el entorno no permite cortar la red ni instalar |

No se encontraron fallos que bloqueen el uso.

## Auditoría UX/UI

**La experiencia es sobria, clara y accesible; sus puntos flojos son el coach demasiado largo y la falta de respuesta ante errores del usuario.**

| Aspecto | Valoración | Observaciones |
|---|---|---|
| Primera impresión | Muy buena | En la portada se elige modo, nivel y color en una sola pantalla, con una frase que explica cada nivel. La invitación a las lecciones para quien nunca ha jugado está bien resuelta |
| Identidad visual | Buena | Tablero verde y crema, piezas propias en SVG, tipografía Space Grotesk + IBM Plex y logotipo propio. Coherente, pero con poca personalidad en la portada |
| Facilidad de aprendizaje | Muy buena | Puntos de jugadas legales, última jugada resaltada, «TE TOCA», coach y pistas sin pedir registro |
| Navegación | Buena | Dos secciones (Jugar, Lecciones) con rutas propias (`#/lecciones/corona-sin-ahogar`). Falta un acceso al repaso desde la partida en curso |
| Accesibilidad | Excelente | Tablero como `grid` con foco itinerante, etiquetas por casilla («e2, peón blanco»), anuncios `aria-live`, `lang="es"`, diálogos nativos. No probado con lector real |
| Escritorio y móvil | Buena | Dos columnas en escritorio ancho; una columna en móvil sin desbordes. En móvil hay que bajar mucho para leer el coach tras cada jugada |
| Fluidez | Muy buena | Respuesta en menos de 1 s; animación de piezas; nada bloquea la interfaz porque el motor vive en un Worker |
| Mensajes de error | Mejorable | Los de PGN son claros. Una jugada ilegal no tiene ningún mensaje. El PGN en notación española da un error engañoso |
| Estados de la app | Muy buena | «Juegan las blancas / TE TOCA», «JAQUE», «Revisando tu jugada», pantalla de resultado con revancha y repaso |
| Rendimiento percibido | Muy bueno | Carga desde la caché del service worker en unos 260 ms (medida del navegador). El repaso de partidas largas es lento |

**Problema principal de UX: el panel del coach.** Tras cada jugada muestra a la vez pista, veredicto, mejor jugada, «por qué», línea, dos barras de evaluación y avisos. Es mucho texto para un principiante, y es ahí donde aparecen las contradicciones del apartado anterior. Una versión corta (veredicto + una frase + «ver más») mejoraría la lectura y dejaría menos sitio a mensajes que se contradicen.

## Auditoría técnica

**Ingeniería de nivel profesional para el tamaño del proyecto: arquitectura limpia, tests serios, CI estricta y seguridad cuidada.** Las debilidades están en el dominio (evaluación del motor y profundidad del coach), no en la ingeniería.

| Área | Qué hay | Fuente | Nota |
|---|---|---|---|
| Arquitectura | `core` (reglas, 0x88, Zobrist, PGN), `engine`, `coach`, `lessons`, `worker`, `pwa`, `ui`. El dominio no depende de la interfaz | Verificado (código) | 9 |
| Tamaño | 21.900 líneas en TS, CSS y scripts; ficheros grandes: `ui/main.ts` (1.050) y `core/position.ts` (982) | Verificado (código) | — |
| Búsqueda | Negamax alfa-beta, profundización iterativa, quietud (capturas y coronación a dama), extensión de jaque, tabla de transposición de 2^18 entradas, MVV-LVA, mates por distancia, tablas dentro de la búsqueda | Verificado (código) | 7 |
| Lo que falta en la búsqueda | Sin jugada nula, LMR, killers, historial, PVS ni ventanas de aspiración. La quietud genera todas las jugadas legales y luego filtra | Verificado (código); el README lo reconoce | — |
| Evaluación | Material + tablas por casilla, interpolación de rey medio juego/final. Sin seguridad de rey, peones ni movilidad | Verificado (código) | 5 |
| Web Workers | Motor y coach en Workers separados; cancelar = terminar el Worker y crear otro; mensajes validados | Verificado (código y app: varias cargas de `engine-worker.js`) | 8 |
| Pruebas | **1.045 tests, 0 fallos, 22 s**: perft en 21 posiciones, reglas especiales, PGN, coach, lecciones, interfaz; 13 suites e2e con Chrome real por CDP | Verificado (ejecutado; e2e no ejecutadas aquí) | 9 |
| Huecos de prueba | Ningún test detecta «veredicto mejor con otra mejor jugada» ni valida al coach contra un motor de referencia | Verificado (código y app) | — |
| Seguridad | CSP sin `unsafe-inline`, `frame-ancestors 'none'`, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, COOP; un test impide código en línea. `innerHTML` solo con marcado propio; cabeceras PGN escapadas; límites de tamaño en PGN | Configuración leída en `vercel.json`; escape verificado en la app | 9 |
| Dependencias | Ninguna en ejecución; solo TypeScript 6.0.3 en desarrollo. `npm audit`: 0 vulnerabilidades | Verificado | 10 |
| CI/CD | GitHub Actions con permisos de solo lectura y acciones fijadas por hash: tipos, tests, perft completo, e2e de accesibilidad y «dependencies vacío». Vercel despliega en `fra1` | Leído en `ci.yml` y `vercel.json` | 9 |
| Documentación | README extenso, honesto (no inventa Elo, explica qué haría distinto) y con cifras medidas. Desfases: 894 tests (hay 1.045), «seis lecciones» (hay 15), coach «como mucho 0,6 s» (el código dice 3 s) | Verificado | 7 |
| Preparación para producción | Sitio estático, PWA con actualización controlada, persistencia robusta ante datos corruptos, sin backend ni cookies | Verificado | 8 |
| Proceso con IA | 173 commits en 13 días (11–24 nov. 2026), 115 de Claude; 64 citan tickets `CAL-`. Hooks de Claude Code que bloquean comandos peligrosos y pasan `tsc` tras cada edición | Verificado (historial git) | — |

Un detalle de cumplimiento: la web no tiene aviso legal ni política de privacidad. No usa cookies ni analítica (solo `localStorage` para la partida y el progreso, que es técnicamente necesario), así que no necesita banner. Para un proyecto personal sin actividad económica la LSSI probablemente no obliga, pero una línea de identificación y privacidad en CalvarioTechLabs es barata y profesional. No soy abogado: confírmalo si un día tiene uso comercial.

## Incidencias

**Ninguna incidencia es bloqueante; las dos de severidad alta afectan a la promesa central (aprender con el coach).** Severidad: Alta = enseña algo incorrecto o contradictorio; Media = degrada la experiencia; Baja = detalle.

| ID | Severidad | Incidencia | Pasos para reproducir | Evidencia |
|---|---|---|---|---|
| ESC-01 | Alta | El coach califica de «Error grave» jugadas buenas en posiciones tácticas y recomienda líneas que pierden material | Difícil, blancas: 1.e4 e5 2.Cf3 Cc6 3.Ac4 Cf6 4.Cg5 d5 5.exd5 Cxd5 6.Cxf7 | Coach: −0,4 → −2,2, «Error grave», línea 6.Cc3 Dxg5. Stockfish: 6.Cxf7 es la mejor (+1,0) |
| ESC-02 | Alta | El veredicto dice «Mejor jugada» y debajo recomienda otra jugada como mejor | Misma partida, 2.Cf3 o 12.dxe5 | «Mejor jugada. Es la jugada que elige Alfil Beta.» + «Mejor jugada: Cc3». Causa: `verdict = isBest \|\| loss === 0 ? "mejor"` |
| ESC-03 | Media | El aviso «pieza colgando» ignora las clavadas | Partida 1, 13.O-O | «O-O deja el peón en peligro»; 13…Axe5 pierde el alfil por f4. Stockfish: 13.O-O es la mejor |
| ESC-04 | Media | «Por qué: No hay un motivo táctico» aparece junto a una dama colgada | Partida 2, 4.Dg5 | Captura del panel del coach (07) |
| ESC-05 | Media | El motor comete errores de 3 a 4 peones en posiciones abiertas | Posición tras 10.a3 de la partida 1; `chooseMove(pos, 'dificil')` | Devuelve `d8a5` a profundidad 4; Stockfish: −4,1 |
| ESC-06 | Media | «Buena jugada. La diferencia es pequeña» tras regalar una torre en posición perdida | Partida 1, 32.Tc8+ | Coach: −19,5 → −24,7, «Buena jugada» |
| ESC-07 | Baja | Una jugada ilegal no muestra ningún mensaje | Seleccionar Cb8 y pulsar d5 | La pieza se deselecciona en silencio (captura 08) |
| ESC-08 | Baja | El PGN en notación española se rechaza con un mensaje engañoso | Cargar PGN: `1. e4 e5 2. Cf3 Cc6` | «La jugada 2. Cf3 no es legal en esa posición.» |
| ESC-09 | Baja | El coach no nombra el ahogado cuando es la causa del error | Dos jugadores, ahogado en 10 jugadas (10.De6) | «no aprovecha la captura del alfil de f8» |
| ESC-10 | Baja | Documentación desfasada | README | 894 tests (hay 1.045), seis lecciones (hay 15), coach 0,6 s (código: 3 s) |
| ESC-11 | Baja | Difícil es determinista: la misma línea gana siempre | Repetir la misma apertura | 1.e4 e5 idéntico en dos partidas; coherente con `marginCp: 0` |

## Capturas reales

Todas tomadas en el navegador durante esta auditoría, sin retoque. Cada imagen va bajo su pie.

**01 · Primera visita.** Configuración de la partida e invitación a las lecciones.

[media: Pantalla inicial de Escaque]

**04 · Fin de la partida 1.** Derrota por mate con acceso a revancha y repaso.

[media: Pantalla de derrota de la partida 1]

**05 · Repaso de la partida 1.** Curva de evaluación de Alfil Beta y errores marcados; compárese con la gráfica de Stockfish de arriba.

[media: Gráfica de evaluación del repaso]

**07 · Coach ante 4.Dg5?? (ESC-04).** Aviso correcto de dama colgada junto a «No hay un motivo táctico».

[media: Coach ante la dama colgada]

**12 · Pistas progresivas.** Las tres pistas desplegadas tras 4.Axf7+.

[media: Tres pistas desplegadas]

**11 · Error de PGN.** Mensaje claro ante una jugada ilegal.

[media: Error al cargar un PGN con jugada ilegal]

**15 · Lección «Corona sin ahogar».** Objetivo y tablero de la lección.

[media: Lección Corona sin ahogar]

**14 · Móvil (375 × 812).** Partida en curso en una columna.

[media: Partida en móvil]

## Valoraciones

**Nota global: 8,0 sobre 10** (producto 7,7 con peso 60 %; ingeniería 8,6 con peso 40 %). El producto pesa más porque es lo que verá quien abra la demo.

| Bloque | Categoría | Nota | Justificación |
|---|---|---|---|
| Producto | Reglas y corrección | 9,5 | Todas las reglas probadas funcionan; perft validado. Resta la falta de aviso ante jugadas ilegales |
| Producto | Motor | 6,0 | Estable, rápido y castiga lo obvio; errores de 3-4 peones en táctica abierta y sin variedad en Difícil |
| Producto | Coach | 5,0 | Excelente con piezas colgadas y pistas; contradicciones visibles y juicios erróneos en posiciones tácticas |
| Producto | Lecciones | 8,5 | 15 lecciones correctas con feedback específico; pocas para un usuario con algo de nivel |
| Producto | UX/UI | 8,0 | Clara y cuidada; coach demasiado denso, sin feedback de errores de entrada |
| Producto | Accesibilidad | 9,0 | Teclado completo, ARIA y anuncios; falta prueba con lector real |
| Ingeniería | Arquitectura y código | 9,0 | Capas limpias, TypeScript estricto, cero dependencias |
| Ingeniería | Pruebas | 9,0 | 1.045 tests verdes y e2e propios; no validan el coach contra una referencia |
| Ingeniería | Seguridad | 9,0 | CSP estricta, escape correcto, límites de entrada; cabeceras no medidas en producción |
| Ingeniería | CI/CD | 9,0 | Acciones fijadas por hash, permisos mínimos, perft y e2e en cada PR |
| Ingeniería | Documentación | 7,5 | Honesta y rica, con cifras desfasadas |
| Ingeniería | Rendimiento | 8,0 | Carga instantánea y respuesta < 1 s; repaso lento |

## Comparativa con Lichess y Chess.com

**Escaque no compite con ellos y no debe presentarse así: es una demostración de oficio hecha por una persona en dos semanas, frente a plataformas con años de desarrollo y motores de clase mundial.** La comparación útil es en qué aspectos concretos se acerca o los supera. Comparación cualitativa, de conocimiento general y sin medir esas plataformas en esta auditoría.

| Aspecto | Escaque | Lichess | Chess.com |
|---|---|---|---|
| Motor | Propio, profundidad 4-6, sin libro; tácticamente frágil | Stockfish, fuerza muy superior a cualquier humano | Motores de máxima fuerza y bots con personalidad |
| Análisis de errores | Coach propio a profundidad 4, con contradicciones | Análisis con Stockfish, fiable, explicaciones escuetas | Revisión de partida con explicaciones en lenguaje natural |
| Lecciones | 15 cortas y bien corregidas | Gran catálogo gratuito de práctica y problemas | Cursos y lecciones extensos |
| Accesibilidad | Muy cuidada: teclado completo y ARIA desde el diseño | Buena, con modo para invidentes | Variable según la sección |
| Privacidad | Sin cuentas, sin analítica, sin red tras la primera carga | Sin anuncios ni rastreo comercial | Cuenta, analítica y publicidad según el plan |
| Sin conexión | PWA completa, motor incluido | Uso principalmente en línea | Uso principalmente en línea |
| Juego en línea | No | Sí | Sí |

Donde Escaque puede presumir: privacidad total, funcionamiento sin conexión con motor local y la accesibilidad con teclado. Donde nunca debe compararse: fuerza del motor y fiabilidad del análisis.

## Mejoras priorizadas

**Antes de publicar, solo hacen falta las P0: tres cambios acotados en el coach y el README.** El resto puede ir después.

| Prioridad | Mejora | Incidencia | Esfuerzo orientativo |
|---|---|---|---|
| P0 | Eliminar la contradicción de veredicto: si la jugada no es la elegida, no decir «Mejor jugada» (usar «Buena» o «Igual de buena») y no mostrar dos «mejores» | ESC-02 | Horas |
| P0 | Quitar «No hay un motivo táctico» cuando hay un aviso táctico, y no decir «la diferencia es pequeña» si la pérdida supera un umbral en peones | ESC-04, ESC-06 | Horas |
| P0 | Actualizar cifras del README (tests, lecciones, tiempo del coach) | ESC-10 | Minutos |
| P1 | Dar al coach al menos la profundidad del nivel Difícil y no emitir «Error grave» si una búsqueda más profunda no lo confirma | ESC-01 | 1-2 días |
| P1 | Considerar clavadas en el aviso de pieza colgando (o confirmarlo siempre con el motor) | ESC-03 | 1 día |
| P1 | Test de regresión del coach con posiciones conocidas (Fegatello, 13.O-O de la partida 1) evaluadas con Stockfish fuera del repo | ESC-01, ESC-03 | 1 día |
| P1 | Mensaje breve ante jugada ilegal («Ese caballo no puede ir a d5», «Estás en jaque») | ESC-07 | Horas |
| P2 | Evaluación con seguridad del rey y estructura de peones; después killers, historial y jugada nula | ESC-05 | Semanas |
| P2 | Libro de aperturas pequeño o azar acotado en las primeras jugadas de Difícil | ESC-11 | 1-2 días |
| P2 | Coach compacto: veredicto + una frase + «Ver análisis» | UX | 1-2 días |
| P2 | Medir Elo contra Stockfish con `UCI_Elo` limitado, fuera del repo, como plantea el README | — | 1 día |
| P3 | Aceptar notación española al importar PGN o explicar que se espera la inglesa | ESC-08 | Horas |
| P3 | Mencionar el ahogado en el coach cuando sea la causa | ESC-09 | Horas |
| P3 | Probar con TalkBack y VoiceOver reales | — | 1 día |
| P3 | Una línea de identificación y privacidad (o enlace a la de CalvarioTechLabs) | Cumplimiento | Minutos |

## Recomendación de publicación

**Sí, publícalo, tras las tres mejoras P0.** Sin ellas, un CTO que juegue cinco minutos verá «Mejor jugada» junto a otra «Mejor jugada», y eso empaña todo el trabajo de ingeniería que hay detrás.

Qué competencias demuestra:

- Diseño de algoritmos y estructuras de datos (0x88, Zobrist, alfa-beta, tabla de transposición) y su validación con perft.
- Producto completo de punta a punta: reglas, IA, pedagogía, UX, PWA y despliegue.
- Accesibilidad aplicada de verdad, no declarada.
- Seguridad por defecto (CSP estricta, cero dependencias, CI con permisos mínimos).
- Criterio de medición: bench con y sin tabla, partidas entre niveles, negativa a inventar un Elo.
- Dirección de desarrollo asistido por IA con tickets, hooks de control, revisiones y criterios de «terminado» propios.

Qué lo diferencia de una demo convencional: no usa ninguna librería de ajedrez ni framework, valida las reglas contra cifras publicadas y documenta qué aprendió y qué haría distinto.

Qué pensaría un CTO o responsable de ingeniería: «esta persona sabe dirigir a una IA para construir algo serio y sabe dónde están sus límites». La pregunta incómoda será cuánto del código entiende y defiende personalmente (115 de 173 commits son de Claude). La respuesta debe estar preparada: decisiones de diseño, criterios de parada y revisión, con ejemplos concretos como el de la tabla de transposición.

Valor como evidencia de ingeniería asistida por IA: alto. Muestra un proceso controlado (tickets `CAL-`, hooks, CI que impide regresiones), no código generado sin más. Esta auditoría también deja ver su límite: los tests comprueban que el código hace lo especificado, pero no que el coach acierte en ajedrez. Contarlo como aprendizaje suma credibilidad.

## Ficha y caso de estudio para CalvarioTechLabs

Propuesta lista para adaptar. Preséntalo como laboratorio de ingeniería e IA aplicada, no como «app de ajedrez»: el ajedrez es el dominio de prueba.

### Ficha

| Campo | Texto propuesto |
|---|---|
| Nombre | Escaque, con su motor Alfil Beta |
| Frase | Ajedrez para aprender, con un motor y un entrenador escritos desde cero, que funciona sin conexión y entero con teclado |
| Tipo | Producto propio · experimento de ingeniería asistida por IA |
| Estado | En producción desde noviembre de 2026 |
| Stack | TypeScript estricto sin dependencias en ejecución, Web Workers, Service Worker, Vercel (fra1), GitHub Actions |
| Cifras | 1.045 tests · perft exacto en 21 posiciones · respuesta < 1 s · 0 dependencias · 15 lecciones |
| Enlaces | Demo · Repositorio (MIT) |

### Caso de estudio (estructura)

- **El reto.** Construir en dos semanas un producto completo de un dominio con reglas exactas y verificables, sin librerías, dirigiendo a una IA como equipo de desarrollo.
- **Cómo se trabajó.** Hitos con criterio de «terminado», tickets, diseño previo en Claude Design, hooks que impiden comandos peligrosos y revisión de código antes de cada PR.
- **Decisiones técnicas.** Tablero 0x88 frente a bitboards, motor y coach en Workers, sitio estático con CSP estricta. Una frase de por qué en cada una.
- **Cómo se verificó.** Perft contra cifras publicadas, partidas entre niveles, e2e con Chrome real, auditoría externa.
- **Qué salió mal y qué se cambió.** Los hallazgos de esta auditoría sobre el coach y cómo se corrigieron (P0 y P1). Es la parte que más convence a un responsable técnico.
- **Lo aprendido sobre trabajar con IA.** La IA acelera la implementación; la corrección del dominio sigue necesitando una referencia externa.

Visuales recomendados: el GIF del README, la gráfica de repaso y una captura del tablero manejado con teclado.

No uses en la ficha un Elo, la palabra «IA que enseña como un gran maestro» ni comparaciones de fuerza con Lichess o Chess.com.

