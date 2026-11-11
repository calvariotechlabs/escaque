# Escaque

App web para aprender ajedrez con motor propio (**Alfil Beta**), escrita desde cero en TypeScript sin dependencias en ejecución: ni librerías de ajedrez, ni frameworks de interfaz. TypeScript solo se usa para compilar.

## Estado

**Hito 1 — Reglas + perft, sin interfaz: hecho.** Tablero 0x88, FEN, generador de jugadas legales (enroque, al paso, coronación), hacer/deshacer, notación algebraica estándar (SAN, escritura y lectura) y fin de partida completo: jaque mate, ahogado, material insuficiente, regla de 50 jugadas y triple repetición. Pasan todos los tests y todos los perft de referencia. Las tablas por 50 jugadas y por triple repetición son automáticas, sin reclamarlas, y la repetición sigue a la FIDE: cuentan el bando al mover, los derechos de enroque y solo las capturas al paso que sean legales.

Velocidad de perft (Node 22, un hilo): unos 9 a 10 millones de nodos por segundo; la inicial a profundidad 6 (119.060.324 nodos) en unos 12 s, y Kiwipete a profundidad 5 (193.690.690) en unos 21 s.

**Hito 3 — Alfil Beta: motor y Worker hechos.** Búsqueda, evaluación, tres niveles y el puente con el Web Worker, con tests y probado en el navegador. La pantalla para jugar contra la máquina (ajustes de modo, nivel y color, «Alfil Beta está pensando» y resultado con revancha) está programada y aprobada en diseño. Detalles y cifras en [Alfil Beta](#alfil-beta-el-motor).

| Hito | Descripción | Estado |
| --- | --- | --- |
| 0 | Repositorio, estructura y herramientas | Hecho |
| 1 | Reglas completas + perft | Hecho |
| 2 | Tablero jugable (dos jugadores) | Hecho |
| 3 | Máquina en Web Worker, 3 niveles | Motor y Worker hechos; falta la pantalla (pendiente de diseño) |
| 4 | Coach: explicación de errores | Hecho: lógica en `src/coach`, panel en la interfaz y cálculo en su propio Worker |
| 5 | 5–6 lecciones guiadas | Pendiente |
| 6 | Pulido para portfolio, CI y despliegue | Pendiente |

## Cómo se hizo

El diseño y las decisiones técnicas (arquitectura, tablero 0x88, estrategia de búsqueda, criterios de «terminado») son míos. La implementación está asistida con Claude y revisada por mí. Las decisiones y las cifras se irán documentando aquí a medida que avancen los hitos.

## Estructura

```
src/core     reglas: tablero 0x88, generador de jugadas, FEN, notación algebraica (SAN)
src/engine   Alfil Beta: evaluación + búsqueda (no depende de la interfaz)
src/coach    explicación de errores
src/lessons  lecciones como datos (FEN + objetivo + comprobación)
src/ui       tablero, controles, paneles
src/pwa      service worker, avisos (instalar, sin conexión, versión nueva) y registro
public/      manifest, favicon e iconos de la app
tools/       build-site (monta site/), serve, perft
src/worker   puente entre la interfaz y el motor
tests/       perft y reglas especiales
```

`core` y `engine` funcionan igual en Node y en el navegador.

## Desarrollo

Requiere Node LTS (22.3 o superior).

```sh
npm install      # solo instala TypeScript (devDependency)
npm run build    # tsc -> dist/ (módulos ES nativos)
npm test         # compila y ejecuta node --test (perft a profundidad rápida)
npm run test:perft   # perft a profundidad completa (unos 43 millones de nodos)
npm run perft -- <profundidad> ["<fen>"] [jugadas UCI...] [--ref <fichero>]
npm run build:site   # compila y monta site/ (lo que se publica) con el service worker versionado
npm run match    # partidas automáticas entre niveles (unos 15 min; «-- 4» para 4 por enfrentamiento)
npm run serve    # monta site/ y lo sirve en http://127.0.0.1:8080 (sin dependencias)
```

### Interfaz y diseño

Las piezas (doce SVG dibujados a mano, estilo de volumen con degradado) y el tablero se pintan con DOM y CSS a mano desde la colocación de una FEN: `src/ui/pieces.ts` y `src/ui/board.ts`. Los colores y medidas salen de `src/ui/tokens.css`, con tema claro y oscuro. `index.html` abre los ajustes de la partida (dos jugadores o contra Alfil Beta) y la partida, sin bundler (`npm run serve`), con la CSP puesta en una etiqueta `meta`.

La interacción está separada en dos capas. `src/ui/game.ts` (la partida por casillas, con deshacer, rehacer y lista de jugadas) y `src/ui/interaction.ts` (qué hace cada clic, arrastre o tecla, y qué casillas se marcan) no tocan el DOM y se prueban en Node. `src/ui/main.ts` solo traduce eventos a esas llamadas y pinta el resultado. Se juega con clic, arrastrando (también con el dedo) o con el teclado: flechas, Inicio/Fin, Re Pág/Av Pág, Intro o Espacio para elegir y Escape para cancelar. Cada jugada se anuncia a los lectores de pantalla en notación algebraica con letras españolas (C, A, T, D, R) y con palabras, y la coronación abre un diálogo modal.

### PWA y dispositivos

Escaque se adapta a móvil, tablet y escritorio y se instala como app (PWA). Puntos de corte: menos de 600 px (móvil), 600 a 859 px (tablet vertical, tablero de hasta 700 px) y desde 860 px (dos columnas); en horizontal bajo 500 px de alto el tablero se mide por el alto. Respeta las zonas seguras (muescas). `public/manifest.webmanifest` declara la app; `src/pwa/sw.ts` es un service worker propio, sin librerías, con caché versionada por contenido (`escaque-<hash>`), que deja jugar sin conexión. Cuando hay versión nueva, un aviso lo dice y avisa de que actualizar reinicia la partida (aún no se guarda). `npm run build:site` genera `site/` con la lista de ficheros a precachear. `vercel.json` publica `site/` (la región `fra1` está fijada, aunque al ser estático solo afectaría a funciones; HSTS lo pone Vercel) y fija las cabeceras de seguridad en todas las respuestas: CSP estricta (`default-src 'none'`, solo recursos propios, `frame-ancestors 'none'`), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` cerrada y `Cross-Origin-Opener-Policy: same-origin`. Al ser una web estática no hay nonce por petición: la CSP no admite `unsafe-inline`, y `tools/vercel-config.test.mjs` comprueba que el sitio no lleve scripts ni estilos en línea. El cortafuegos y la protección de bots se configuran en el panel de Vercel.

El diseño se hace antes en Claude Design y se copia en `docs/design` (README con origen, versión y fecha). Ningún cambio visual entra sin pasar por allí.

### Alfil Beta, el motor

Todo en `src/engine`, sin dependencias ni DOM: funciona igual en Node y en el navegador.

- **Búsqueda.** Negamax con poda alfa-beta y profundización iterativa con límite de tiempo. Si el tiempo se acaba a media iteración, vale la última completa, y la profundidad 1 siempre se termina. En las hojas, búsqueda de quietud con capturas y coronaciones a dama. Quien está en jaque no puede «quedarse quieto»: se miran todas sus respuestas, y sin ninguna es mate. Estar en jaque alarga la búsqueda una media jugada. Orden de jugadas: primero la de la tabla de transposición, luego capturas por MVV-LVA y luego coronaciones. Los mates se puntúan por distancia, así que busca el más corto y retrasa el suyo. Dentro de la búsqueda, una posición repetida, la regla de 50 jugadas (salvo que la jugada 100 dé mate) y el material insuficiente valen 0.
- **Clave Zobrist y tabla de transposición.** El núcleo mantiene una clave Zobrist de 64 bits en dos mitades de 32, porque los bitboards o las claves con BigInt serían lentos en JavaScript. Los números salen de un generador propio (mulberry32) con semilla fija. La casilla al paso solo entra en la clave si la captura al paso es legal, así que la misma clave sirve para la triple repetición de las reglas, para las repeticiones dentro de la búsqueda y para la tabla de transposición: 2^18 entradas en arrays tipados, unos 4 MB, sin crear objetos al buscar. Mantener la clave cuesta en torno a un 13 % de velocidad de perft.
- **Evaluación.** Material (P 100, C 320, A 330, T 500, D 900) más tablas de valor por casilla. El rey tiene una tabla para el medio juego y otra para el final, y se mezclan según el material que queda. Es simétrica: cambiar los colores no cambia la valoración, y hay un test que lo comprueba.
- **Niveles** (`chooseMove`):

  | Nivel | Cómo juega |
  | --- | --- |
  | Fácil | Puntúa todas las jugadas a profundidad 1 (más la quietud) y elige al azar entre las que quedan a menos de 1,5 peones de la mejor. Si hay mate en 1, lo da. |
  | Medio | Profundidad 3, como mucho 0,5 s. |
  | Difícil | Profundización iterativa durante 0,9 s. |

- **Worker** (`src/worker`). La interfaz manda la FEN inicial, las jugadas hechas en UCI (así el motor ve las repeticiones) y el nivel. El Worker valida cada mensaje (tipos, longitudes, nivel y legalidad de cada jugada), nunca lanza y responde con la jugada, la puntuación, la profundidad y la variante principal. `EngineClient` manda una petición cada vez. Para cancelar detiene el Worker, porque un Worker que está pensando no atiende mensajes, y crea otro en la siguiente petición. Se ha probado en Chromium con la misma CSP de producción (`worker-src 'self'`).

**Punto de parada.** Lo fijamos antes de afinar el motor y no se sigue afinando sin pedirlo. Se cumple:

| Criterio | Resultado |
| --- | --- |
| Difícil responde en menos de 1 s | Media de 818 ms y máximo de 909 ms en 505 jugadas |
| Resuelve mates en 1 y en 2 y gana piezas que se dan gratis | Batería en `tests/engine-search.test.ts`. Las posiciones de mate se comprueban con un buscador por fuerza bruta independiente del motor. |
| No regala piezas | Aparta la pieza atacada, no toma el peón envenenado y Fácil no deja la dama colgada |
| Difícil gana 20 de 20 a un jugador al azar | +20 =0 −0 |
| Difícil gana a Fácil | +10 =0 −0 |
| Medio gana a Fácil | +10 =0 −0 |

Las cifras de las partidas salen de `npm run match` (Node 22, un hilo, colores alternos). Profundidad típica en 0,9 s: 5 en la apertura, 4 en medios juegos tácticos como Kiwipete y más de 10 en finales de peones, con unos 120.000 a 500.000 nodos por segundo.

### Coach

Todo en `src/coach`, sin dependencias ni DOM. `analyzeMove({ fen, moves }, jugada)` devuelve datos y textos en español con la forma del panel aprobado en `docs/design`: veredicto y frase corta, mejor jugada, evaluación antes y después vista por las blancas («+0,3 a favor de las blancas», «Mate en 1 para las blancas»), y avisos con título, explicación, etiqueta accesible y casillas para «Ver en el tablero». Habla de tú a quien ha movido, así que sirve igual contra la máquina y a dos jugadores.

**En la interfaz.** El panel (`src/ui/coach-panel.ts`, lógica sin DOM en `src/ui/coach.ts`) sale en las partidas contra la máquina y en las de dos jugadores. Contra la máquina revisa tus jugadas y a dos revisa siempre la última; sigue a la jugada que se ve al deshacer, rehacer o saltar por la lista. El cálculo va en un Worker propio (`src/worker/coach-*.ts`), aparte del de Alfil Beta, para que revisar tu jugada no retrase la respuesta de la máquina; las respuestas del Worker se validan y el informe de cada jugada se guarda para no repetir el cálculo. Accesibilidad: solo el veredicto es una región `role="status"`, el coach nunca toma el foco (ni al pulsar «Ver en el tablero») y los botones miden 44 px. En móvil apaisado no se muestra todavía, porque el lienzo no tiene ese diseño.

- **Valoración.** Alfil Beta busca la posición antes de la jugada (su mejor jugada y su puntuación) y la jugada hecha a la misma profundidad. La diferencia en centipeones se pasa a puntos esperados con una curva logística, como hacen los analizadores habituales, porque perder un peón con la partida igualada pesa mucho más que perderlo ganando por una torre. Según cuánto caen: mejor jugada, buena (menos de 0,05), imprecisión (0,05), error (0,10) o error grave (0,15). Por defecto, profundidad 4 y como mucho 0,6 s en la búsqueda de antes; la jugada hecha se busca luego a la profundidad alcanzada, sin reloj, para que las dos miren igual de lejos. Sin límite de tiempo el análisis es determinista, y así se prueba. En Node tarda de 0,05 a 0,8 s por jugada. Dejar escapar un mate en 1 nunca se califica como mejor ni buena jugada, aunque quede un mate más largo.
- **Mate en 1 que se escapó.** Se prueban todas las jugadas legales: es exacto, no depende de la búsqueda.
- **Pieza colgando y captura que ganaba material.** Un intercambio estático (SEE) hecho con jugadas legales, así que respeta clavadas y jaques: en la casilla capturan los dos bandos por turnos con la pieza de menos valor, y cada uno para cuando ya no le conviene. Solo se avisa si el motor confirma que la jugada pierde al menos 0,8 peones: así no se marca un sacrificio que da mate ni un cambio igualado. La captura no vista, además, se busca con el motor para comprobar que de verdad era mejor (como mucho dos candidatas). En la pieza que se acaba de mover cuenta lo que capturó: un cambio igualado no es una pieza colgando. Limitación conocida: un peón que el rival puede tomar al paso no se marca como colgando.

### Perft y perft dividido

[Perft](https://www.chessprogramming.org/Perft) cuenta las posiciones alcanzables a una profundidad dada. Para posiciones conocidas esos números están publicados, así que cualquier fallo del generador de jugadas (un enroque mal permitido, una captura al paso olvidada, una coronación que falta) cambia el conteo. Las posiciones de referencia y sus conteos están en `tests/perft-positions.ts`: la inicial, las posiciones 2 a 6 de la Chess Programming Wiki (Kiwipete entre ellas) y las posiciones «trampa» de Martin Sedlak (al paso ilegal por clavada, enroques que dan jaque, coronaciones que ahogan…).

Cuando un conteo no cuadra, `npm run perft` desglosa el total por cada jugada inicial, con el mismo formato que `go perft` de Stockfish. Con `--ref` se compara con un desglose de referencia guardado en un fichero y se listan solo las jugadas que no coinciden. Para encontrar la jugada culpable se baja por la rama que falla, añadiendo esa jugada y restando uno a la profundidad:

```sh
npm run perft -- 3 "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1" --ref stockfish.txt
npm run perft -- 2 "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1" e1g1 --ref stockfish-e1g1.txt
```

## Licencia

MIT.
