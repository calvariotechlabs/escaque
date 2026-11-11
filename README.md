# Escaque

App web para aprender ajedrez con motor propio (**Alfil Beta**), escrita desde cero en TypeScript sin dependencias en ejecución: ni librerías de ajedrez, ni frameworks de interfaz. TypeScript solo se usa para compilar.

## Estado

**Hito 1 — Reglas + perft, sin interfaz: hecho.** Tablero 0x88, FEN, generador de jugadas legales (enroque, al paso, coronación), hacer/deshacer, notación algebraica estándar (SAN, escritura y lectura) y fin de partida completo: jaque mate, ahogado, material insuficiente, regla de 50 jugadas y triple repetición. Pasan todos los tests y todos los perft de referencia. Las tablas por 50 jugadas y por triple repetición son automáticas, sin reclamarlas, y la repetición sigue a la FIDE: cuentan el bando al mover, los derechos de enroque y solo las capturas al paso que sean legales.

Velocidad de perft (Node 22, un hilo): unos 9 a 10 millones de nodos por segundo; la inicial a profundidad 6 (119.060.324 nodos) en unos 12 s, y Kiwipete a profundidad 5 (193.690.690) en unos 21 s.

| Hito | Descripción | Estado |
| --- | --- | --- |
| 0 | Repositorio, estructura y herramientas | Hecho |
| 1 | Reglas completas + perft | Hecho |
| 2 | Tablero jugable (dos jugadores) | Hecho |
| 3 | Máquina en Web Worker, 3 niveles | Pendiente |
| 4 | Coach: explicación de errores | Pendiente |
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
npm run serve    # monta site/ y lo sirve en http://127.0.0.1:8080 (sin dependencias)
```

### Interfaz y diseño

Las piezas (doce SVG dibujados a mano, estilo de volumen con degradado) y el tablero se pintan con DOM y CSS a mano desde la colocación de una FEN: `src/ui/pieces.ts` y `src/ui/board.ts`. Los colores y medidas salen de `src/ui/tokens.css`, con tema claro y oscuro. `index.html` es la partida a dos jugadores, sin bundler (`npm run serve`), con la CSP puesta en una etiqueta `meta`.

La interacción está separada en dos capas. `src/ui/game.ts` (la partida por casillas, con deshacer, rehacer y lista de jugadas) y `src/ui/interaction.ts` (qué hace cada clic, arrastre o tecla, y qué casillas se marcan) no tocan el DOM y se prueban en Node. `src/ui/main.ts` solo traduce eventos a esas llamadas y pinta el resultado. Se juega con clic, arrastrando (también con el dedo) o con el teclado: flechas, Inicio/Fin, Re Pág/Av Pág, Intro o Espacio para elegir y Escape para cancelar. Cada jugada se anuncia a los lectores de pantalla en notación algebraica con letras españolas (C, A, T, D, R) y con palabras, y la coronación abre un diálogo modal.

### PWA y dispositivos

Escaque se adapta a móvil, tablet y escritorio y se instala como app (PWA). Puntos de corte: menos de 600 px (móvil), 600 a 859 px (tablet vertical, tablero de hasta 700 px) y desde 860 px (dos columnas); en horizontal bajo 500 px de alto el tablero se mide por el alto. Respeta las zonas seguras (muescas). `public/manifest.webmanifest` declara la app; `src/pwa/sw.ts` es un service worker propio, sin librerías, con caché versionada por contenido (`escaque-<hash>`), que deja jugar sin conexión. Cuando hay versión nueva, un aviso lo dice y avisa de que actualizar reinicia la partida (aún no se guarda). `npm run build:site` genera `site/` con la lista de ficheros a precachear. `vercel.json` publica `site/` y solo fija cabeceras de caché; las de seguridad y el cortafuegos de Vercel están pendientes de su diagnóstico.

El diseño se hace antes en Claude Design y se copia en `docs/design` (README con origen, versión y fecha). Ningún cambio visual entra sin pasar por allí.

### Perft y perft dividido

[Perft](https://www.chessprogramming.org/Perft) cuenta las posiciones alcanzables a una profundidad dada. Para posiciones conocidas esos números están publicados, así que cualquier fallo del generador de jugadas (un enroque mal permitido, una captura al paso olvidada, una coronación que falta) cambia el conteo. Las posiciones de referencia y sus conteos están en `tests/perft-positions.ts`: la inicial, las posiciones 2 a 6 de la Chess Programming Wiki (Kiwipete entre ellas) y las posiciones «trampa» de Martin Sedlak (al paso ilegal por clavada, enroques que dan jaque, coronaciones que ahogan…).

Cuando un conteo no cuadra, `npm run perft` desglosa el total por cada jugada inicial, con el mismo formato que `go perft` de Stockfish. Con `--ref` se compara con un desglose de referencia guardado en un fichero y se listan solo las jugadas que no coinciden. Para encontrar la jugada culpable se baja por la rama que falla, añadiendo esa jugada y restando uno a la profundidad:

```sh
npm run perft -- 3 "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1" --ref stockfish.txt
npm run perft -- 2 "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1" e1g1 --ref stockfish-e1g1.txt
```

## Licencia

MIT.
